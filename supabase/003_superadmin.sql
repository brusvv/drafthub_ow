-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 003_superadmin.sql
-- Как стать superadmin/admin + инструкция
-- Применять после 002_functions_and_rls.sql
-- ════════════════════════════════════════════════════════════

-- Назначить superadmin (выполнять вручную, подставить реальный email):
-- UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"app_role":"superadmin"}'
--   WHERE email = 'your@email.com';

-- Назначить admin:
-- UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'
--   WHERE email = 'your@email.com';

-- Снять роль:
-- UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data - 'app_role'
--   WHERE email = 'your@email.com';

-- ── RPC для суперадмина — назначить app_role другому пользователю ──
-- (вызывается из admin UI, сам суперадмин может назначать admin/superadmin)
CREATE OR REPLACE FUNCTION set_user_app_role(p_email text, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_target_id uuid;
BEGIN
  IF NOT is_superadmin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'superadmin_only');
  END IF;

  IF p_role NOT IN ('superadmin', 'admin', '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  SELECT id INTO v_target_id FROM auth.users WHERE email = p_email;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  IF p_role = '' THEN
    UPDATE auth.users
      SET raw_app_meta_data = raw_app_meta_data - 'app_role'
      WHERE id = v_target_id;
  ELSE
    UPDATE auth.users
      SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('app_role', p_role)
      WHERE id = v_target_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_app_role(text, text) TO authenticated;

-- ── RPC для суперадмина — список всех команд ──
CREATE OR REPLACE FUNCTION admin_get_all_teams()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.admin_get_all_teams() TO authenticated;

-- ── RPC для суперадмина — список всех пользователей ──
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT is_superadmin() THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id',       u.id,
      'email',    u.email,
      'app_role', u.raw_app_meta_data ->> 'app_role',
      'created_at', u.created_at
    ) ORDER BY u.created_at DESC)
    FROM auth.users u
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
