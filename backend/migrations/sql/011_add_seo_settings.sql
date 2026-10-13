ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_description VARCHAR(300);

ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_keywords VARCHAR(500);

ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS default_og_image_url TEXT;

UPDATE site_settings
SET site_description = '分享技术与生活的个人博客'
WHERE site_description IS NULL OR TRIM(site_description) = '';

UPDATE site_settings
SET site_keywords = '技术,博客,编程,AI'
WHERE site_keywords IS NULL OR TRIM(site_keywords) = '';
