-- +goose Up
ALTER TABLE campaigns ADD COLUMN min_upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN min_comments INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN max_age_days INTEGER NOT NULL DEFAULT 30;

-- +goose Down
ALTER TABLE campaigns DROP COLUMN min_upvotes;
ALTER TABLE campaigns DROP COLUMN min_comments;
ALTER TABLE campaigns DROP COLUMN max_age_days;
