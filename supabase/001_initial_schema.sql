-- ════════════════════════════════════════════════════════════
-- DraftHub — начальная схема БД
-- Применять: Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════

-- ── Расширения ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════ TEAMS ════
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,         -- URL-safe: "navi", "team-liquid"
  description text,
  logo_url    text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ════ TEAM MEMBERS ════
CREATE TABLE team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin','coach','player','viewer')),
  -- Привязка к игроку в ростере (только для role='player')
  player_name text,
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ════ INVITES ════
-- Инвайт-ссылки: /join/TOKEN
CREATE TABLE team_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  role        text NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin','coach','player','viewer')),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_uses    int DEFAULT NULL,             -- NULL = безлимит
  uses        int DEFAULT 0,
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

-- ════ HEROES (per-team) ════
CREATE TABLE heroes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('Tank','Damage','Support')),
  subrole     text,
  priority    int DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  banned      bool DEFAULT false,
  notes       text DEFAULT '',
  counters    jsonb DEFAULT '[]',           -- [{name, score}]
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

-- ════ MAPS (per-team) ════
CREATE TABLE maps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('Hybrid','Escort','Control','Push','Flashpoint','Clash')),
  tier        text DEFAULT 'B' CHECK (tier IN ('S','A','B','C','D')),
  priority    int DEFAULT 5,
  atk         int DEFAULT 3 CHECK (atk BETWEEN 1 AND 5),
  def         int DEFAULT 3 CHECK (def BETWEEN 1 AND 5),
  dif         int DEFAULT 3 CHECK (dif BETWEEN 1 AND 5),
  notes       text DEFAULT '',
  in_pool     bool DEFAULT true,
  preferred_heroes text[] DEFAULT '{}',
  ban_heroes  text[] DEFAULT '{}',
  counters    text[] DEFAULT '{}',
  comp        jsonb DEFAULT '[]',           -- [{hero, role, playerRole}]
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

-- ════ HERO MAP STRENGTH ════
CREATE TABLE hero_map_strength (
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_name   text NOT NULL,
  map_name    text NOT NULL,
  atk         int DEFAULT 0 CHECK (atk BETWEEN 0 AND 10),
  def         int DEFAULT 0 CHECK (def BETWEEN 0 AND 10),
  PRIMARY KEY (team_id, hero_name, map_name)
);

-- ════ HERO SYNERGY ════
CREATE TABLE hero_synergy (
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_name     text NOT NULL,
  synergy_hero  text NOT NULL,
  score         int DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  PRIMARY KEY (team_id, hero_name, synergy_hero)
);

-- ════ PLAYERS (ростер команды) ════
CREATE TABLE players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  btag        text,
  main_role   text,
  off_role    text,
  rank_tank   text,
  rank_dmg    text,
  rank_sup    text,
  notes       text DEFAULT '',
  main_heroes text[] DEFAULT '{}',
  pool_heroes text[] DEFAULT '{}',
  -- Привязка к auth.users если игрок зарегался
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

-- ════ TIER DATA ════
CREATE TABLE tier_data (
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('map','hero')),
  name        text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, entity_type, name)
);

-- ════ GOOGLE SHEETS BRIDGE ════
CREATE TABLE sheets_tokens (
  team_id     uuid PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  sheet_id    text NOT NULL,
  last_sync_at timestamptz,
  -- refresh_token хранится зашифрованным (опционально)
  -- используй Supabase Vault для продакшена
  created_at  timestamptz DEFAULT now()
);

-- ════ INDEXES ════
CREATE INDEX idx_team_members_user   ON team_members(user_id);
CREATE INDEX idx_team_members_team   ON team_members(team_id);
CREATE INDEX idx_heroes_team         ON heroes(team_id);
CREATE INDEX idx_maps_team           ON maps(team_id);
CREATE INDEX idx_players_team        ON players(team_id);
CREATE INDEX idx_players_user        ON players(user_id);
CREATE INDEX idx_hms_team_hero       ON hero_map_strength(team_id, hero_name);
CREATE INDEX idx_tier_team           ON tier_data(team_id);
CREATE INDEX idx_invites_token       ON team_invites(token);

-- ════ updated_at trigger ════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_heroes_updated   BEFORE UPDATE ON heroes   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_maps_updated     BEFORE UPDATE ON maps     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_players_updated  BEFORE UPDATE ON players  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tier_updated     BEFORE UPDATE ON tier_data FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teams_updated    BEFORE UPDATE ON teams    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
