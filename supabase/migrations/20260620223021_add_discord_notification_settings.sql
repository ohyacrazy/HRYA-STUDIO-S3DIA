-- Discord notification settings table (per action type toggles)
CREATE TABLE IF NOT EXISTS discord_notification_settings (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings for all action types
INSERT INTO discord_notification_settings (action_type, enabled) VALUES
  ('ban',          true),
  ('unban',        true),
  ('kick',         true),
  ('warn',         true),
  ('kill_game',    true),
  ('revive_game',  true),
  ('broadcast',    true),
  ('login',        true),
  ('login_failed', true),
  ('security',     true),
  ('lockdown',     true)
ON CONFLICT (action_type) DO NOTHING;

ALTER TABLE discord_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_notif_settings" ON discord_notification_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add player_liked_game column to player_profiles if not exists
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS liked_game BOOLEAN DEFAULT false;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS favorited_count INT DEFAULT 0;
