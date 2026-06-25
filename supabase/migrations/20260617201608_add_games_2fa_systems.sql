
-- Managed games list
CREATE TABLE IF NOT EXISTS managed_games (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_url TEXT,
  universe_id TEXT,
  kill_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2FA codes
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  action TEXT,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE managed_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_managed_games" ON managed_games FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_two_factor_codes" ON two_factor_codes FOR ALL TO anon USING (true) WITH CHECK (true);

-- Update game_stats discord webhook default
UPDATE game_stats SET discord_webhook_url = 'https://discord.com/api/webhooks/1519070366109274215/45027CrrqLHeadS3_or8WwZi_5IIOK3NarkQHoHGau4LGM5basj_F94uS0TH-TZH1-8l' WHERE id = 1;
