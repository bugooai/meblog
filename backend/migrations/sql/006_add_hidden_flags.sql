-- Add hidden visibility flags for posts and projects.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_posts_is_hidden ON posts (is_hidden);
CREATE INDEX IF NOT EXISTS ix_projects_is_hidden ON projects (is_hidden);
