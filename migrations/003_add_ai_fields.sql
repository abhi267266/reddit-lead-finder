-- +goose Up
ALTER TABLE raw_posts ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE raw_posts ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE raw_posts ADD COLUMN ai_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE raw_posts ADD COLUMN is_lead BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE raw_posts DROP COLUMN score;
ALTER TABLE raw_posts DROP COLUMN category;
ALTER TABLE raw_posts DROP COLUMN ai_summary;
ALTER TABLE raw_posts DROP COLUMN is_lead;
