-- Create visitor table and migrate legacy visitor_id(string) to visitor_id(integer)

CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    visitor_key VARCHAR(64) UNIQUE NOT NULL,
    ip_hash VARCHAR(64) NOT NULL,
    ua_hash VARCHAR(64) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_visitors_ip_hash ON visitors(ip_hash);
CREATE INDEX IF NOT EXISTS ix_visitors_ua_hash ON visitors(ua_hash);
CREATE INDEX IF NOT EXISTS ix_visitors_last_seen_at ON visitors(last_seen_at);

DO $$
BEGIN
    -- comments: rename legacy visitor_id if it is still text/varchar
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comments'
          AND column_name = 'visitor_id'
          AND data_type IN ('character varying', 'text')
    ) THEN
        ALTER TABLE comments RENAME COLUMN visitor_id TO visitor_key_legacy;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comments'
          AND column_name = 'visitor_id'
    ) THEN
        ALTER TABLE comments ADD COLUMN visitor_id INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    -- post_likes: rename legacy visitor_id if it is still text/varchar
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'post_likes'
          AND column_name = 'visitor_id'
          AND data_type IN ('character varying', 'text')
    ) THEN
        ALTER TABLE post_likes RENAME COLUMN visitor_id TO visitor_key_legacy;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'post_likes'
          AND column_name = 'visitor_id'
    ) THEN
        ALTER TABLE post_likes ADD COLUMN visitor_id INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    -- access_logs: rename legacy visitor_id if it is still text/varchar
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'access_logs'
          AND column_name = 'visitor_id'
          AND data_type IN ('character varying', 'text')
    ) THEN
        ALTER TABLE access_logs RENAME COLUMN visitor_id TO visitor_key_legacy;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'access_logs'
          AND column_name = 'visitor_id'
    ) THEN
        ALTER TABLE access_logs ADD COLUMN visitor_id INTEGER;
    END IF;
END $$;

WITH legacy_keys AS (
    SELECT visitor_key_legacy AS visitor_key, COALESCE(created_at, NOW()) AS seen_at
    FROM comments
    WHERE visitor_key_legacy IS NOT NULL
    UNION ALL
    SELECT visitor_key_legacy AS visitor_key, COALESCE(created_at, NOW()) AS seen_at
    FROM post_likes
    WHERE visitor_key_legacy IS NOT NULL
    UNION ALL
    SELECT visitor_key_legacy AS visitor_key, COALESCE(accessed_at, NOW()) AS seen_at
    FROM access_logs
    WHERE visitor_key_legacy IS NOT NULL
),
grouped_keys AS (
    SELECT
        visitor_key,
        MIN(seen_at) AS first_seen_at,
        MAX(seen_at) AS last_seen_at
    FROM legacy_keys
    GROUP BY visitor_key
)
INSERT INTO visitors (visitor_key, ip_hash, ua_hash, first_seen_at, last_seen_at)
SELECT
    visitor_key,
    visitor_key,
    repeat('0', 64),
    first_seen_at,
    last_seen_at
FROM grouped_keys
ON CONFLICT (visitor_key) DO UPDATE
SET
    last_seen_at = GREATEST(visitors.last_seen_at, EXCLUDED.last_seen_at),
    updated_at = NOW();

UPDATE comments c
SET visitor_id = v.id
FROM visitors v
WHERE c.visitor_id IS NULL
  AND c.visitor_key_legacy IS NOT NULL
  AND c.visitor_key_legacy = v.visitor_key;

UPDATE post_likes pl
SET visitor_id = v.id
FROM visitors v
WHERE pl.visitor_id IS NULL
  AND pl.visitor_key_legacy IS NOT NULL
  AND pl.visitor_key_legacy = v.visitor_key;

UPDATE access_logs al
SET visitor_id = v.id
FROM visitors v
WHERE al.visitor_id IS NULL
  AND al.visitor_key_legacy IS NOT NULL
  AND al.visitor_key_legacy = v.visitor_key;

-- Fallback visitor for any dangling legacy rows
INSERT INTO visitors (visitor_key, ip_hash, ua_hash)
VALUES ('legacy-unknown', repeat('f', 64), repeat('f', 64))
ON CONFLICT (visitor_key) DO NOTHING;

UPDATE comments
SET visitor_id = (SELECT id FROM visitors WHERE visitor_key = 'legacy-unknown')
WHERE visitor_id IS NULL;

UPDATE post_likes
SET visitor_id = (SELECT id FROM visitors WHERE visitor_key = 'legacy-unknown')
WHERE visitor_id IS NULL;

UPDATE access_logs
SET visitor_id = (SELECT id FROM visitors WHERE visitor_key = 'legacy-unknown')
WHERE visitor_id IS NULL;

ALTER TABLE comments ALTER COLUMN visitor_id SET NOT NULL;
ALTER TABLE post_likes ALTER COLUMN visitor_id SET NOT NULL;
ALTER TABLE access_logs ALTER COLUMN visitor_id SET NOT NULL;

ALTER TABLE comments DROP COLUMN IF EXISTS visitor_key_legacy;
ALTER TABLE post_likes DROP COLUMN IF EXISTS visitor_key_legacy;
ALTER TABLE access_logs DROP COLUMN IF EXISTS visitor_key_legacy;

-- Ensure unique like per (post, visitor)
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS uq_post_visitor;
ALTER TABLE post_likes ADD CONSTRAINT uq_post_visitor UNIQUE (post_id, visitor_id);
