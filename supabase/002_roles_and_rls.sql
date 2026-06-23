-- ════════════════════════════════════════════════════════════
-- DraftHub — 002_roles_and_rls.sql
-- Системные роли, RLS, вспомогательные функции.
-- Применять после 001_initial_schema.sql
-- ════════════════════════════════════════════════════════════

-- ════ СИСТЕМНЫЕ РОЛИ ДЛЯ КОМАНД ════
-- Создаются для каждой команды триггером при INSERT в teams.
-- Ключи: manager | coach | captain | player | viewer
-- manager  — создатель команды, полный доступ, 1 на команду
-- coach    — тренер, пишет данные, управляет инвайтами
-- captain  — капитан, близко к coach, назначается manager/coach, 1 на команду
-- player   — игрок, читает данные
-- viewer   — минимальные права (санкция или технический доступ)

-- ════ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ════

-- Проверить глобальную роль через app_metadata JWT
-- Надёжнее отдельной таблицы: нельзя подделать через API
CREATE OR REPLACE FUNCTION app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'app_role';
$$;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS bool LANGUAGE sql STABLE AS $$
  SELECT app_role() = 'superadmin';
$$;

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS bool LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('superadmin', 'admin');
$$;

-- Получить роль пользователя в команде
CREATE OR REPLACE FUNCTION my_team_role(p_team_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.key FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
  LIMIT 1;
$$;

-- Получить sort_order роли (для проверки иерархии инвайтов)
CREATE OR REPLACE FUNCTION my_role_sort_order(p_team_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT r.sort_order FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
  LIMIT 1;
$$;

-- Проверка конкретного права через role_permissions
CREATE OR REPLACE FUNCTION has_permission(p_team_id uuid, p_permission_key text)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.team_id = p_team_id
      AND ur.user_id = auth.uid()
      AND p.key = p_permission_key
  );
$$;

-- Шорткаты для часто используемых прав
CREATE OR REPLACE FUNCTION can_write_team(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'write_data') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_roles(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'manage_roles') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_invites(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'manage_invites') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_read_game_data(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'read_game_data') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_read_roster(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'read_roster') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_export_sheets(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'export_sheets') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_delete_team_perm(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_permission(p_team_id, 'delete_team') OR is_superadmin();
$$;

-- ════ ТРИГГЕР: системные роли при создании команды ════
-- SECURITY DEFINER — пользователь ещё не член команды, RLS блокирует INSERT
CREATE OR REPLACE FUNCTION _create_default_roles(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_perm_ids  jsonb;
  v_role_id   uuid;

  -- Права по роли: ключи permissions.key
  manager_perms text[] := ARRAY['read_game_data','write_data','read_roster','write_roster',
                                  'manage_invites','manage_roles','export_sheets','delete_team'];
  coach_perms   text[] := ARRAY['read_game_data','write_data','read_roster','write_roster',
                                  'manage_invites','export_sheets'];
  captain_perms text[] := ARRAY['read_game_data','read_roster'];
  player_perms  text[] := ARRAY['read_game_data','read_roster'];
  viewer_perms  text[] := ARRAY[]::text[];

  role_def RECORD;
BEGIN
  -- Создаём роли и сразу назначаем права
  FOR role_def IN SELECT * FROM (VALUES
    ('manager', 'Manager', true, 1, 0, manager_perms),
    ('coach',   'Coach',   true, NULL, 1, coach_perms),
    ('captain', 'Captain', true, 1, 2, captain_perms),
    ('player',  'Player',  true, NULL, 3, player_perms),
    ('viewer',  'Viewer',  true, NULL, 4, viewer_perms)
  ) AS t(key, label, is_system, max_per_team, sort_order, perms)
  LOOP
    INSERT INTO roles (team_id, key, label, is_system, max_per_team, sort_order)
    VALUES (p_team_id, role_def.key, role_def.label, role_def.is_system,
            role_def.max_per_team, role_def.sort_order)
    RETURNING id INTO v_role_id;

    -- Назначаем права для этой роли
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key = ANY(role_def.perms);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION _trg_create_default_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM _create_default_roles(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_created_roles ON teams;
CREATE TRIGGER trg_team_created_roles
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION _trg_create_default_roles();

-- ════ RPC: create_team ════
-- Атомарно создаёт команду и добавляет создателя как manager
CREATE OR REPLACE FUNCTION create_team(p_name text, p_description text DEFAULT '')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_team       teams%ROWTYPE;
  v_manager_id uuid;
BEGIN
  INSERT INTO teams (name, slug, description, created_by)
  VALUES (
    p_name,
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')),
    p_description,
    auth.uid()
  )
  RETURNING * INTO v_team;

  -- Триггер уже создал роли, находим manager
  SELECT id INTO v_manager_id FROM roles
  WHERE team_id = v_team.id AND key = 'manager';

  -- Добавляем создателя
  INSERT INTO user_roles (user_id, role_id, team_id)
  VALUES (auth.uid(), v_manager_id, v_team.id);

  RETURN to_json(v_team);
END;
$$;

-- ════ RPC: accept_invite ════
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite    team_invites%ROWTYPE;
  v_user_id   uuid := auth.uid();
  v_role_key  text;
  v_inv_order int;
  v_my_order  int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM team_invites
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','invalid_or_expired');
  END IF;

  -- Проверяем: нельзя принять инвайт на роль выше своей
  SELECT sort_order INTO v_inv_order FROM roles WHERE id = v_invite.role_id;
  SELECT sort_order INTO v_my_order  FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.team_id = v_invite.team_id AND ur.user_id = v_user_id
    LIMIT 1;

  -- Если уже член команды и роль в инвайте выше текущей — запрещаем
  IF v_my_order IS NOT NULL AND v_inv_order < v_my_order THEN
    RETURN jsonb_build_object('error','cannot_upgrade_own_role');
  END IF;

  INSERT INTO user_roles (user_id, role_id, team_id, invited_by)
  VALUES (v_user_id, v_invite.role_id, v_invite.team_id, v_invite.created_by)
  ON CONFLICT (user_id, role_id, team_id) DO NOTHING;

  UPDATE team_invites SET uses = uses + 1 WHERE id = v_invite.id;

  SELECT key INTO v_role_key FROM roles WHERE id = v_invite.role_id;
  RETURN jsonb_build_object('ok', true, 'team_id', v_invite.team_id, 'role', v_role_key);
END;
$$;

-- view_shared_tier определена в 005_personal_tiers.sql —
-- там добавляется tier_set_id в tier_share_links которая нужна этой функции.
-- Здесь намеренно не объявляем чтобы избежать ошибки при применении 002
-- до 005 (колонка tier_set_id ещё не существует).

-- ════ RLS — включаем на всех таблицах ════
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_map_strength ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_synergy     ENABLE ROW LEVEL SECURITY;
ALTER TABLE players          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_data        ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_tier_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets_tokens    ENABLE ROW LEVEL SECURITY;
-- permissions — публичный справочник, RLS не нужен
-- user_roles — RLS ниже

-- ════ ПОЛИТИКИ ════

-- ── teams ──
CREATE POLICY "teams: members read" ON teams FOR SELECT
  USING (
    is_app_admin()
    OR EXISTS (SELECT 1 FROM user_roles WHERE team_id = teams.id AND user_id = auth.uid())
  );
CREATE POLICY "teams: authenticated create" ON teams
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "teams: managers update" ON teams FOR UPDATE
  USING (can_manage_roles(id));
CREATE POLICY "teams: permitted delete" ON teams FOR DELETE
  USING (can_delete_team_perm(id));

-- ── roles (per-team) ──
CREATE POLICY "roles: members read" ON roles FOR SELECT
  USING (
    team_id IS NULL  -- глобальные роли видят все авторизованные
    OR is_app_admin()
    OR EXISTS (SELECT 1 FROM user_roles WHERE team_id = roles.team_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM teams WHERE id = roles.team_id AND created_by = auth.uid())
  );
CREATE POLICY "roles: managers write" ON roles FOR INSERT
  WITH CHECK (can_manage_roles(team_id));
CREATE POLICY "roles: managers update" ON roles FOR UPDATE
  USING (can_manage_roles(team_id) AND NOT is_system);
CREATE POLICY "roles: managers delete" ON roles FOR DELETE
  USING (can_manage_roles(team_id) AND NOT is_system);

-- ── role_permissions ──
CREATE POLICY "role_perms: members read" ON role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      LEFT JOIN user_roles ur ON ur.team_id = r.team_id
      WHERE r.id = role_permissions.role_id
        AND (r.team_id IS NULL OR ur.user_id = auth.uid() OR is_app_admin())
    )
  );
CREATE POLICY "role_perms: managers write" ON role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id
        AND can_manage_roles(r.team_id)
    )
  );

-- ── user_roles ──
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles: self and managers read" ON user_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_app_admin()
    OR can_manage_roles(team_id)
    OR EXISTS (SELECT 1 FROM user_roles ur2
               JOIN roles r ON r.id = ur2.role_id
               WHERE ur2.team_id = user_roles.team_id AND ur2.user_id = auth.uid()
                 AND r.sort_order <= 2)  -- manager, coach, captain видят всех
  );
CREATE POLICY "user_roles: managers insert" ON user_roles FOR INSERT
  WITH CHECK (
    -- создатель добавляет себя при create_team (handled by RPC SECURITY DEFINER)
    is_app_admin()
    OR can_manage_roles(team_id)
  );
CREATE POLICY "user_roles: managers update" ON user_roles FOR UPDATE
  USING (can_manage_roles(team_id) OR is_app_admin());
CREATE POLICY "user_roles: self or managers delete" ON user_roles FOR DELETE
  USING (user_id = auth.uid() OR can_manage_roles(team_id) OR is_app_admin());

-- ── team_invites ──
-- Правило: можно создать инвайт только с ролью НЕ ВЫШЕ своей (sort_order >=)
CREATE POLICY "invites: managers read" ON team_invites FOR SELECT
  USING (can_manage_invites(team_id) OR is_app_admin());
CREATE POLICY "invites: managers create" ON team_invites FOR INSERT
  WITH CHECK (
    can_manage_invites(team_id)
    AND (
      SELECT r.sort_order FROM roles r WHERE r.id = role_id
    ) >= my_role_sort_order(team_id)
    -- viewer (sort_order=4) не может создавать инвайты вообще:
    AND my_team_role(team_id) != 'viewer'
  );
CREATE POLICY "invites: managers delete" ON team_invites FOR DELETE
  USING (can_manage_invites(team_id) OR is_app_admin());

-- ── heroes / maps / hero_map_strength / hero_synergy ──
CREATE POLICY "heroes: read"  ON heroes FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "heroes: write" ON heroes FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "maps: read"    ON maps   FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "maps: write"   ON maps   FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "hms: read"     ON hero_map_strength FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "hms: write"    ON hero_map_strength FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "syn: read"     ON hero_synergy      FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "syn: write"    ON hero_synergy      FOR ALL    USING (can_write_team(team_id));

-- ── players ──
CREATE POLICY "players: read"  ON players FOR SELECT USING (can_read_roster(team_id));
CREATE POLICY "players: write" ON players FOR ALL    USING (can_write_team(team_id));

-- ── tier_data ──
-- ВАЖНО: колонка scope добавляется в 005_personal_tiers.sql.
-- Здесь не используем scope в USING — иначе политика падает при применении 002
-- до 005. В 005 эти политики будут пересозданы с учётом scope.
CREATE POLICY "tiers: team read"  ON tier_data FOR SELECT USING (can_read_game_data(team_id) OR is_app_admin());
CREATE POLICY "tiers: team write" ON tier_data FOR ALL    USING (can_write_team(team_id) OR is_app_admin());
-- Политики для scope='personal' — в 005_personal_tiers.sql (scope добавляется там же)

-- ── global_tier_data ──
-- Политика чтения (USING true, включая anon) определена в 005_personal_tiers.sql —
-- там же DROP IF EXISTS чтобы не было конфликта. Здесь только write.
-- Пишет только superadmin — глобальный тир-лист меняет только admin UI.
CREATE POLICY "global_tiers: write" ON global_tier_data FOR ALL USING (is_superadmin());

-- ── tier_share_links ──
CREATE POLICY "share_links: owner"       ON tier_share_links FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "share_links: public read" ON tier_share_links FOR SELECT USING (is_public = true);

-- ── sheets_tokens ──
CREATE POLICY "sheets: read"  ON sheets_tokens FOR SELECT USING (can_export_sheets(team_id));
CREATE POLICY "sheets: write" ON sheets_tokens FOR ALL    USING (can_export_sheets(team_id));

-- ════ GRANTS для функций ════
GRANT EXECUTE ON FUNCTION public.create_team(text, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text)        TO authenticated;
-- view_shared_tierGranted в 005 (там же где объявлена)
GRANT EXECUTE ON FUNCTION public.app_role()                 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin()             TO authenticated;

-- ════ RPC: get_my_team_context ════
-- Возвращает команду + роль + массив прав за один запрос.
-- Используется в switchTeam() вместо трёхуровневого PostgREST JOIN
-- (user_roles → roles → role_permissions → permissions),
-- который ненадёжно работает в разных версиях PostgREST.
CREATE OR REPLACE FUNCTION get_my_team_context(p_team_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'team',        json_build_object('id', t.id, 'name', t.name, 'slug', t.slug),
    'role',        json_build_object('id', r.id, 'key', r.key, 'label', r.label, 'sort_order', r.sort_order),
    'permissions', COALESCE(
      (SELECT json_agg(p.key)
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = r.id),
      '[]'::json
    )
  )
  INTO v_result
  FROM user_roles ur
  JOIN teams t  ON t.id = ur.team_id
  JOIN roles r  ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id
    AND ur.user_id = auth.uid();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_context(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
