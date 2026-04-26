package poller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/abhi267266/reddit-lead-finder/internal/ai"
	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/abhi267266/reddit-lead-finder/internal/models"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DeduplicateAndFilter removes duplicates and filters based on engagement, recency, and keywords
func DeduplicateAndFilter(posts []reddit.Post, minUpvotes, minComments, maxAgeDays int32, keywords []string) []reddit.Post {
	seen := make(map[string]struct{})
	var result []reddit.Post

	now := time.Now().Unix()

	for _, p := range posts {
		if _, ok := seen[p.ID]; ok {
			continue
		}
		seen[p.ID] = struct{}{}

		// Check engagement
		hasEngagement := int32(p.Score) >= minUpvotes || int32(p.NumComments) >= minComments
		
		// Check recency
		ageSeconds := now - int64(p.CreatedUTC)
		isRecent := ageSeconds <= int64(maxAgeDays)*24*3600

		// Check keywords (case-insensitive)
		hasKeyword := len(keywords) == 0
		if !hasKeyword {
			titleLower := strings.ToLower(p.Title)
			bodyLower := strings.ToLower(p.Selftext)
			for _, kw := range keywords {
				kwLower := strings.ToLower(kw)
				if strings.Contains(titleLower, kwLower) || strings.Contains(bodyLower, kwLower) {
					hasKeyword = true
					break
				}
			}
		}

		if hasEngagement && isRecent && hasKeyword {
			result = append(result, p)
		}
	}
	return result
}

func RunCampaign(ctx context.Context, pool *pgxpool.Pool, queries *db.Queries, redditClient *reddit.Client, aiClient *ai.Client, campaign db.Campaign, job db.Job) {
	slog.Info("job started", "campaign_id", campaign.ID, "subreddits", len(campaign.Subreddits))

	var allPosts []reddit.Post

	for _, sub := range campaign.Subreddits {
		hotPosts, err := redditClient.GetHotPosts(ctx, sub)
		if err == nil {
			allPosts = append(allPosts, hotPosts...)
		} else {
			slog.Error("GetHotPosts failed", "subreddit", sub, "error", err)
		}

		for _, kw := range campaign.Keywords {
			searchPosts, err := redditClient.SearchSubreddit(ctx, sub, kw)
			if err == nil {
				allPosts = append(allPosts, searchPosts...)
			} else {
				slog.Error("SearchSubreddit failed", "subreddit", sub, "keyword", kw, "error", fmt.Errorf("reddit.Client.SearchSubreddit: %w", err))
			}
		}
	}

	filteredPosts := DeduplicateAndFilter(allPosts, campaign.MinUpvotes, campaign.MinComments, campaign.MaxAgeDays, campaign.Keywords)
	insertedCount := 0

	for _, p := range filteredPosts {
		postedAt := time.Unix(int64(p.CreatedUTC), 0)
		
		err := queries.CreateRawPost(ctx, db.CreateRawPostParams{
			CampaignID:   campaign.ID,
			RedditPostID: p.ID,
			Title:        p.Title,
			Body:         p.Selftext,
			Author:       p.Author,
			Subreddit:    p.Subreddit,
			Url:          p.URL,
			Upvotes:      int32(p.Score),
			CommentCount: int32(p.NumComments),
			PostedAt:      pgtype.Timestamptz{Time: postedAt, Valid: true},
		})
		
		if err != nil {
			slog.Error("job failed", "campaign_id", campaign.ID, "error", fmt.Errorf("poller.RunCampaign db insert: %w", err))
			updateJobStatus(ctx, queries, job.ID, "failed", err.Error(), campaign.ScheduleMinutes)
			return
		}
		insertedCount++
	}

	duplicates := len(allPosts) - insertedCount
	slog.Info("posts fetched", "campaign_id", campaign.ID, "new", insertedCount, "dupes", duplicates)

	// Step 2: AI Categorization
	uncategorized, err := queries.ListUncategorizedPosts(ctx, campaign.ID)
	if err != nil {
		slog.Error("failed to list uncategorized posts", "campaign_id", campaign.ID, "error", err)
	} else if len(uncategorized) > 0 {
		var toCategorize []models.RawPost
		for _, rp := range uncategorized {
			toCategorize = append(toCategorize, models.RawPost{
				ID:    int(rp.ID),
				Title: rp.Title,
				Body:  rp.Body,
			})
		}

		slog.Info("categorizing posts", "campaign_id", campaign.ID, "count", len(toCategorize))
		const batchSize = 10
		for i := 0; i < len(toCategorize); i += batchSize {
			end := i + batchSize
			if end > len(toCategorize) {
				end = len(toCategorize)
			}
			batch := toCategorize[i:end]

			results, _, err := aiClient.CategorizeBatch(ctx, campaign.ProductDescription, batch)
			if err != nil {
				slog.Error("ai categorization failed for batch", "campaign_id", campaign.ID, "error", err)

				// Determine retry timestamp for UI countdown
				retryAtStr := ""
				var rlErr *ai.RateLimitError
				if errors.As(err, &rlErr) && rlErr.WaitDuration > 0 {
					retryAtStr = time.Now().Add(rlErr.WaitDuration).Format(time.RFC3339)
				}

				for _, p := range batch {
					_ = queries.UpdatePostAIFields(ctx, db.UpdatePostAIFieldsParams{
						ID:        int32(p.ID),
						Score:     0,
						Category:  "error",
						AiSummary: retryAtStr,
						IsLead:    false,
					})
				}

				// Still pace before next batch
				if i+batchSize < len(toCategorize) {
					time.Sleep(1500 * time.Millisecond)
				}
				continue
			}

			for _, res := range results {
				err := queries.UpdatePostAIFields(ctx, db.UpdatePostAIFieldsParams{
					ID:        int32(res.ID),
					Score:     int32(res.Score),
					Category:  res.Category,
					AiSummary: res.Summary,
					IsLead:    res.IsLead,
				})
				if err != nil {
					slog.Error("failed to update ai fields", "post_id", res.ID, "error", err)
				}
			}

			// Pace the batches to stay under Groq's free-tier rate limit
			if i+batchSize < len(toCategorize) {
				time.Sleep(1500 * time.Millisecond)
			}
		}
	}

	updateJobStatus(ctx, queries, job.ID, "completed", "", campaign.ScheduleMinutes)
}

func updateJobStatus(ctx context.Context, queries *db.Queries, jobID int32, status, errorMsg string, scheduleMinutes int32) {
	now := time.Now()
	nextRun := now.Add(time.Duration(scheduleMinutes) * time.Minute)

	err := queries.UpdateJobStatus(ctx, db.UpdateJobStatusParams{
		Status:    status,
		Error:     errorMsg,
		LastRunAt: pgtype.Timestamptz{Time: now, Valid: true},
		NextRunAt: pgtype.Timestamptz{Time: nextRun, Valid: true},
		ID:        jobID,
	})
	if err != nil {
		slog.Error("failed to update job status", "job_id", jobID, "error", err)
	}
}
