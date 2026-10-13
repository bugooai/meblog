-- Add cover field for posts.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS cover TEXT;
