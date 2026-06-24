-- Real, per-purchase Robux log so revenue breakdown is actual data instead of an estimate.
CREATE TABLE IF NOT EXISTS robux_purchases (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL,
  roblox_user_id BIGINT,
  username TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('gamepass', 'devproduct')),
  product_id TEXT,
  product_name TEXT,
  robux_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robux_purchases_game_id ON robux_purchases(game_id);
CREATE INDEX IF NOT EXISTS idx_robux_purchases_created_at ON robux_purchases(created_at DESC);

ALTER TABLE robux_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_robux_purchases" ON robux_purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_robux_purchases" ON robux_purchases
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add a toggle for purchase notifications alongside the existing action types
INSERT INTO discord_notification_settings (action_type, enabled) VALUES
  ('purchase', true)
ON CONFLICT (action_type) DO NOTHING;
