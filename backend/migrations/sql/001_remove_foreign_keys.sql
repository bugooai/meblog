-- Migration: Remove foreign key constraints from all tables
-- Date: 2026-04-19
-- Description: Remove all foreign key constraints to allow flexible data management

-- Drop foreign key constraints from posts table
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_project_id_fkey;

-- Drop foreign key constraints from comments table  
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

-- Drop foreign key constraints from post_tags table (if exists)
ALTER TABLE post_tags DROP CONSTRAINT IF EXISTS post_tags_post_id_fkey;
ALTER TABLE post_tags DROP CONSTRAINT IF EXISTS post_tags_tag_id_fkey;

-- Drop foreign key constraints from user_settings table (if exists)
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

-- Drop foreign key constraints from access_logs table (if exists)
ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_post_id_fkey;

-- Drop foreign key constraints from post_likes table (if exists)
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_post_id_fkey;

-- Verify the changes
SELECT 
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('posts', 'comments', 'post_tags', 'user_settings', 'access_logs', 'post_likes');