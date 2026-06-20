-- ════════════════════════════════════════════════════════════
-- DraftHub — три уровня тир-листов
-- Применять после 004_update_data_policies.sql
-- ════════════════════════════════════════════════════════════

-- ════ GLOBAL TIER DATA ════
-- Один на всё приложение, редактирует только суперадмин через
-- специальный флаг в auth.users (app_metadata.is_superadmin = true)
CREATE TABLE global_tier_data (
  entity_type  text NOT NULL CHECK (entity_type IN ('map','hero')),
  name         text NOT NULL,
  tier         text NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (entity_type, name)
);

ALTER TABLE global_tier_data ENABLE ROW LEVEL SECURITY;

-- Читают все авторизованные
CREATE POLICY "global_tiers: authenticated read" ON global_tier_data
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Пишет только суперадмин (app_metadata.is_superadmin = true)
-- Устанавливается через Supabase dashboard → Users → Edit user → app_metadata
CREATE POLICY "global_tiers: superadmin write" ON global_tier_data
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::bool IS TRUE
  );

-- ════ TIER DATA — расширяем существующую таблицу ════
-- Добавляем scope ('team' | 'personal') и user_id для личных тир-листов
ALTER TABLE tier_data ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'team'
  CHECK (scope IN ('team','personal'));
ALTER TABLE tier_data ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Уникальность: для командных — (team_id, entity_type, name, scope='team')
--               для личных    — (team_id, entity_type, name, user_id)
ALTER TABLE tier_data DROP CONSTRAINT IF EXISTS tier_data_pkey;
ALTER TABLE tier_data ADD PRIMARY KEY (team_id, entity_type, name, scope, user_id);

-- Частичный индекс чтобы user_id мог быть NULL для командных
CREATE UNIQUE INDEX idx_tier_team_unique
  ON tier_data (team_id, entity_type, name)
  WHERE scope = 'team';

CREATE INDEX idx_tier_personal_user ON tier_data(team_id, user_id) WHERE scope = 'personal';

-- ════ PERSONAL TIER SHARE LINKS ════
-- Пользователь может поделиться ссылкой /tier/TOKEN
CREATE TABLE tier_share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(20), 'base64url'),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('map','hero','both')),
  label       text,                          -- необязательное название "Мой тирлист S14"
  is_public   bool DEFAULT false,            -- виден всем по ссылке без авторизации
  views       int DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT NULL       -- NULL = не истекает
);

ALTER TABLE tier_share_links ENABLE ROW LEVEL SECURITY;

-- Владелец видит и управляет своими ссылками
CREATE POLICY "share_links: owner manage" ON tier_share_links
  FOR ALL USING (user_id = auth.uid());

-- Публичные ссылки видны всем (для просмотра по токену)
CREATE POLICY "share_links: public read" ON tier_share_links
  FOR SELECT USING (is_public = true OR user_id = auth.uid());

CREATE INDEX idx_share_links_token ON tier_share_links(token);
CREATE INDEX idx_share_links_user  ON tier_share_links(user_id, team_id);

-- ════ ОБНОВЛЯЕМ RLS для tier_data ════
DROP POLICY IF EXISTS "tiers: any member read"  ON tier_data;
DROP POLICY IF EXISTS "tiers: write by permission" ON tier_data;

-- Командный тир-лист: члены команды с can_read_game_data
CREATE POLICY "tiers: team scope read" ON tier_data FOR SELECT
  USING (
    scope = 'team'
    AND (
      -- admin/coach читают
      can_read_game_data(team_id)
      -- специальная роль "team_<slug>" через кастомную роль
      OR EXISTS (
        SELECT 1 FROM team_members tm
        JOIN team_roles tr ON tr.id = tm.role_id
        WHERE tm.team_id = tier_data.team_id
          AND tm.user_id = auth.uid()
          AND (tr.can_read_game_data OR tr.key LIKE 'team_%')
      )
    )
  );

-- Личный тир-лист: владелец всегда; admin команды видит всех; публичный по share_link
CREATE POLICY "tiers: personal scope read" ON tier_data FOR SELECT
  USING (
    scope = 'personal'
    AND (
      user_id = auth.uid()   -- сам владелец
      OR can_manage_roles(team_id)    -- admin команды видит всех
      OR EXISTS (            -- есть активный share_link
        SELECT 1 FROM tier_share_links sl
        WHERE sl.user_id = tier_data.user_id
          AND sl.team_id = tier_data.team_id
          AND (sl.is_public = true OR sl.user_id = auth.uid())
          AND (sl.expires_at IS NULL OR sl.expires_at > now())
      )
    )
  );

-- Командный тир-лист пишет coach+
CREATE POLICY "tiers: team scope write" ON tier_data FOR ALL
  USING (scope = 'team' AND can_write_team(team_id));

-- Личный тир-лист пишет только владелец
CREATE POLICY "tiers: personal scope write" ON tier_data FOR ALL
  USING (scope = 'personal' AND user_id = auth.uid());

-- ════ RPC: просмотр тир-листа по токену ════
-- Увеличивает счётчик просмотров и возвращает данные
CREATE OR REPLACE FUNCTION view_shared_tier(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_link tier_share_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM tier_share_links
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  -- Если ссылка не публичная — нужна авторизация и совпадение владельца
  -- или прав can_manage_roles (admin команды может смотреть приватные ссылки)
  IF NOT v_link.is_public THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('error','private_link_requires_auth');
    END IF;
    IF auth.uid() != v_link.user_id AND NOT can_manage_roles(v_link.team_id) THEN
      RETURN jsonb_build_object('error','no_access');
    END IF;
  END IF;

  -- Увеличиваем счётчик просмотров
  UPDATE tier_share_links SET views = views + 1 WHERE id = v_link.id;

  -- Возвращаем тир-лист
  RETURN jsonb_build_object(
    'ok', true,
    'label', v_link.label,
    'user_id', v_link.user_id,
    'team_id', v_link.team_id,
    'entity_type', v_link.entity_type,
    'tiers', (
      SELECT jsonb_agg(jsonb_build_object('entity_type',entity_type,'name',name,'tier',tier))
      FROM tier_data
      WHERE team_id = v_link.team_id
        AND user_id = v_link.user_id
        AND scope = 'personal'
        AND (v_link.entity_type = 'both' OR entity_type = v_link.entity_type)
    )
  );
END;
$$;

-- Разрешаем анонимный вызов RPC (для просмотра публичных ссылок без логина)
GRANT EXECUTE ON FUNCTION view_shared_tier(text) TO anon, authenticated;
