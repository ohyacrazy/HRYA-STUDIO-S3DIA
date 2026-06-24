CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_user_id BIGINT,
  target_username TEXT,
  performed_by TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_activity_log" ON activity_log FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "delete_activity_log" ON activity_log FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS player_warns (
  id SERIAL PRIMARY KEY,
  roblox_user_id BIGINT NOT NULL,
  message TEXT,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_warns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_warns" ON player_warns FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_warns" ON player_warns FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_warns" ON player_warns FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "delete_warns" ON player_warns FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS player_messages (
  id SERIAL PRIMARY KEY,
  roblox_user_id BIGINT,
  message TEXT,
  target_all BOOLEAN DEFAULT FALSE,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_messages" ON player_messages FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_messages" ON player_messages FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_messages" ON player_messages FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "delete_messages" ON player_messages FOR DELETE
  TO authenticated USING (true);

-- Add columns to game_stats for likes, gamepass sales, total robux
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS gamepass_sales INTEGER DEFAULT 0;
ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS total_robux INTEGER DEFAULT 0;
