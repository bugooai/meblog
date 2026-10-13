-- Migration: finalize admin-first schema + audit fields + post_view_event naming

-- Rename access log table to post_view_event
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

-- Shared audit fields
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE author_profile ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE author_profile ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);
ALTER TABLE post_view_event ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36);

