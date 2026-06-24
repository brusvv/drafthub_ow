-- ════════════════════════════════════════════════════════════
-- DraftHub OW — patch_existing_db.sql
-- Патч для существующей БД (применять если НЕ пересоздаёшь с нуля).
-- Безопасно запускать повторно — все операции идемпотентны.
-- ════════════════════════════════════════════════════════════

-- ── 1. Добавить personal_tier_sets (если нет) ──
CREATE TABLE IF NOT EXISTS personal_tier_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Мой тирлист',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id, name)
);

-- ── 2. Добавить колонки tier_set_id ──
ALTER TABLE tier_data        ADD COLUMN IF NOT EXISTS tier_set_id uuid REFERENCES personal_tier_sets(id) ON DELETE CASCADE;
ALTER TABLE tier_share_links ADD COLUMN IF NOT EXISTS tier_set_id uuid REFERENCES personal_tier_sets(id) ON DELETE CASCADE;

-- ── 3. Добавить scope в tier_data (если нет) ──
ALTER TABLE tier_data ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'team' CHECK (scope IN ('team','personal'));
ALTER TABLE tier_data ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 4. Индексы ──
CREATE INDEX IF NOT EXISTS idx_tier_set_id     ON tier_data(tier_set_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user ON tier_share_links(user_id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_set_default
  ON personal_tier_sets(user_id, team_id) WHERE is_default = true;

-- ── 5. Grants ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_tier_sets TO authenticated;

-- ── 6. Триггеры для personal_tier_sets ──
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tier_set_updated') THEN
    CREATE TRIGGER trg_tier_set_updated
      BEFORE UPDATE ON personal_tier_sets
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tier_set_limit') THEN
    CREATE TRIGGER trg_tier_set_limit
      BEFORE INSERT ON personal_tier_sets
      FOR EACH ROW EXECUTE FUNCTION _check_tier_set_limit();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION _reassign_default_tier_set()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tier_set_reassign_default') THEN
    CREATE TRIGGER trg_tier_set_reassign_default
      AFTER DELETE ON personal_tier_sets
      FOR EACH ROW EXECUTE FUNCTION _reassign_default_tier_set();
  END IF;
END $$;

-- ── 7. RLS для personal_tier_sets ──
ALTER TABLE personal_tier_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_sets: owner"      ON personal_tier_sets;
DROP POLICY IF EXISTS "tier_sets: mgr read"   ON personal_tier_sets;
DROP POLICY IF EXISTS "tier_sets: admin read" ON personal_tier_sets;

CREATE POLICY "tier_sets: owner"      ON personal_tier_sets FOR ALL    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tier_sets: mgr read"   ON personal_tier_sets FOR SELECT USING (can_manage_roles(team_id));
CREATE POLICY "tier_sets: admin read" ON personal_tier_sets FOR SELECT USING (is_app_admin());
-- ── 8. Добавить RLS политики для personal tier_data ──
DROP POLICY IF EXISTS "tiers: personal read"  ON tier_data;
DROP POLICY IF EXISTS "tiers: personal write" ON tier_data;

CREATE POLICY "tiers: personal read" ON tier_data FOR SELECT
  USING (scope = 'personal' AND (
    user_id = auth.uid() OR is_app_admin() OR can_manage_roles(team_id)
    OR EXISTS (
      SELECT 1 FROM tier_share_links sl
      WHERE sl.tier_set_id = tier_data.tier_set_id
        AND (sl.is_public OR sl.user_id = auth.uid())
        AND (sl.expires_at IS NULL OR sl.expires_at > now())
    )
  ));
CREATE POLICY "tiers: personal write" ON tier_data FOR ALL
  USING  (scope = 'personal' AND user_id = auth.uid())
  WITH CHECK (scope = 'personal' AND user_id = auth.uid());

-- ── 9. ГЛАВНЫЙ ФИКС ИНВАЙТОВ ──
-- Добавляем SECURITY DEFINER функцию role_sort_order()
-- и пересоздаём политику без inline subquery (которая падала из-за RLS на roles)

CREATE OR REPLACE FUNCTION role_sort_order(p_role_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT sort_order FROM roles WHERE id = p_role_id;
$$;

GRANT EXECUTE ON FUNCTION public.role_sort_order(uuid) TO authenticated;

-- Пересоздаём политику инвайтов
DROP POLICY IF EXISTS "invites: managers create" ON team_invites;

CREATE POLICY "invites: managers create" ON team_invites FOR INSERT
  WITH CHECK (
    can_manage_invites(team_id)
    AND role_sort_order(role_id) >= my_role_sort_order(team_id)
    AND my_team_role(team_id) != 'viewer'
  );

-- ── 10. Новые RPC функции ──

-- get_team_members (читает auth.users через SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_team_members(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE team_id = p_team_id AND user_id = auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',        ur.id,
      'joined_at', ur.joined_at,
      'role_id',   ur.role_id,
      'roles',     jsonb_build_object('id', r.id, 'key', r.key, 'label', r.label,
                                       'sort_order', r.sort_order, 'is_system', r.is_system),
      'users',     jsonb_build_object('id', u.id, 'email', u.email,
                                       'raw_user_meta_data', u.raw_user_meta_data)
    ) ORDER BY ur.joined_at
  ) INTO v_result
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.team_id = p_team_id;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members(uuid) TO authenticated;

-- rename_team
CREATE OR REPLACE FUNCTION rename_team(p_team_id uuid, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid() AND r.key = 'manager'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_permissions');
  END IF;
  UPDATE teams SET name = trim(p_name) WHERE id = p_team_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_team(uuid, text) TO authenticated;

-- create_tier_set
CREATE OR REPLACE FUNCTION create_tier_set(p_team_id uuid, p_name text DEFAULT 'Мой тирлист')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_set        personal_tier_sets%ROWTYPE;
  v_is_default boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_is_default := NOT EXISTS (
    SELECT 1 FROM personal_tier_sets WHERE user_id = auth.uid() AND team_id = p_team_id
  );
  INSERT INTO personal_tier_sets (user_id, team_id, name, is_default)
  VALUES (auth.uid(), p_team_id, p_name, v_is_default)
  RETURNING * INTO v_set;
  RETURN to_json(v_set);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tier_set(uuid, text) TO authenticated;
-- set_default_tier_set
CREATE OR REPLACE FUNCTION set_default_tier_set(p_set_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_set personal_tier_sets%ROWTYPE;
BEGIN
  SELECT * INTO v_set FROM personal_tier_sets
  WHERE id = p_set_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE personal_tier_sets SET is_default = false
  WHERE user_id = auth.uid() AND team_id = v_set.team_id;
  UPDATE personal_tier_sets SET is_default = true WHERE id = p_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_default_tier_set(uuid) TO authenticated;

-- view_shared_tier (обновлённая с tier_set_name и фильтром)
CREATE OR REPLACE FUNCTION view_shared_tier(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_link tier_share_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM tier_share_links
  WHERE token = p_token AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v_link.is_public THEN
    IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','private_link_requires_auth'); END IF;
    IF auth.uid() != v_link.user_id AND NOT can_manage_roles(v_link.team_id) THEN
      RETURN jsonb_build_object('error','no_access');
    END IF;
  END IF;
  UPDATE tier_share_links SET views = views + 1 WHERE id = v_link.id;
  RETURN jsonb_build_object(
    'ok',           true,
    'label',        v_link.label,
    'user_id',      v_link.user_id,
    'team_id',      v_link.team_id,
    'entity_type',  v_link.entity_type,
    'tier_set_name',(SELECT name FROM personal_tier_sets WHERE id = v_link.tier_set_id),
    'tiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entity_type', entity_type, 'name', name, 'tier', tier
      ) ORDER BY entity_type, name)
      FROM tier_data
      WHERE tier_set_id = v_link.tier_set_id
        AND (v_link.entity_type = 'both' OR entity_type = v_link.entity_type)
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_shared_tier(text) TO anon, authenticated;

-- set_user_app_role (суперадмин)
CREATE OR REPLACE FUNCTION set_user_app_role(p_email text, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_target_id uuid;
BEGIN
  IF NOT is_superadmin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'superadmin_only');
  END IF;
  IF p_role NOT IN ('superadmin', 'admin', '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;
  SELECT id INTO v_target_id FROM auth.users WHERE email = p_email;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'user_not_found'); END IF;
  IF p_role = '' THEN
    UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'app_role' WHERE id = v_target_id;
  ELSE
    UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('app_role', p_role)
    WHERE id = v_target_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_app_role(text, text) TO authenticated;

-- admin_get_all_teams
CREATE OR REPLACE FUNCTION admin_get_all_teams()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_app_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'slug', t.slug, 'created_at', t.created_at,
      'member_count',(SELECT COUNT(*) FROM user_roles WHERE team_id = t.id)
    ) ORDER BY t.created_at DESC)
    FROM teams t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_teams() TO authenticated;
-- admin_get_all_users
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_superadmin() THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email,
      'app_role', u.raw_app_meta_data ->> 'app_role',
      'created_at', u.created_at
    ) ORDER BY u.created_at DESC)
    FROM auth.users u
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

NOTIFY pgrst, 'reload schema';
