-- Migration: set DB-side UUID defaults for visitor/event IDs
-- Why:
-- - Some runtime paths may not explicitly populate id values.
-- - Guarantee inserts succeed by assigning UUID text defaults at DB layer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE visitors
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE post_view_event
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
