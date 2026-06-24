-- Add missing columns to activity_log for full context
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS server_id TEXT;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS device_type TEXT;