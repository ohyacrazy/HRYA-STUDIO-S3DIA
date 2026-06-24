-- Add visits/playing/likes to managed_games
ALTER TABLE managed_games
  ADD COLUMN IF NOT EXISTS visits bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playing integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add join_count to player_profiles if missing
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS join_count integer DEFAULT 1;

-- Create persistent sessions table for "stay logged in"
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  owner_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_active_at timestamptz DEFAULT now()
);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_admin_sessions" ON admin_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
