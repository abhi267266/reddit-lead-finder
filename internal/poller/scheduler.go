package poller

import (
	"context"
	"log/slog"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/models"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"
)

func StartScheduler(ctx context.Context, db *pgxpool.Pool, redditClient *reddit.Client) error {
	// Initialize jobs for all active campaigns that don't have one
	const initJobs = `
		INSERT INTO jobs (campaign_id, status)
		SELECT id, 'pending' FROM campaigns WHERE active = true
		ON CONFLICT (campaign_id) DO NOTHING
	`
	if _, err := db.Exec(ctx, initJobs); err != nil {
		slog.Error("failed to initialize jobs", "error", err)
		return err
	}

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Wait for workers to finish
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	for {
		select {
		case <-ctx.Done():
			return g.Wait()
		case <-ticker.C:
			pollJobs(ctx, db, redditClient, g)
		}
	}
}

func pollJobs(ctx context.Context, db *pgxpool.Pool, redditClient *reddit.Client, g *errgroup.Group) {
	const selectJobs = `
		SELECT j.id, j.status, c.id, c.subreddits, c.keywords, c.schedule_minutes 
		FROM jobs j
		JOIN campaigns c ON c.id = j.campaign_id
		WHERE j.next_run_at <= NOW() AND j.status != 'running' AND c.active = true
	`

	rows, err := db.Query(ctx, selectJobs)
	if err != nil {
		slog.Error("failed querying due jobs", "error", err)
		return
	}
	defer rows.Close()

	type dueJob struct {
		Job      models.Job
		Campaign models.Campaign
	}
	var dueJobs []dueJob

	for rows.Next() {
		var j models.Job
		var c models.Campaign
		err := rows.Scan(&j.ID, &j.Status, &c.ID, &c.Subreddits, &c.Keywords, &c.ScheduleMinutes)
		if err != nil {
			slog.Error("failed to scan job row", "error", err)
			continue
		}
		dueJobs = append(dueJobs, dueJob{Job: j, Campaign: c})
	}

	for _, dj := range dueJobs {
		// Mark as running
		_, err := db.Exec(ctx, "UPDATE jobs SET status = 'running', updated_at = NOW() WHERE id = $1", dj.Job.ID)
		if err != nil {
			slog.Error("failed to lock job", "job_id", dj.Job.ID, "error", err)
			continue
		}

		job := dj.Job
		campaign := dj.Campaign

		g.Go(func() error {
			RunCampaign(ctx, db, redditClient, campaign, job)
			return nil
		})
	}
}
