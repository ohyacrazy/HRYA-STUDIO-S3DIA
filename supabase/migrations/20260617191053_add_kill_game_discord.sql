
ALTER TABLE game_stats
  ADD COLUMN IF NOT EXISTS kill_game_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

-- Add avatar_resolved column to store the real CDN URL
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS avatar_resolved TEXT;
ALTER TABLE online_players ADD COLUMN IF NOT EXISTS avatar_resolved TEXT;

-- Add timing columns to player_warns
ALTER TABLE player_warns ADD COLUMN IF NOT EXISTS show_delay_seconds INT DEFAULT 0;

-- Add timing columns to player_messages
ALTER TABLE player_messages ADD COLUMN IF NOT EXISTS show_delay_seconds INT DEFAULT 0;
