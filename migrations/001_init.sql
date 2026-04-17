-- +goose Up
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campaigns (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    keywords             TEXT[] NOT NULL DEFAULT '{}',
    subreddits           TEXT[] NOT NULL DEFAULT '{}',
    product_description  TEXT NOT NULL,
    schedule_minutes     INTEGER NOT NULL DEFAULT 30,
    active               BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE raw_posts (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    reddit_post_id  TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    author          TEXT NOT NULL,
    subreddit       TEXT NOT NULL,
    url             TEXT NOT NULL,
    upvotes         INTEGER NOT NULL DEFAULT 0,
    comment_count   INTEGER NOT NULL DEFAULT 0,
    posted_at       TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT raw_posts_unique UNIQUE (campaign_id, reddit_post_id)
);

CREATE TABLE jobs (
    id           SERIAL PRIMARY KEY,
    campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
    last_run_at  TIMESTAMPTZ,
    next_run_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error        TEXT NOT NULL DEFAULT '',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_posts_campaign_id ON raw_posts(campaign_id);
CREATE INDEX idx_jobs_next_run_at ON jobs(next_run_at) WHERE status != 'running';

-- +goose Down
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS raw_posts;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS users;
