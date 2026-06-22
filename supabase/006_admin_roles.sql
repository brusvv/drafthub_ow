-- ════════════════════════════════════════════════════════════
-- DraftHub — 006_admin_roles.sql
-- Фаза 7: RPC для глобальной admin-панели (render-admin.js).
--
-- app_role() / is_superadmin() / is_app_admin() уже определены в 002 —
-- они читают auth.users.app_metadata.app_role (JWT-claim, не подделать
-- через клиентский SDK). Эта миграция добавляет только то, чего не было:
-- способ ПРОЧИТАТЬ список пользователей и способ ИЗМЕНИТЬ им app_role,
-- раз сама auth.users не в exposed-схеме и недоступна через обычный
-- PostgREST SELECT/UPDATE.
--
-- Применять после 001 → 002 → 005.
-- ════════════════════════════════════════════════════════════

-- ════ RPC: list_app_users ════
-- Список всех пользователей с их текущей глобальной ролью.
-- Доступен admin и superadmin (на чтение) — конкретные действия
-- (set_app_role) дальше ограничены отдельно.
CREATE OR REPLACE FUNCTION list_app_users()
RETURNS TABLE (
  id              uuid,
  email           text,
  app_role        text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email,
         u.raw_app_meta_data ->> 'app_role',
         u.created_at, u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_app_users() TO authenticated;

-- ════ RPC: set_app_role ════
-- Назначить/снять глобальную роль (admin/superadmin) пользователю.
-- Только superadmin может вызывать — иначе admin мог бы выдать
-- роль самому себе же или другому admin'у (повышение привилегий).
--
-- ПРИМЕЧАНИЕ: запись в app_metadata не обновляет уже выданный JWT
-- пользователя «на лету» — изменение применится после следующего
-- обновления токена (обычно в течение часа) или после повторного входа.
CREATE OR REPLACE FUNCTION set_app_role(p_user_id uuid, p_role text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'invalid role: %', p_role USING ERRCODE = '22023';
  END IF;

  -- Защита от случайной самоблокировки: не даём убрать
  -- superadmin-роль у себя, если ты последний superadmin.
  IF p_user_id = auth.uid() AND p_role IS DISTINCT FROM 'superadmin' THEN
    IF (SELECT count(*) FROM auth.users WHERE raw_app_meta_data ->> 'app_role' = 'superadmin') <= 1 THEN
      RAISE EXCEPTION 'cannot remove the last superadmin' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
    CASE
      WHEN p_role IS NULL THEN raw_app_meta_data - 'app_role'
      ELSE raw_app_meta_data || jsonb_build_object('app_role', p_role)
    END
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_app_role(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
