-- Migration: Remove user_settings table
-- Date: 2026-04-19
-- Description: Remove user_settings table since user preferences are handled by frontend localStorage

DROP TABLE IF EXISTS user_settings;

-- Verify the table is removed
SELECT tablename FROM pg_tables WHERE tablename = 'user_settings';