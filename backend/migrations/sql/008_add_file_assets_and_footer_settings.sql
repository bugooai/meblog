ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS footer_github_url VARCHAR(500);

ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS beian_icp VARCHAR(100);

CREATE TABLE IF NOT EXISTS file_assets (
    id VARCHAR(36) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    bucket VARCHAR(128) NOT NULL,
    object_key VARCHAR(1024) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(255),
    size_bytes INTEGER NOT NULL,
    url TEXT NOT NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_file_assets_provider_bucket_key UNIQUE (provider, bucket, object_key)
);

CREATE INDEX IF NOT EXISTS idx_file_assets_provider ON file_assets(provider);
