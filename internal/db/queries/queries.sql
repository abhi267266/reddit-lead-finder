-- name: CreateUser :one
INSERT INTO users (email, password_hash, plan)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: ListCampaignsByUser :many
SELECT * FROM campaigns
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetCampaign :one
SELECT * FROM campaigns
WHERE id = $1 AND user_id = $2
LIMIT 1;

-- name: UpdateCampaignActiveStatus :exec
UPDATE campaigns
SET active = $2
WHERE id = $1 AND user_id = $3;

-- name: DeleteCampaign :exec
DELETE FROM campaigns
WHERE id = $1 AND user_id = $2;

-- name: ListPostsByCampaign :many
SELECT * FROM raw_posts
WHERE campaign_id = $1
ORDER BY posted_at DESC;

-- name: CreateCampaign :one
INSERT INTO campaigns (user_id, name, keywords, subreddits, product_description, schedule_minutes, active, min_upvotes, min_comments, max_age_days)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetJobByCampaignID :one
SELECT * FROM jobs
WHERE campaign_id = $1;

-- name: CreateJob :one
INSERT INTO jobs (campaign_id, status, next_run_at)
VALUES ($1, $2, $3)
ON CONFLICT (campaign_id) DO NOTHING
RETURNING *;

-- name: ListDueJobs :many
SELECT j.*, c.name, c.keywords, c.subreddits, c.product_description, c.schedule_minutes, c.min_upvotes, c.min_comments, c.max_age_days
FROM jobs j
JOIN campaigns c ON c.id = j.campaign_id
WHERE j.next_run_at <= NOW()
AND j.status != 'running'
AND c.active = true;

-- name: UpdateJobStatus :exec
UPDATE jobs 
SET status = $1, error = $2, last_run_at = $3, next_run_at = $4, updated_at = NOW()
WHERE id = $5;

-- name: UpdateCampaign :one
UPDATE campaigns
SET keywords = $2, product_description = $3, schedule_minutes = $4, min_upvotes = $6, min_comments = $7, max_age_days = $8
WHERE id = $1 AND user_id = $5
RETURNING *;

-- name: CreateRawPost :exec
INSERT INTO raw_posts (campaign_id, reddit_post_id, title, body, author, subreddit, url, upvotes, comment_count, posted_at)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
WHERE NOT EXISTS (
    SELECT 1 FROM raw_posts 
    WHERE campaign_id = $1 AND (reddit_post_id = $2 OR (title = $3 AND author = $5))
);

-- name: DeleteRawPost :exec
DELETE FROM raw_posts
WHERE raw_posts.id = $1 AND raw_posts.campaign_id IN (
    SELECT campaigns.id FROM campaigns WHERE campaigns.user_id = $2
);

-- name: UpdatePostAIFields :exec
UPDATE raw_posts
SET score = $2, category = $3, ai_summary = $4, is_lead = $5
WHERE id = $1;

-- name: ListUncategorizedPosts :many
SELECT * FROM raw_posts
WHERE campaign_id = $1 AND (category = '' OR category = 'error')
LIMIT 50;

-- name: GetRawPostWithCampaign :many
SELECT rp.id, rp.title, rp.body, rp.campaign_id, c.product_description
FROM raw_posts rp
JOIN campaigns c ON c.id = rp.campaign_id
WHERE rp.id = $1 AND c.user_id = $2
LIMIT 1;
