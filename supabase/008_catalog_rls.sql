-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 008_catalog_rls.sql
-- MIGR-1, файл 2/3: RLS-политики и GRANT для таблиц из
-- 007_catalog_tables.sql. Применять сразу после него.
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════

ALTER TABLE hero_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_map_strength ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_synergy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_counters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_lists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_entries   ENABLE ROW LEVEL SECURITY;

-- ── Каталоги — публичный факт игры, читают все включая anon,
-- пишет только superadmin (аналог global_tier_data). ──
CREATE POLICY "hero_catalog: public read" ON hero_catalog FOR SELECT USING (true);
CREATE POLICY "hero_catalog: superadmin write" ON hero_catalog FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "map_catalog: public read" ON map_catalog FOR SELECT USING (true);
CREATE POLICY "map_catalog: superadmin write" ON map_catalog FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ── heroes / maps — без изменений логики (та же роль can_read_game_data/
-- can_write_team, что и раньше — конкретные колонки таблицы для RLS
-- не важны). ──
CREATE POLICY "heroes: read"  ON heroes FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "heroes: write" ON heroes FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "maps: read"  ON maps FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "maps: write" ON maps FOR ALL    USING (can_write_team(team_id));

-- ── hero_map_strength / hero_synergy — без изменений логики. ──
CREATE POLICY "hms: read"  ON hero_map_strength FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "hms: write" ON hero_map_strength FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "syn: read"  ON hero_synergy FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "syn: write" ON hero_synergy FOR ALL    USING (can_write_team(team_id));

-- ── hero_counters — 3 scope. global читают все (anon тоже), team —
-- как heroes раньше, personal — владелец/manager/admin. ──
CREATE POLICY "hero_counters: global read"  ON hero_counters FOR SELECT
  USING (scope = 'global');
CREATE POLICY "hero_counters: global write" ON hero_counters FOR ALL
  USING (scope = 'global' AND is_superadmin()) WITH CHECK (scope = 'global' AND is_superadmin());
CREATE POLICY "hero_counters: team read"  ON hero_counters FOR SELECT
  USING (scope = 'team' AND can_read_game_data(team_id));
CREATE POLICY "hero_counters: team write" ON hero_counters FOR ALL
  USING (scope = 'team' AND can_write_team(team_id)) WITH CHECK (scope = 'team' AND can_write_team(team_id));
CREATE POLICY "hero_counters: personal read" ON hero_counters FOR SELECT
  USING (scope = 'personal' AND (user_id = auth.uid() OR is_app_admin() OR can_manage_roles(team_id)));
CREATE POLICY "hero_counters: personal write" ON hero_counters FOR ALL
  USING (scope = 'personal' AND user_id = auth.uid())
  WITH CHECK (scope = 'personal' AND user_id = auth.uid());

-- ── tier_lists — контейнеры. Читать список (метаданные, не entries) —
-- та же логика доступа что и entries ниже, дублируем на уровне list. ──
CREATE POLICY "tier_lists: global read"  ON tier_lists FOR SELECT USING (scope = 'global');
CREATE POLICY "tier_lists: global write" ON tier_lists FOR ALL
  USING (scope = 'global' AND is_superadmin()) WITH CHECK (scope = 'global' AND is_superadmin());
CREATE POLICY "tier_lists: team read"  ON tier_lists FOR SELECT
  USING (scope = 'team' AND (can_read_game_data(team_id) OR is_app_admin()));
CREATE POLICY "tier_lists: team write" ON tier_lists FOR ALL
  USING (scope = 'team' AND (can_write_team(team_id) OR is_app_admin()));
CREATE POLICY "tier_lists: personal read" ON tier_lists FOR SELECT
  USING (scope = 'personal' AND (user_id = auth.uid() OR is_app_admin() OR can_manage_roles(team_id)));
CREATE POLICY "tier_lists: personal write" ON tier_lists FOR ALL
  USING (scope = 'personal' AND user_id = auth.uid())
  WITH CHECK (scope = 'personal' AND user_id = auth.uid());

-- ── tier_entries — читают/пишут по scope РОДИТЕЛЬСКОГО tier_list
-- (join через tier_list_id, т.к. у entries нет своих team_id/user_id). ──
CREATE POLICY "tier_entries: global read" ON tier_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id AND tl.scope = 'global'));
CREATE POLICY "tier_entries: global write" ON tier_entries FOR ALL
  USING (is_superadmin() AND EXISTS (SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id AND tl.scope = 'global'));

CREATE POLICY "tier_entries: team read" ON tier_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id
    AND tl.scope = 'team' AND (can_read_game_data(tl.team_id) OR is_app_admin())
  ));
CREATE POLICY "tier_entries: team write" ON tier_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id
    AND tl.scope = 'team' AND (can_write_team(tl.team_id) OR is_app_admin())
  ));

CREATE POLICY "tier_entries: personal read" ON tier_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id
    AND tl.scope = 'personal' AND (
      tl.user_id = auth.uid() OR is_app_admin() OR can_manage_roles(tl.team_id)
      OR EXISTS (
        SELECT 1 FROM tier_share_links sl
        WHERE sl.tier_set_id = tl.id
          AND (sl.is_public OR sl.user_id = auth.uid())
          AND (sl.expires_at IS NULL OR sl.expires_at > now())
      )
    )
  ));
CREATE POLICY "tier_entries: personal write" ON tier_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tier_lists tl WHERE tl.id = tier_entries.tier_list_id
    AND tl.scope = 'personal' AND tl.user_id = auth.uid()
  ));

-- ════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_catalog      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_catalog       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heroes            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_map_strength TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_synergy      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_counters     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_lists        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_entries      TO authenticated;

-- anon: каталоги целиком + global-scope везде (консистентно с прежним
-- global_tier_data/hero_counters public-read паттерном)
GRANT SELECT ON public.hero_catalog  TO anon;
GRANT SELECT ON public.map_catalog   TO anon;
GRANT SELECT ON public.hero_counters TO anon;
GRANT SELECT ON public.tier_lists    TO anon;
GRANT SELECT ON public.tier_entries  TO anon;

NOTIFY pgrst, 'reload schema';
