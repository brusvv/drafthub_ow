-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 001_tables.sql
-- Применять первым.
-- Содержит ТОЛЬКО DDL (CREATE TABLE, CREATE INDEX, GRANT).
-- Функции и триггеры — в 002_functions.sql.
-- Таблицы, индексы, триггеры, grants.
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Teams ──
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  logo_url    text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Permissions справочник ──
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  label       text NOT NULL,
  description text,
  category    text NOT NULL CHECK (category IN ('team','data','roster','admin'))
);

INSERT INTO permissions (key, label, description, category) VALUES
  ('read_game_data',  'Просматривать данные',    'Герои, карты, тир-листы',   'data'),
  ('write_data',      'Редактировать данные',     'Герои, карты, оценки',      'data'),
  ('read_roster',     'Просматривать состав',     'Игроки, роли, пул',         'roster'),
  ('write_roster',    'Редактировать состав',     'Добавлять/удалять игроков', 'roster'),
  ('manage_invites',  'Управлять инвайтами',      'Создавать и удалять ссылки','team'),
  ('manage_roles',    'Управлять ролями',         'Назначать роли участникам', 'team'),
  ('export_sheets',   'Экспорт в Google Sheets',  '',                          'team'),
  ('delete_team',     'Удалить команду',          '',                          'team');

-- ── Roles ──
CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid REFERENCES teams(id) ON DELETE CASCADE,
  key          text NOT NULL,
  label        text NOT NULL,
  is_system    bool DEFAULT false,
  max_per_team int,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(team_id, key)
);

-- Глобальные роли приложения (team_id = NULL)
INSERT INTO roles (team_id, key, label, is_system, sort_order) VALUES
  (NULL, 'superadmin', 'Superadmin', true, 0),
  (NULL, 'admin',      'Admin',      true, 1);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── Users & invites ──
CREATE TABLE user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  team_id     uuid REFERENCES teams(id) ON DELETE CASCADE,
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id, team_id)
);

CREATE TABLE team_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id),
  token       text UNIQUE NOT NULL DEFAULT replace(replace(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+', '-'), '/', '_'),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_uses    int DEFAULT NULL,
  uses        int DEFAULT 0,
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

-- ── Game data (per-team) ──
CREATE TABLE heroes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       text NOT NULL,
  role       text NOT NULL CHECK (role IN ('Tank','Damage','Support')),
  subrole    text,
  priority   int DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  banned     bool DEFAULT false,
  notes      text DEFAULT '',
  counters   jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

CREATE TABLE maps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('Hybrid','Escort','Control','Push','Flashpoint','Clash')),
  tier             text DEFAULT 'B' CHECK (tier IN ('S','A','B','C','D')),
  priority         int DEFAULT 5,
  atk              int DEFAULT 3 CHECK (atk BETWEEN 1 AND 5),
  def              int DEFAULT 3 CHECK (def BETWEEN 1 AND 5),
  dif              int DEFAULT 3 CHECK (dif BETWEEN 1 AND 5),
  notes            text DEFAULT '',
  in_pool          bool DEFAULT true,
  preferred_heroes text[] DEFAULT '{}',
  ban_heroes       text[] DEFAULT '{}',
  counters         text[] DEFAULT '{}',
  comp             jsonb DEFAULT '[]',
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

CREATE TABLE hero_map_strength (
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_name text NOT NULL,
  map_name  text NOT NULL,
  atk       int DEFAULT 0 CHECK (atk BETWEEN 0 AND 10),
  def       int DEFAULT 0 CHECK (def BETWEEN 0 AND 10),
  PRIMARY KEY (team_id, hero_name, map_name)
);

CREATE TABLE hero_synergy (
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_name    text NOT NULL,
  synergy_hero text NOT NULL,
  score        int DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  PRIMARY KEY (team_id, hero_name, synergy_hero)
);

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
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, name)
);

-- ── Tier lists ──
-- personal_tier_sets объявлена ниже — FK добавляем через ALTER TABLE
CREATE TABLE tier_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scope       text NOT NULL DEFAULT 'team' CHECK (scope IN ('team','personal')),
  entity_type text NOT NULL CHECK (entity_type IN ('map','hero')),
  name        text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  position    SMALLINT NOT NULL DEFAULT 0,
  tier_set_id uuid,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE global_tier_data (
  entity_type text NOT NULL CHECK (entity_type IN ('map','hero')),
  name        text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  position    SMALLINT NOT NULL DEFAULT 0,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (entity_type, name)
);

CREATE TABLE tier_share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text UNIQUE NOT NULL DEFAULT replace(replace(rtrim(encode(gen_random_bytes(20), 'base64'), '='), '+', '-'), '/', '_'),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('map','hero','both')),
  label       text,
  is_public   bool DEFAULT false,
  views       int DEFAULT 0,
  expires_at  timestamptz,
  tier_set_id uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE personal_tier_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Мой тирлист',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id, name)
);

-- Теперь добавляем FK на personal_tier_sets
ALTER TABLE tier_data ADD CONSTRAINT fk_tier_data_tier_set
  FOREIGN KEY (tier_set_id) REFERENCES personal_tier_sets(id) ON DELETE CASCADE;
ALTER TABLE tier_share_links ADD CONSTRAINT fk_share_links_tier_set
  FOREIGN KEY (tier_set_id) REFERENCES personal_tier_sets(id) ON DELETE CASCADE;

CREATE TABLE sheets_tokens (
  team_id      uuid PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  sheet_id     text NOT NULL,
  last_sync_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ════ INDEXES ════
CREATE INDEX idx_user_roles_user   ON user_roles(user_id);
CREATE INDEX idx_user_roles_team   ON user_roles(team_id);
CREATE INDEX idx_heroes_team       ON heroes(team_id);
CREATE INDEX idx_maps_team         ON maps(team_id);
CREATE INDEX idx_players_team      ON players(team_id);
CREATE INDEX idx_players_user      ON players(user_id);
CREATE INDEX idx_hms_team_hero     ON hero_map_strength(team_id, hero_name);
CREATE INDEX idx_invites_token     ON team_invites(token);
CREATE INDEX idx_share_links_token ON tier_share_links(token);
CREATE INDEX idx_share_links_user  ON tier_share_links(user_id, team_id);
CREATE INDEX idx_tier_set_id       ON tier_data(tier_set_id);
CREATE INDEX idx_global_tiers_order ON global_tier_data(entity_type, position);

CREATE UNIQUE INDEX idx_tier_team_unique
  ON tier_data(team_id, entity_type, name) WHERE scope = 'team';
CREATE UNIQUE INDEX idx_tier_personal_unique
  ON tier_data(tier_set_id, entity_type, name) WHERE scope = 'personal';
CREATE UNIQUE INDEX idx_tier_set_default
  ON personal_tier_sets(user_id, team_id) WHERE is_default = true;

-- (Триггерные функции и CREATE TRIGGER перенесены в 002_functions.sql)
-- ════ GRANTS ════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heroes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_map_strength   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_synergy        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_data           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_tier_data    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_share_links    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheets_tokens       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_tier_sets  TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT ON public.tier_share_links TO anon;
GRANT SELECT ON public.tier_data        TO anon;
GRANT SELECT ON public.global_tier_data TO anon;
