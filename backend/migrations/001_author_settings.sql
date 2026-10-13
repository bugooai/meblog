-- Migration: Create author_settings table, migrate About data from users, then drop fields from users
-- Run: sqlite3 meblog.db < migrations/001_author_settings.sql

-- Step 1: Create author_settings table
CREATE TABLE IF NOT EXISTS author_settings (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    tech_stack TEXT,
    github_url VARCHAR(500),
    zhihu_url VARCHAR(500),
    twitter_url VARCHAR(500),
    wechat_id VARCHAR(100),
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

-- Step 2: Migrate data from users (first admin user) into author_settings
INSERT INTO author_settings (username, avatar_url, bio, tech_stack, github_url, zhihu_url, twitter_url, wechat_id)
SELECT 
    username,
    avatar_url,
    bio,
    tech_stack,
    github_url,
    zhihu_url,
    twitter_url,
    wechat_id
FROM users
WHERE is_admin = 1
LIMIT 1;

-- Step 3: Verify migration
SELECT 'Migration result:' as info;
SELECT COUNT(*) as author_settings_rows FROM author_settings;
SELECT 'Fields still in users table (should be empty after step 4):' as info;

-- Step 4: Remove About fields from users table (SQLite requires recreating table)
CREATE TABLE users_new AS
SELECT 
    id, username, email, password_hash, is_admin, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes on users
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);

-- Step 5: Verify final state
SELECT 'Final state:' as info;
PRAGMA table_info(users);
PRAGMA table_info(author_settings);
