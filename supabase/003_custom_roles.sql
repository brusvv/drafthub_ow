-- ════════════════════════════════════════════════════════════
-- DraftHub — кастомные роли с гибкими правами
-- Применять после 001 и 002.
--
-- Идея: вместо жёсткого CHECK(role IN (4 варианта)) вводим
-- таблицу team_roles с битовыми правами. admin/coach/player/viewer
-- становятся обычными СТРОКАМИ в этой таблице (создаются автоматически
-- для каждой новой команды), но admin может добавить кастомную роль
-- поверх них, например "Аналитик" или "Скрытая роль для админов".
-- ════════════════════════════════════════════════════════════

-- ════ ROLE DEFINITIONS (per-team) ════
CREATE TABLE team_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  key          text NOT NULL,              -- 'admin' | 'coach' | 'player' | 'viewer' | 'custom_xxx'
  label        text NOT NULL,              -- отображаемое имя: "Аналитик"
  -- Права — булевы флаги, легко добавлять новые без миграции схемы
  can_read_game_data   bool DEFAULT true,   -- герои/карты/тиры
  can_read_roster      bool DEFAULT true,   -- состав/игроки
  can_write_data        bool DEFAULT false, -- редактировать героев/карты
  can_manage_roles      bool DEFAULT false, -- создавать роли, назначать
  can_manage_invites    bool DEFAULT false, -- создавать инвайт-ссылки
  can_export_sheets     bool DEFAULT false, -- Google Sheets экспорт
  can_delete_team       bool DEFAULT false,
  is_hidden             bool DEFAULT false, -- "видна только админам" — не показывается в публичном списке ролей
  is_system             bool DEFAULT false, -- встроенная роль (admin/coach/player/viewer) — нельзя удалить
  sort_order             int DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(team_id, key)
);

-- ════ Обновляем team_members — ссылка на роль вместо enum ════
-- Старое поле role (text) оставляем для совместимости при миграции,
-- но реальные права теперь читаются через role_id
ALTER TABLE team_members ADD COLUMN role_id uuid REFERENCES team_roles(id);

-- ════ Функция: создать 4 системные роли при создании команды ════
CREATE OR REPLACE FUNCTION create_default_roles(p_team_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO team_roles (team_id, key, label, can_read_game_data, can_read_roster,
    can_write_data, can_manage_roles, can_manage_invites, can_export_sheets,
    can_delete_team, is_hidden, is_system, sort_order)
  VALUES
    (p_team_id, 'admin',  'Admin',  true,  true,  true,  true,  true,  true,  true,  false, true, 0),
    (p_team_id, 'coach',  'Coach',  true,  true,  true,  false, true,  true,  false, false, true, 1),
    (p_team_id, 'player', 'Player', true,  true,  false, false, false, false, false, false, true, 2),
    (p_team_id, 'viewer', 'Viewer', false, false, false, false, false, false, false, false, true, 3);
  -- viewer: can_read_game_data=false означает "не видит героев/карты в общем смысле",
  -- но tier_data политика отдельно разрешает viewer'у видеть тир-листы (см. 002_rls.sql)
END;
$$;

-- ════ Триггер: при создании команды — сразу создаём роли ════
CREATE OR REPLACE FUNCTION _trg_create_default_roles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM create_default_roles(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_team_created_roles
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION _trg_create_default_roles();

-- ════ Обновляем createTeam-flow: admin-участник получает role_id ════
-- (это делается в JS при INSERT в team_members — см. team.js createTeam)

-- ════ Вспомогательные функции — переписаны под role_id ════
CREATE OR REPLACE FUNCTION my_team_permissions(p_team_id uuid)
RETURNS team_roles LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tr.* FROM team_members tm
  JOIN team_roles tr ON tr.id = tm.role_id
  WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION can_write_team(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_write_data FROM my_team_permissions(p_team_id)), false);
$$;

CREATE OR REPLACE FUNCTION can_manage_roles(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_manage_roles FROM my_team_permissions(p_team_id)), false);
$$;

CREATE OR REPLACE FUNCTION can_read_roster(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_read_roster FROM my_team_permissions(p_team_id)), false);
$$;

CREATE OR REPLACE FUNCTION can_read_game_data(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_read_game_data FROM my_team_permissions(p_team_id)), false);
$$;

-- ════ RLS: team_roles ════
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;

-- Видимые роли: все НЕ-скрытые роли видят все члены команды;
-- скрытые роли (is_hidden=true) видят только те у кого can_manage_roles=true
CREATE POLICY "roles: visible to members" ON team_roles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = team_roles.team_id AND user_id = auth.uid())
    AND (NOT is_hidden OR can_manage_roles(team_id))
  );

CREATE POLICY "roles: managers create" ON team_roles FOR INSERT
  WITH CHECK (can_manage_roles(team_id));
CREATE POLICY "roles: managers update" ON team_roles FOR UPDATE
  USING (can_manage_roles(team_id) AND NOT is_system);  -- системные роли не редактируются
CREATE POLICY "roles: managers delete" ON team_roles FOR DELETE
  USING (can_manage_roles(team_id) AND NOT is_system);

-- ════ Обновляем accept_invite() — теперь работает с role_id ════
-- team_invites тоже нужно перевести на role_id
ALTER TABLE team_invites ADD COLUMN role_id uuid REFERENCES team_roles(id);

CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite  team_invites%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_role_label text;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;

  SELECT * INTO v_invite FROM team_invites
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid_or_expired'); END IF;

  INSERT INTO team_members(team_id, user_id, role_id)
  VALUES (v_invite.team_id, v_user_id, v_invite.role_id)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id;

  UPDATE team_invites SET uses = uses + 1 WHERE id = v_invite.id;

  SELECT label INTO v_role_label FROM team_roles WHERE id = v_invite.role_id;
  RETURN jsonb_build_object('ok', true, 'team_id', v_invite.team_id, 'role', v_role_label);
END;
$$;
