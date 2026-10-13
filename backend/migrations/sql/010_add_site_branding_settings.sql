ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_name VARCHAR(120);

ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_logo_url TEXT;

ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_favicon_url TEXT;

UPDATE site_settings
SET site_name = '技术博客'
WHERE site_name IS NULL OR TRIM(site_name) = '';
