-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 004_rpc.sql
-- Применять после 003_rls.sql.
-- Публичные RPC (вызываются из JS через _sb.rpc()) + суперадмин RPC.
-- ВСЕ функции: SECURITY DEFINER + SET search_path = public.
-- ════════════════════════════════════════════════════════════

-- ── create_team ──
-- Атомарно создаёт команду и добавляет создателя как manager.
-- SECURITY DEFINER нужен — триггер создаёт роли, а user ещё не member.
CREATE OR REPLACE FUNCTION create_team(p_name text, p_description text DEFAULT '')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_team       teams%ROWTYPE;
  v_manager_id uuid;
BEGIN
  INSERT INTO teams (name, slug, description, created_by)
  VALUES (p_name,
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')),
    p_description, auth.uid())
  RETURNING * INTO v_team;

  -- Триггер trg_team_created_roles создал роли — берём manager
  SELECT id INTO v_manager_id FROM roles
  WHERE team_id = v_team.id AND key = 'manager';

  INSERT INTO user_roles (user_id, role_id, team_id)
  VALUES (auth.uid(), v_manager_id, v_team.id);

  RETURN to_json(v_team);
END;
$$;

-- ── accept_invite ──
-- Принимает инвайт по токену. Нельзя самоповышение (проверка sort_order).
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
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
    AND (max_uses   IS NULL OR uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','invalid_or_expired');
  END IF;

  -- Нельзя приглашение на роль с бо́льшим доступом чем у пригласившего
  SELECT sort_order INTO v_inv_order FROM roles WHERE id = v_invite.role_id;
  SELECT sort_order INTO v_my_order  FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.team_id = v_invite.team_id AND ur.user_id = v_user_id
    LIMIT 1;

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

-- ── get_my_team_context ──
-- Одним запросом: команда + роль + права пользователя.
-- Используется в session.js switchTeam() вместо трёхуровневого PostgREST JOIN.
CREATE OR REPLACE FUNCTION get_my_team_context(p_team_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  SELECT json_build_object(
    'team',        json_build_object('id', t.id, 'name', t.name, 'slug', t.slug),
    'role',        json_build_object('id', r.id, 'key', r.key, 'label', r.label, 'sort_order', r.sort_order),
    'permissions', COALESCE(
      (SELECT json_agg(p.key) FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = r.id), '[]'::json)
  )
  INTO v_result
  FROM user_roles ur
  JOIN teams t ON t.id = ur.team_id
  JOIN roles  r ON r.id = ur.role_id
  WHERE ur.team_id = p_team_id AND ur.user_id = auth.uid();
  RETURN v_result;
END;
$$;

-- ── get_team_members ──
-- Читает auth.users напрямую — недоступно через обычный PostgREST SELECT.
CREATE OR REPLACE FUNCTION get_team_members(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  -- Только участник команды может получить список
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
  JOIN roles r      ON r.id = ur.role_id
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.team_id = p_team_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── rename_team ──
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

-- ── create_tier_set ──
-- Создаёт именованный тир-лист; первый автоматически становится дефолтным.
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

-- ── set_default_tier_set ──
CREATE OR REPLACE FUNCTION set_default_tier_set(p_set_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_set personal_tier_sets%ROWTYPE;
BEGIN
  SELECT * INTO v_set FROM personal_tier_sets
  WHERE id = p_set_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  -- Снимаем дефолт со всех остальных сетов пользователя в этой команде
  UPDATE personal_tier_sets SET is_default = false
  WHERE user_id = auth.uid() AND team_id = v_set.team_id;
  UPDATE personal_tier_sets SET is_default = true WHERE id = p_set_id;
END;
$$;

-- ── view_shared_tier ──
-- Просмотр тир-листа по токену — работает без авторизации (anon) для публичных.
-- Возвращает tier_set_name для отображения в заголовке share-страницы.
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
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('error','private_link_requires_auth');
    END IF;
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

-- ════ СУПЕРАДМИН RPC ════
-- Доступны только пользователям с app_role = 'superadmin' / 'admin' в JWT.
-- Назначить первого superadmin вручную через Supabase Dashboard → Authentication → Users
-- или SQL: UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"app_role":"superadmin"}'
--           WHERE email = 'your@email.com';

-- ── set_user_app_role ──
-- Назначить/снять глобальную роль другому пользователю (только superadmin).
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

-- ── admin_get_all_teams ──
CREATE OR REPLACE FUNCTION admin_get_all_teams()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_app_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id',          t.id,
      'name',        t.name,
      'slug',        t.slug,
      'created_at',  t.created_at,
      'member_count',(SELECT COUNT(*) FROM user_roles WHERE team_id = t.id)
    ) ORDER BY t.created_at DESC)
    FROM teams t
  );
END;
$$;

-- ── admin_get_all_users ──
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_superadmin() THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id',         u.id,
      'email',      u.email,
      'app_role',   u.raw_app_meta_data ->> 'app_role',
      'created_at', u.created_at
    ) ORDER BY u.created_at DESC)
    FROM auth.users u
  );
END;
$$;

-- ════ GRANTS ════
GRANT EXECUTE ON FUNCTION public.app_role()                      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(text, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_team_context(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_team(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tier_set(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_tier_set(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.view_shared_tier(text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_app_role(text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_teams()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users()           TO authenticated;

NOTIFY pgrst, 'reload schema';
