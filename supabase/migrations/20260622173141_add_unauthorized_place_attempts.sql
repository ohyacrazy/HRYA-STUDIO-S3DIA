-- Tracks places outside the registered allow-list that have run the script,
-- so we alert Discord once (not every 20 seconds while the thief's server is up).
CREATE TABLE IF NOT EXISTS unauthorized_place_attempts (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  place_name TEXT,
  creator_name TEXT,
  creator_id TEXT,
  creator_type TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unauthorized_attempts_game_id ON unauthorized_place_attempts(game_id);

ALTER TABLE unauthorized_place_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_unauthorized_attempts" ON unauthorized_place_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_unauthorized_attempts" ON unauthorized_place_attempts
  FOR ALL TO anon USING (true) WITH CHECK (true);

INSERT INTO discord_notification_settings (action_type, enabled) VALUES
  ('unauthorized_use', true)
ON CONFLICT (action_type) DO NOTHING;
