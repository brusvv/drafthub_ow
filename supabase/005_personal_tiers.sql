-- ════════════════════════════════════════════════════════════
-- DraftHub — 005_personal_tiers.sql
-- Несколько личных тир-листов + share-ссылки + глобальный тир-лист.
-- Применять после 002_roles_and_rls.sql
--
-- Что добавляет этот файл:
--   1. personal_tier_sets  — именованные наборы (до 10 на user+team)
--   2. tier_data           — добавляет tier_set_id + scope + user_id
--   3. global_tier_data    — единый тир-лист приложения (уже в 001, только RLS)
--   4. tier_share_links    — ссылки /tier/TOKEN (уже в 001, только RLS + RPC)
-- ════════════════════════════════════════════════════════════

-- ════ 1. PERSONAL TIER SETS ════
-- Именованный набор тир-листов пользователя внутри команды.
-- Примеры: "Основной", "Мета S14", "Для Ilios пула"
-- Лимит 10 на (user_id, team_id) — реализован триггером ниже.
CREATE TABLE personal_tier_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Мой тирлист',
  is_default bool DEFAULT false,   -- активный сет при открытии
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id, name)
);

-- Только один is_default=true на (user_id, team_id)
CREATE UNIQUE INDEX idx_tier_set_default
  ON personal_tier_sets (user_id, team_id)
  WHERE is_default = true;

-- Триггер: лимит 10 сетов на пользователя в команде
CREATE OR REPLACE FUNCTION _check_tier_set_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM personal_tier_sets
    WHERE user_id = NEW.user_id AND team_id = NEW.team_id
  ) >= 10 THEN
    RAISE EXCEPTION 'Максимум 10 тир-листов на команду';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tier_set_limit
  BEFORE INSERT ON personal_tier_sets
  FOR EACH ROW EXECUTE FUNCTION _check_tier_set_limit();

-- Триггер: при удалении дефолтного сета — назначаем следующий дефолтным
CREATE OR REPLACE FUNCTION _reassign_default_tier_set()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_default THEN
    UPDATE personal_tier_sets SET is_default = true
    WHERE user_id = OLD.user_id AND team_id = OLD.team_id
      AND id != OLD.id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_tier_set_reassign_default
  AFTER DELETE ON personal_tier_sets
  FOR EACH ROW EXECUTE FUNCTION _reassign_default_tier_set();

CREATE TRIGGER trg_tier_set_updated
  BEFORE UPDATE ON personal_tier_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════ 2. РАСШИРЯЕМ tier_data ════
-- scope: 'team' = командный, 'personal' = личный
-- user_id: NULL для командных, заполнен для личных
-- tier_set_id: к какому набору относится личная запись
ALTER TABLE tier_data
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'team'
    CHECK (scope IN ('team','personal')),
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tier_set_id uuid
    REFERENCES personal_tier_sets(id) ON DELETE CASCADE;

-- Уникальность по scope:
-- командный: одна запись (team_id, entity_type, name)
-- личный:    одна запись на сет (tier_set_id, entity_type, name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_team_unique
  ON tier_data (team_id, entity_type, name)
  WHERE scope = 'team';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_personal_unique
  ON tier_data (tier_set_id, entity_type, name)
  WHERE scope = 'personal';

CREATE INDEX IF NOT EXISTS idx_tier_set_id ON tier_data(tier_set_id);

-- ════ 3. RLS — personal_tier_sets ════
ALTER TABLE personal_tier_sets ENABLE ROW LEVEL SECURITY;

-- Владелец управляет своими сетами
CREATE POLICY "tier_sets: owner manage" ON personal_tier_sets
  FOR ALL USING (user_id = auth.uid());

-- manager команды видит все личные сеты участников
CREATE POLICY "tier_sets: manager read" ON personal_tier_sets
  FOR SELECT USING (can_manage_roles(team_id));

-- superadmin/admin видят всё
CREATE POLICY "tier_sets: app admin read" ON personal_tier_sets
  FOR SELECT USING (is_app_admin());

-- ════ 4. RLS — tier_data (личные записи) ════
-- Командные политики ('tiers: team read/write') уже определены в 002_roles_and_rls.sql.
-- Здесь добавляем только политики для scope='personal'.

-- Личный: владелец + manager команды + по share_link
CREATE POLICY "tiers: personal read" ON tier_data FOR SELECT
  USING (
    scope = 'personal' AND (
      user_id = auth.uid()
      OR is_app_admin()
      OR can_manage_roles(team_id)
      OR EXISTS (
        SELECT 1 FROM tier_share_links sl
        WHERE sl.tier_set_id = tier_data.tier_set_id
          AND (sl.is_public = true OR sl.user_id = auth.uid())
          AND (sl.expires_at IS NULL OR sl.expires_at > now())
      )
    )
  );

CREATE POLICY "tiers: personal write" ON tier_data FOR ALL
  USING (scope = 'personal' AND user_id = auth.uid());

-- ════ 5. RLS — global_tier_data ════
-- Читают все (включая anon — для публичной страницы без регистрации)
-- Пишет только superadmin
CREATE POLICY "global_tiers: public read" ON global_tier_data
  FOR SELECT USING (true);

CREATE POLICY "global_tiers: superadmin write" ON global_tier_data
  FOR ALL USING (is_superadmin());

-- ════ 6. RLS — tier_share_links ════
-- Базовые политики ('share_links: owner manage', 'share_links: public read')
-- уже определены в 002_roles_and_rls.sql.
-- Добавляем tier_set_id к таблице — остальное наследуется.
ALTER TABLE tier_share_links
  ADD COLUMN IF NOT EXISTS tier_set_id uuid
    REFERENCES personal_tier_sets(id) ON DELETE CASCADE;

-- ════ 7. RPC: create_tier_set ════
-- Создаёт именованный тир-лист; если первый — делает его дефолтным
CREATE OR REPLACE FUNCTION create_tier_set(
  p_team_id uuid,
  p_name    text DEFAULT 'Мой тирлист'
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_set personal_tier_sets%ROWTYPE;
  v_is_default bool;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Первый сет в этой команде → дефолтный
  v_is_default := NOT EXISTS (
    SELECT 1 FROM personal_tier_sets
    WHERE user_id = auth.uid() AND team_id = p_team_id
  );

  INSERT INTO personal_tier_sets (user_id, team_id, name, is_default)
  VALUES (auth.uid(), p_team_id, p_name, v_is_default)
  RETURNING * INTO v_set;

  RETURN to_json(v_set);
END;
$$;

-- ════ 8. RPC: set_default_tier_set ════
-- Переключает активный тир-лист (один клик в меню)
CREATE OR REPLACE FUNCTION set_default_tier_set(p_set_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_set personal_tier_sets%ROWTYPE;
BEGIN
  SELECT * INTO v_set FROM personal_tier_sets
  WHERE id = p_set_id AND user_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  -- Снимаем дефолт со всех остальных сетов в этой команде
  UPDATE personal_tier_sets SET is_default = false
  WHERE user_id = auth.uid() AND team_id = v_set.team_id;

  -- Ставим дефолт на выбранный
  UPDATE personal_tier_sets SET is_default = true WHERE id = p_set_id;
END;
$$;

-- ════ 9. RPC: view_shared_tier ════
-- Просмотр тир-листа по токену — работает без авторизации для публичных.
-- Увеличивает счётчик просмотров.
CREATE OR REPLACE FUNCTION view_shared_tier(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_link tier_share_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM tier_share_links
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  -- Приватная ссылка — нужна авторизация
  IF NOT v_link.is_public THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('error','private_link_requires_auth');
    END IF;
    -- Видит владелец или manager команды
    IF auth.uid() != v_link.user_id AND NOT can_manage_roles(v_link.team_id) THEN
      RETURN jsonb_build_object('error','no_access');
    END IF;
  END IF;

  UPDATE tier_share_links SET views = views + 1 WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'ok',          true,
    'label',       v_link.label,
    'user_id',     v_link.user_id,
    'team_id',     v_link.team_id,
    'entity_type', v_link.entity_type,
    'tiers', (
      SELECT jsonb_agg(
        jsonb_build_object('entity_type', entity_type, 'name', name, 'tier', tier)
        ORDER BY entity_type, name
      )
      FROM tier_data
      WHERE tier_set_id = v_link.tier_set_id
        AND (v_link.entity_type = 'both' OR entity_type = v_link.entity_type)
    )
  );
END;
$$;

-- ════ GRANTS ════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_tier_sets TO authenticated;

-- anon: публичные share-ссылки и глобальный тир-лист
GRANT SELECT ON public.tier_share_links  TO anon;
GRANT SELECT ON public.tier_data         TO anon;
GRANT SELECT ON public.global_tier_data  TO anon;

GRANT EXECUTE ON FUNCTION public.create_tier_set(uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_tier_set(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.view_shared_tier(text)       TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
