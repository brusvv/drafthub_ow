-- ════════════════════════════════════════════════════════════
-- DraftHub — обновление политик данных под кастомные роли
-- Применять после 003_custom_roles.sql
-- Заменяет policies из 002_rls.sql которые использовали my_team_role()
-- ════════════════════════════════════════════════════════════

-- ── heroes ──
DROP POLICY IF EXISTS "heroes: player+ read" ON heroes;
DROP POLICY IF EXISTS "heroes: coach+ write" ON heroes;
CREATE POLICY "heroes: read by permission" ON heroes FOR SELECT
  USING (can_read_game_data(team_id));
CREATE POLICY "heroes: write by permission" ON heroes FOR ALL
  USING (can_write_team(team_id));

-- ── maps ──
DROP POLICY IF EXISTS "maps: player+ read" ON maps;
DROP POLICY IF EXISTS "maps: coach+ write" ON maps;
CREATE POLICY "maps: read by permission" ON maps FOR SELECT
  USING (can_read_game_data(team_id));
CREATE POLICY "maps: write by permission" ON maps FOR ALL
  USING (can_write_team(team_id));

-- ── hero_map_strength ──
DROP POLICY IF EXISTS "hms: player+ read" ON hero_map_strength;
DROP POLICY IF EXISTS "hms: coach+ write" ON hero_map_strength;
CREATE POLICY "hms: read by permission" ON hero_map_strength FOR SELECT
  USING (can_read_game_data(team_id));
CREATE POLICY "hms: write by permission" ON hero_map_strength FOR ALL
  USING (can_write_team(team_id));

-- ── hero_synergy ──
DROP POLICY IF EXISTS "syn: player+ read" ON hero_synergy;
DROP POLICY IF EXISTS "syn: coach+ write" ON hero_synergy;
CREATE POLICY "syn: read by permission" ON hero_synergy FOR SELECT
  USING (can_read_game_data(team_id));
CREATE POLICY "syn: write by permission" ON hero_synergy FOR ALL
  USING (can_write_team(team_id));

-- ── players (ростер) ──
DROP POLICY IF EXISTS "players: player+ read" ON players;
DROP POLICY IF EXISTS "players: coach+ write" ON players;
CREATE POLICY "players: read by permission" ON players FOR SELECT
  USING (can_read_roster(team_id));
CREATE POLICY "players: write by permission" ON players FOR ALL
  USING (can_write_team(team_id));

-- ── tier_data — особый случай: viewer тоже видит тир-листы ──
DROP POLICY IF EXISTS "tiers: viewer+ read" ON tier_data;
DROP POLICY IF EXISTS "tiers: coach+ write" ON tier_data;
CREATE POLICY "tiers: any member read" ON tier_data FOR SELECT
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_id = tier_data.team_id AND user_id = auth.uid()));
CREATE POLICY "tiers: write by permission" ON tier_data FOR ALL
  USING (can_write_team(team_id));

-- ── sheets_tokens ──
DROP POLICY IF EXISTS "sheets: coach+ read" ON sheets_tokens;
DROP POLICY IF EXISTS "sheets: coach+ write" ON sheets_tokens;
CREATE OR REPLACE FUNCTION can_export_sheets(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_export_sheets FROM my_team_permissions(p_team_id)), false);
$$;
CREATE POLICY "sheets: export-permitted read" ON sheets_tokens FOR SELECT
  USING (can_export_sheets(team_id));
CREATE POLICY "sheets: export-permitted write" ON sheets_tokens FOR ALL
  USING (can_export_sheets(team_id));

-- ── team_invites — теперь can_manage_invites вместо can_write ──
DROP POLICY IF EXISTS "invites: coach+ read" ON team_invites;
DROP POLICY IF EXISTS "invites: coach+ create" ON team_invites;
DROP POLICY IF EXISTS "invites: admin delete" ON team_invites;
CREATE OR REPLACE FUNCTION can_manage_invites(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_manage_invites FROM my_team_permissions(p_team_id)), false);
$$;
CREATE POLICY "invites: managers read" ON team_invites FOR SELECT
  USING (can_manage_invites(team_id));
CREATE POLICY "invites: managers create" ON team_invites FOR INSERT
  WITH CHECK (can_manage_invites(team_id));
CREATE POLICY "invites: managers delete" ON team_invites FOR DELETE
  USING (can_manage_invites(team_id));

-- ── teams — удаление теперь через can_delete_team ──
DROP POLICY IF EXISTS "teams: admin update" ON teams;
DROP POLICY IF EXISTS "teams: admin delete" ON teams;
CREATE OR REPLACE FUNCTION can_delete_team_perm(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT can_delete_team FROM my_team_permissions(p_team_id)), false);
$$;
CREATE POLICY "teams: managers update" ON teams FOR UPDATE
  USING (can_manage_roles(id));
CREATE POLICY "teams: permitted delete" ON teams FOR DELETE
  USING (can_delete_team_perm(id));

-- ── team_members — обновление роли теперь через can_manage_roles ──
DROP POLICY IF EXISTS "members: admin insert" ON team_members;
DROP POLICY IF EXISTS "members: admin update" ON team_members;
DROP POLICY IF EXISTS "members: admin or self delete" ON team_members;
CREATE POLICY "members: managers insert" ON team_members FOR INSERT
  WITH CHECK (can_manage_roles(team_id));
CREATE POLICY "members: managers update" ON team_members FOR UPDATE
  USING (can_manage_roles(team_id));
CREATE POLICY "members: managers or self delete" ON team_members FOR DELETE
  USING (can_manage_roles(team_id) OR user_id = auth.uid());
