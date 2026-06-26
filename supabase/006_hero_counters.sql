-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 006_hero_counters.sql
-- Контрпики героев на 3 уровнях — global / team / personal —
-- по той же модели что и tier_data (005_personal_tiers.sql).
-- Применять после 001_tables.sql → 002_functions.sql → 003_rls.sql → 004_rpc.sql.
--
-- ВАЖНО: team-уровень НЕ переезжает в эту таблицу — он как и раньше
-- живёт в heroes.counters (jsonb). Эта миграция добавляет только
-- global и personal как ДОПОЛНИТЕЛЬНЫЕ источники, между которыми
-- переключается фронт (db-load.js: _applyCounterMode), когда
-- меняется режим в хедере (Глобальный/Командный/Личный).
-- ════════════════════════════════════════════════════════════

CREATE TABLE hero_counters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text NOT NULL CHECK (scope IN ('global','personal')),
  team_id       uuid REFERENCES teams(id) ON DELETE CASCADE,      -- NULL для global
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL для global
  hero_name     text NOT NULL,
  counter_hero  text NOT NULL,
  score         int  NOT NULL DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  updated_at    timestamptz DEFAULT now()
);

-- Личный: один счёт на (пользователь, команда, герой, контрпик)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_counters_personal
  ON hero_counters(user_id, team_id, hero_name, counter_hero)
  WHERE scope = 'personal';

-- Глобальный: один счёт на (герой, контрпик) — без привязки к команде
CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_counters_global
  ON hero_counters(hero_name, counter_hero)
  WHERE scope = 'global';

CREATE INDEX IF NOT EXISTS idx_hero_counters_lookup
  ON hero_counters(scope, team_id, user_id);

CREATE TRIGGER trg_hero_counters_updated
  BEFORE UPDATE ON hero_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE hero_counters ENABLE ROW LEVEL SECURITY;

-- Глобальные — читают все (включая anon, как global_tier_data),
-- пишет только superadmin.
DROP POLICY IF EXISTS "hero_counters: global read"      ON hero_counters;
DROP POLICY IF EXISTS "hero_counters: global write"     ON hero_counters;
CREATE POLICY "hero_counters: global read" ON hero_counters
  FOR SELECT USING (scope = 'global');
CREATE POLICY "hero_counters: global write" ON hero_counters
  FOR ALL USING (scope = 'global' AND is_superadmin())
  WITH CHECK (scope = 'global' AND is_superadmin());

-- Личные — владелец + manager команды (видит, не редактирует) + app admin.
DROP POLICY IF EXISTS "hero_counters: personal read"  ON hero_counters;
DROP POLICY IF EXISTS "hero_counters: personal write" ON hero_counters;
CREATE POLICY "hero_counters: personal read" ON hero_counters
  FOR SELECT USING (
    scope = 'personal' AND (
      user_id = auth.uid() OR is_app_admin() OR can_manage_roles(team_id)
    )
  );
CREATE POLICY "hero_counters: personal write" ON hero_counters
  FOR ALL USING (scope = 'personal' AND user_id = auth.uid())
  WITH CHECK (scope = 'personal' AND user_id = auth.uid());

-- anon: только глобальные (консистентно с global_tier_data)
GRANT SELECT ON public.hero_counters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_counters TO authenticated;

NOTIFY pgrst, 'reload schema';
