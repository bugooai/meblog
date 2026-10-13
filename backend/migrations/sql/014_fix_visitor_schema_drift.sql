-- Migration: fix visitor schema drift across environments
-- Why:
-- - Public article view path writes visitor + post_view_event records.
-- - Some older databases kept integer visitor IDs from early migrations.
-- - Current app uses string UUID-like IDs (String(36)) for these tables.
-- - Type mismatch causes anonymous/non-admin article requests to fail.

-- 1) Ensure event table naming is aligned.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'access_logs'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'post_view_event'
    ) THEN
        ALTER TABLE access_logs RENAME TO post_view_event;
    END IF;
END $$;

-- 2) Ensure visitors table exists with expected columns.
CREATE TABLE IF NOT EXISTS visitors (
    id VARCHAR(36) PRIMARY KEY,
    visitor_key VARCHAR(64) UNIQUE NOT NULL,
    ip_hash VARCHAR(64) NOT NULL,
    ua_hash VARCHAR(64) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Ensure post_view_event table exists.
CREATE TABLE IF NOT EXISTS post_view_event (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36),
    visitor_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    user_agent TEXT,
    referrer TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Add missing columns in case of partial/legacy schema.
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);
ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS accessed_at TIMESTAMPTZ;

-- 5) Normalize ID-related column types to VARCHAR(36).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'visitors' AND column_name = 'id'
          AND udt_name <> 'varchar'
    ) THEN
        ALTER TABLE visitors ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'post_view_event' AND column_name = 'id'
          AND udt_name <> 'varchar'
    ) THEN
        ALTER TABLE post_view_event ALTER COLUMN id TYPE VARCHAR(36) USING id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'post_view_event' AND column_name = 'visitor_id'
          AND udt_name <> 'varchar'
    ) THEN
        ALTER TABLE post_view_event ALTER COLUMN visitor_id TYPE VARCHAR(36) USING visitor_id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'visitor_id'
          AND udt_name <> 'varchar'
    ) THEN
        ALTER TABLE comments ALTER COLUMN visitor_id TYPE VARCHAR(36) USING visitor_id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'post_likes' AND column_name = 'visitor_id'
          AND udt_name <> 'varchar'
    ) THEN
        ALTER TABLE post_likes ALTER COLUMN visitor_id TYPE VARCHAR(36) USING visitor_id::text;
    END IF;
END $$;

-- 6) Backfill null timestamps and enforce not-null defaults where required.
UPDATE visitors
SET created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, created_at, NOW()),
    first_seen_at = COALESCE(first_seen_at, created_at, NOW()),
    last_seen_at = COALESCE(last_seen_at, updated_at, NOW())
WHERE created_at IS NULL
   OR updated_at IS NULL
   OR first_seen_at IS NULL
   OR last_seen_at IS NULL;

UPDATE post_view_event
SET accessed_at = COALESCE(accessed_at, NOW())
WHERE accessed_at IS NULL;

ALTER TABLE visitors
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN first_seen_at SET DEFAULT NOW(),
ALTER COLUMN last_seen_at SET DEFAULT NOW(),
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL,
ALTER COLUMN first_seen_at SET NOT NULL,
ALTER COLUMN last_seen_at SET NOT NULL;

ALTER TABLE post_view_event
ALTER COLUMN accessed_at SET DEFAULT NOW(),
ALTER COLUMN accessed_at SET NOT NULL;

-- 7) Ensure required indexes/constraints.
CREATE UNIQUE INDEX IF NOT EXISTS ux_visitors_visitor_key ON visitors(visitor_key);
CREATE INDEX IF NOT EXISTS ix_visitors_ip_hash ON visitors(ip_hash);
CREATE INDEX IF NOT EXISTS ix_visitors_ua_hash ON visitors(ua_hash);
CREATE INDEX IF NOT EXISTS ix_visitors_last_seen_at ON visitors(last_seen_at);

CREATE INDEX IF NOT EXISTS ix_post_view_event_post_id ON post_view_event(post_id);
CREATE INDEX IF NOT EXISTS ix_post_view_event_visitor_id ON post_view_event(visitor_id);
CREATE INDEX IF NOT EXISTS ix_post_view_event_accessed_at ON post_view_event(accessed_at);

-- 8) Runtime verification output (safe to keep).
SELECT table_name, column_name, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('visitors', 'post_view_event')
ORDER BY table_name, ordinal_position;
