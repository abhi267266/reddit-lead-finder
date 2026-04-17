package poller

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/models"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DeduplicateAndFilter filters posts < 30 words and removes duplicates
func DeduplicateAndFilter(posts []reddit.Post) []reddit.Post {
	seen := make(map[string]struct{})
	var result []reddit.Post

	for _, p := range posts {
		if _, ok := seen[p.ID]; ok {
			continue
		}
		seen[p.ID] = struct{}{}

		wordCount := len(strings.Fields(p.Title)) + len(strings.Fields(p.Selftext))
		if wordCount >= 30 {
			result = append(result, p)
		}
	}
	return result
}

func RunCampaign(ctx context.Context, db *pgxpool.Pool, redditClient *reddit.Client, campaign models.Campaign, job models.Job) {
	slog.Info("job started", "campaign_id", campaign.ID, "subreddits", len(campaign.Subreddits))

	var allPosts []reddit.Post

	for _, sub := range campaign.Subreddits {
		newPosts, err := redditClient.GetNewPosts(ctx, sub)
		if err == nil {
			allPosts = append(allPosts, newPosts...)
		} else {
			slog.Error("GetNewPosts failed", "subreddit", sub, "error", err)
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

	filteredPosts := DeduplicateAndFilter(allPosts)
	insertedCount := 0

	const insertLead = `
		INSERT INTO raw_posts (campaign_id, reddit_post_id, title, body, author, subreddit, url, upvotes, comment_count, posted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (campaign_id, reddit_post_id) DO NOTHING
	`

	for _, p := range filteredPosts {
		postedAt := time.Unix(int64(p.CreatedUTC), 0)
		
		tag, err := db.Exec(ctx, insertLead,
			campaign.ID,
			p.ID,
			p.Title,
			p.Selftext,
			p.Author,
			p.Subreddit,
			p.URL,
			p.Score,
			p.NumComments,
			postedAt,
		)
		if err != nil {
			slog.Error("job failed", "campaign_id", campaign.ID, "error", fmt.Errorf("poller.RunCampaign db insert: %w", err))
			updateJobStatus(ctx, db, job.ID, "failed", err.Error(), campaign.ScheduleMinutes)
			return
		}

		if tag.RowsAffected() > 0 {
			insertedCount++
		}
	}

	duplicates := len(allPosts) - insertedCount
	slog.Info("posts fetched", "campaign_id", campaign.ID, "new", insertedCount, "dupes", duplicates)

	updateJobStatus(ctx, db, job.ID, "completed", "", campaign.ScheduleMinutes)
}

func updateJobStatus(ctx context.Context, db *pgxpool.Pool, jobID int, status, errorMsg string, scheduleMinutes int) {
	const query = `
		UPDATE jobs 
		SET status = $1, error = $2, last_run_at = NOW(), next_run_at = NOW() + interval '1 minute' * $3, updated_at = NOW()
		WHERE id = $4
	`
	_, err := db.Exec(ctx, query, status, errorMsg, scheduleMinutes, jobID)
	if err != nil {
		slog.Error("failed to update job status", "job_id", jobID, "error", err)
	}
}
