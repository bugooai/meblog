-- Migration: enforce non-null timestamps on posts
-- 1) Backfill legacy null values
-- 2) Add NOT NULL constraints for created_at / updated_at

UPDATE posts
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

UPDATE posts
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE posts
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;
