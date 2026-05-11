package poller

import (
	"context"
	"errors"
	"log/slog"
	"time"
	
	"github.com/abhi267266/reddit-lead-finder/internal/ai"
	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"
)

func StartScheduler(ctx context.Context, pool *pgxpool.Pool, redditClient *reddit.Client, aiClient *ai.Client) error {
	queries := db.New(pool)
	
	// Initialize jobs for all active campaigns that don't have one
	const initJobs = `
		INSERT INTO jobs (campaign_id, status)
		SELECT id, 'pending' FROM campaigns WHERE active = true
		ON CONFLICT (campaign_id) DO NOTHING
	`
	if _, err := pool.Exec(ctx, initJobs); err != nil {
		slog.Error("failed to initialize jobs", "error", err)
		return err
	}

	// Wait for workers to finish
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	// Trigger the first poll immediately
	pollJobs(ctx, pool, queries, redditClient, aiClient, g)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return g.Wait()
		case <-ticker.C:
			pollJobs(ctx, pool, queries, redditClient, aiClient, g)
		}
	}
}

func pollJobs(ctx context.Context, pool *pgxpool.Pool, queries *db.Queries, redditClient *reddit.Client, aiClient *ai.Client, g *errgroup.Group) {
	for {
		// Atomically claim the next due job using SKIP LOCKED
		claimed, err := queries.ClaimJob(ctx)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// No more due jobs to claim
				return
			}
			slog.Error("failed to claim job", "error", err)
			return
		}

		// Fetch the full campaign details for the claimed job
		j, err := queries.GetCampaignWithJob(ctx, claimed.ID)
		if err != nil {
			slog.Error("failed to fetch campaign details for job", "job_id", claimed.ID, "error", err)
			continue
		}

		// Convert sqlc row to models
		job := db.Job{
			ID:         j.ID,
			CampaignID: j.CampaignID,
			Status:     "running",
		}
		campaign := db.Campaign{
			ID:                 j.CampaignID,
			Name:               j.Name,
			Keywords:           j.Keywords,
			Subreddits:         j.Subreddits,
			ProductDescription: j.ProductDescription,
			ScheduleMinutes:    j.ScheduleMinutes,
			MinUpvotes:         j.MinUpvotes,
			MinComments:        j.MinComments,
			MaxAgeDays:         j.MaxAgeDays,
		}

		g.Go(func() error {
			RunCampaign(ctx, pool, queries, redditClient, aiClient, campaign, job)
			return nil
		})
	}
}
