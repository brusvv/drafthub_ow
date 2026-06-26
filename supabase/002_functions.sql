-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 002_functions.sql
-- Применять после 001_tables.sql.
-- Содержит ВСЕ функции (хелперы + триггерные) и CREATE TRIGGER.
-- Каждая SECURITY DEFINER функция имеет SET search_path = public
-- чтобы исключить path-injection (требование Supabase Dashboard).
-- ════════════════════════════════════════════════════════════

-- ════ УТИЛИТЫ ════

-- Читает app_role из JWT-метаданных пользователя.
-- Не SECURITY DEFINER — не нужно, читает только auth.jwt().
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

-- ════ ХЕЛПЕРЫ КОМАНДЫ — SECURITY DEFINER ════
-- Все выполняются с правами владельца функции (обходят RLS на user_roles/roles),
-- поэтому SET search_path = public обязателен.

-- Ключ роли текущего пользователя в команде ('manager','coach',…)
CREATE OR REPLACE FUNCTION my_team_role(p_team_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT r.key FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
  LIMIT 1;
$$;

-- sort_order роли текущего пользователя (для проверки «можно ли пригласить на эту роль»)
CREATE OR REPLACE FUNCTION my_role_sort_order(p_team_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT r.sort_order FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
  LIMIT 1;
$$;

-- sort_order конкретной роли по id — нужна в RLS-политике team_invites
-- (inline subquery на roles там вызвала бы рекурсию через RLS)
CREATE OR REPLACE FUNCTION role_sort_order(p_role_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT sort_order FROM roles WHERE id = p_role_id;
$$;

-- Видит ли пользователь других участников команды (sort_order ≤ 2 = manager/coach/captain)
CREATE OR REPLACE FUNCTION can_see_team_members(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
      AND r.sort_order <= 2
  );
$$;

-- Базовая проверка наличия конкретного права у пользователя в команде
CREATE OR REPLACE FUNCTION has_permission(p_team_id uuid, p_permission_key text)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid()
      AND p.key = p_permission_key
  );
$$;

-- ════ ШОРТКАТЫ ДЛЯ ПРАВ — используются в RLS-политиках ════

CREATE OR REPLACE FUNCTION can_write_team(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'write_data') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_roles(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'manage_roles') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_invites(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'manage_invites') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_read_game_data(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'read_game_data') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_read_roster(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'read_roster') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_export_sheets(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'export_sheets') OR is_app_admin();
$$;

CREATE OR REPLACE FUNCTION can_delete_team_perm(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT has_permission(p_team_id, 'delete_team') OR is_superadmin();
$$;

-- ════ ТРИГГЕРНЫЕ ФУНКЦИИ ════
-- Переехали из 001_tables.sql — функции должны быть в одном месте с остальными.

-- Автообновление updated_at при UPDATE (используется на teams, heroes, maps, players, tier_data, personal_tier_sets)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Лимит 10 личных тир-листов на пользователя в команде
CREATE OR REPLACE FUNCTION _check_tier_set_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM personal_tier_sets
      WHERE user_id = NEW.user_id AND team_id = NEW.team_id) >= 10 THEN
    RAISE EXCEPTION 'max_personal_tier_sets';
  END IF;
  RETURN NEW;
END;
$$;

-- При удалении дефолтного тир-листа — назначаем следующий дефолтным
CREATE OR REPLACE FUNCTION _reassign_default_tier_set()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF OLD.is_default THEN
    UPDATE personal_tier_sets SET is_default = true
    WHERE id = (
      SELECT id FROM personal_tier_sets
      WHERE user_id = OLD.user_id AND team_id = OLD.team_id AND id <> OLD.id
      ORDER BY created_at LIMIT 1
    );
  END IF;
  RETURN OLD;
END;
$$;

-- ════ СИСТЕМНЫЕ РОЛИ — создаются триггером при INSERT в teams ════

-- Создаёт 5 системных ролей с правами по умолчанию для новой команды.
-- SECURITY DEFINER — вызывается из триггера, нужны права на запись в roles/role_permissions.
CREATE OR REPLACE FUNCTION _create_default_roles(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role_id     uuid;
  manager_perms text[] := ARRAY['read_game_data','write_data','read_roster','write_roster',
                                 'manage_invites','manage_roles','export_sheets','delete_team'];
  coach_perms   text[] := ARRAY['read_game_data','write_data','read_roster','write_roster',
                                 'manage_invites','export_sheets'];
  captain_perms text[] := ARRAY['read_game_data','read_roster'];
  player_perms  text[] := ARRAY['read_game_data','read_roster'];
  viewer_perms  text[] := ARRAY[]::text[];
  role_def RECORD;
BEGIN
  FOR role_def IN SELECT * FROM (VALUES
    ('manager', 'Manager', true, 1,    0, manager_perms),
    ('coach',   'Coach',   true, NULL, 1, coach_perms),
    ('captain', 'Captain', true, 1,    2, captain_perms),
    ('player',  'Player',  true, NULL, 3, player_perms),
    ('viewer',  'Viewer',  true, NULL, 4, viewer_perms)
  ) AS t(key, label, is_system, max_per_team, sort_order, perms)
  LOOP
    INSERT INTO roles (team_id, key, label, is_system, max_per_team, sort_order)
    VALUES (p_team_id, role_def.key, role_def.label, role_def.is_system,
            role_def.max_per_team, role_def.sort_order)
    RETURNING id INTO v_role_id;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key = ANY(role_def.perms);
  END LOOP;
END;
$$;

-- Обёртка для триггера AFTER INSERT ON teams
CREATE OR REPLACE FUNCTION _trg_create_default_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN PERFORM _create_default_roles(NEW.id); RETURN NEW; END;
$$;

-- ════ CREATE TRIGGER ════
-- Все триггеры здесь — функции выше уже определены.

DROP TRIGGER IF EXISTS trg_teams_updated     ON teams;
DROP TRIGGER IF EXISTS trg_heroes_updated    ON heroes;
DROP TRIGGER IF EXISTS trg_maps_updated      ON maps;
DROP TRIGGER IF EXISTS trg_players_updated   ON players;
DROP TRIGGER IF EXISTS trg_tier_updated      ON tier_data;
DROP TRIGGER IF EXISTS trg_tier_set_updated  ON personal_tier_sets;

CREATE TRIGGER trg_teams_updated    BEFORE UPDATE ON teams              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_heroes_updated   BEFORE UPDATE ON heroes             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_maps_updated     BEFORE UPDATE ON maps               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_players_updated  BEFORE UPDATE ON players            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tier_updated     BEFORE UPDATE ON tier_data          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tier_set_updated BEFORE UPDATE ON personal_tier_sets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tier_set_limit             ON personal_tier_sets;
DROP TRIGGER IF EXISTS trg_tier_set_reassign_default  ON personal_tier_sets;
DROP TRIGGER IF EXISTS trg_team_created_roles         ON teams;

CREATE TRIGGER trg_tier_set_limit
  BEFORE INSERT ON personal_tier_sets
  FOR EACH ROW EXECUTE FUNCTION _check_tier_set_limit();

CREATE TRIGGER trg_tier_set_reassign_default
  AFTER DELETE ON personal_tier_sets
  FOR EACH ROW EXECUTE FUNCTION _reassign_default_tier_set();

CREATE TRIGGER trg_team_created_roles
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION _trg_create_default_roles();
