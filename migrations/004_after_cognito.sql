-- +goose Up
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- +goose Down
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
