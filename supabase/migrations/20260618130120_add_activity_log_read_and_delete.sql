-- Add is_read column to activity_log
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Add read_at timestamp
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_is_read ON activity_log(is_read);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);