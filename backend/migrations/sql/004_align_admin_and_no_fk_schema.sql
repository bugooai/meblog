-- Migration: align with agreed personal-blog schema baseline
-- 1) users -> admins
-- 2) remove remaining FK constraints
-- 3) add agreed key fields: admins.last_login_at, projects.is_pinned/sort_order, author_profile.tech_stack_json

-- users -> admins
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'admins'
    ) THEN
        ALTER TABLE users RENAME TO admins;
    END IF;
END $$;

ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- author_settings -> author_profile
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'author_settings'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'author_profile'
    ) THEN
        ALTER TABLE author_settings RENAME TO author_profile;
    END IF;
END $$;

ALTER TABLE author_profile ADD COLUMN IF NOT EXISTS tech_stack_json TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'author_profile'
          AND column_name = 'tech_stack'
    ) THEN
        EXECUTE 'UPDATE author_profile SET tech_stack_json = tech_stack WHERE tech_stack_json IS NULL';
        EXECUTE 'ALTER TABLE author_profile DROP COLUMN tech_stack';
    END IF;
END $$;

-- project fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ix_projects_sort_order ON projects(sort_order);

-- Drop FK constraints (explicitly) to match "no hard foreign-key constraints" requirement
ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_project_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_visitor_id_fkey;
ALTER TABLE IF EXISTS post_tags DROP CONSTRAINT IF EXISTS post_tags_post_id_fkey;
ALTER TABLE IF EXISTS post_tags DROP CONSTRAINT IF EXISTS post_tags_tag_id_fkey;
ALTER TABLE IF EXISTS access_logs DROP CONSTRAINT IF EXISTS access_logs_post_id_fkey;
ALTER TABLE IF EXISTS access_logs DROP CONSTRAINT IF EXISTS access_logs_visitor_id_fkey;
ALTER TABLE IF EXISTS post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;
ALTER TABLE IF EXISTS post_likes DROP CONSTRAINT IF EXISTS post_likes_visitor_id_fkey;

