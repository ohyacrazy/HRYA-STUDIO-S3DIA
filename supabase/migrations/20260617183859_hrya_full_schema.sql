
-- Player profiles: cumulative info per player
CREATE TABLE player_profiles (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT DEFAULT 'Unknown',
  device_type TEXT DEFAULT 'Unknown',
  total_playtime_seconds BIGINT DEFAULT 0,
  session_count INT DEFAULT 0,
  join_count INT DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_banned BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_server_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player join/leave events
CREATE TABLE player_events (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT NOT NULL,
  username TEXT,
  display_name TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('join','leave')),
  country_code TEXT DEFAULT 'Unknown',
  device_type TEXT DEFAULT 'Unknown',
  session_seconds BIGINT DEFAULT 0,
  server_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Currently online players
CREATE TABLE online_players (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  country_code TEXT DEFAULT 'Unknown',
  device_type TEXT DEFAULT 'Unknown',
  server_id TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permanent ban records
CREATE TABLE banned_players (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reason TEXT DEFAULT 'No reason provided',
  banned_by TEXT DEFAULT 'Admin',
  banned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command queue (ban, kick, warn, message, teleport, shutdown)
CREATE TABLE commands (
  id BIGSERIAL PRIMARY KEY,
  command_type TEXT NOT NULL,
  roblox_user_id BIGINT,
  target_server_id TEXT,
  reason TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','executed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- Pending warns (for offline delivery)
CREATE TABLE player_warns (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT NOT NULL,
  message TEXT DEFAULT 'Warning from moderator: Please follow the rules or you will be banned.',
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending messages (for offline delivery)
CREATE TABLE player_messages (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT,
  target_all BOOLEAN DEFAULT FALSE,
  message TEXT NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_user_id BIGINT,
  reporter_username TEXT,
  reported_user_id BIGINT NOT NULL,
  reported_username TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  server_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security flags
CREATE TABLE security_flags (
  id BIGSERIAL PRIMARY KEY,
  roblox_user_id BIGINT NOT NULL,
  username TEXT,
  flag_type TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','banned','dismissed')),
  server_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics snapshots
CREATE TABLE analytics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game stats (visits, likes, etc.)
CREATE TABLE game_stats (
  id BIGSERIAL PRIMARY KEY,
  visits BIGINT DEFAULT 0,
  favorites BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  game_pass_sales BIGINT DEFAULT 0,
  dev_product_sales BIGINT DEFAULT 0,
  servers_online INT DEFAULT 0,
  fps_average FLOAT DEFAULT 0,
  ping_average FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default game stats row
INSERT INTO game_stats (id) VALUES (1);

-- Enable RLS on all tables
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_warns ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses RLS, anon key gets full access for dashboard
CREATE POLICY "anon_select_player_profiles" ON player_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_player_profiles" ON player_profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_player_profiles" ON player_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_player_profiles" ON player_profiles FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_player_events" ON player_events FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_player_events" ON player_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_player_events" ON player_events FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_player_events" ON player_events FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_online_players" ON online_players FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_online_players" ON online_players FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_online_players" ON online_players FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_online_players" ON online_players FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_banned_players" ON banned_players FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_banned_players" ON banned_players FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_banned_players" ON banned_players FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_banned_players" ON banned_players FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_commands" ON commands FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_commands" ON commands FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_commands" ON commands FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_commands" ON commands FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_player_warns" ON player_warns FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_player_warns" ON player_warns FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_player_warns" ON player_warns FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_player_warns" ON player_warns FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_player_messages" ON player_messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_player_messages" ON player_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_player_messages" ON player_messages FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_player_messages" ON player_messages FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_reports" ON reports FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_security_flags" ON security_flags FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_security_flags" ON security_flags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_security_flags" ON security_flags FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_security_flags" ON security_flags FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_analytics_snapshots" ON analytics_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_analytics_snapshots" ON analytics_snapshots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_analytics_snapshots" ON analytics_snapshots FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_analytics_snapshots" ON analytics_snapshots FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_game_stats" ON game_stats FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_game_stats" ON game_stats FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_game_stats" ON game_stats FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_game_stats" ON game_stats FOR DELETE TO anon USING (true);
