-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 003_rls.sql
-- Применять после 002_functions.sql (все хелперы must exist).
-- Содержит ТОЛЬКО RLS: ENABLE ROW LEVEL SECURITY + CREATE POLICY.
-- Ни одной CREATE FUNCTION здесь нет — они в 002 / 004.
-- ════════════════════════════════════════════════════════════

-- ════ ENABLE ROW LEVEL SECURITY ════

ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_map_strength  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_synergy       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_data          ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_tier_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_share_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_tier_sets ENABLE ROW LEVEL SECURITY;

-- ════ ПОЛИТИКИ ════

-- ── teams ──
-- Участник видит свои команды; admin видит все
CREATE POLICY "teams: members read" ON teams FOR SELECT
  USING (is_app_admin() OR EXISTS (
    SELECT 1 FROM user_roles WHERE team_id = teams.id AND user_id = auth.uid()
  ));
-- Любой залогиненный может создать команду (SECURITY DEFINER create_team делает остальное)
CREATE POLICY "teams: authenticated create" ON teams AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "teams: managers update"   ON teams FOR UPDATE USING (can_manage_roles(id));
CREATE POLICY "teams: permitted delete"  ON teams FOR DELETE USING (can_delete_team_perm(id));

-- ── roles ──
-- Глобальные роли (team_id IS NULL) — видны всем, нужны для permissions справочника
CREATE POLICY "roles: members read" ON roles FOR SELECT
  USING (team_id IS NULL OR is_app_admin()
    OR EXISTS (SELECT 1 FROM user_roles WHERE team_id = roles.team_id AND user_id = auth.uid()));
CREATE POLICY "roles: managers write"  ON roles FOR INSERT WITH CHECK (can_manage_roles(team_id));
CREATE POLICY "roles: managers update" ON roles FOR UPDATE USING (can_manage_roles(team_id) AND NOT is_system);
CREATE POLICY "roles: managers delete" ON roles FOR DELETE USING (can_manage_roles(team_id) AND NOT is_system);

-- ── role_permissions ──
CREATE POLICY "role_perms: members read" ON role_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roles r LEFT JOIN user_roles ur ON ur.team_id = r.team_id
    WHERE r.id = role_permissions.role_id
      AND (r.team_id IS NULL OR ur.user_id = auth.uid() OR is_app_admin())
  ));
CREATE POLICY "role_perms: managers write" ON role_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id AND can_manage_roles(r.team_id)
  ));

-- ── user_roles ──
-- can_see_team_members() — SECURITY DEFINER, не вызывает рекурсию на user_roles
CREATE POLICY "user_roles: self and managers read" ON user_roles FOR SELECT
  USING (user_id = auth.uid() OR is_app_admin()
    OR can_manage_roles(team_id) OR can_see_team_members(team_id));
CREATE POLICY "user_roles: managers insert" ON user_roles FOR INSERT
  WITH CHECK (is_app_admin() OR can_manage_roles(team_id));
CREATE POLICY "user_roles: managers update" ON user_roles FOR UPDATE
  USING (can_manage_roles(team_id) OR is_app_admin());
CREATE POLICY "user_roles: self or managers delete" ON user_roles FOR DELETE
  USING (user_id = auth.uid() OR can_manage_roles(team_id) OR is_app_admin());

-- ── team_invites ──
-- role_sort_order() — SECURITY DEFINER обёртка, исключает inline subquery на roles
-- (inline subquery → рекурсия через RLS на roles)
CREATE POLICY "invites: managers read" ON team_invites FOR SELECT
  USING (can_manage_invites(team_id) OR is_app_admin());
CREATE POLICY "invites: managers create" ON team_invites FOR INSERT
  WITH CHECK (
    can_manage_invites(team_id)
    AND role_sort_order(role_id) >= my_role_sort_order(team_id)
    AND my_team_role(team_id) != 'viewer'
  );
CREATE POLICY "invites: managers delete" ON team_invites FOR DELETE
  USING (can_manage_invites(team_id) OR is_app_admin());

-- ── heroes / maps / hero_map_strength / hero_synergy ──
CREATE POLICY "heroes: read"  ON heroes            FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "heroes: write" ON heroes            FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "maps: read"    ON maps              FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "maps: write"   ON maps              FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "hms: read"     ON hero_map_strength FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "hms: write"    ON hero_map_strength FOR ALL    USING (can_write_team(team_id));
CREATE POLICY "syn: read"     ON hero_synergy      FOR SELECT USING (can_read_game_data(team_id));
CREATE POLICY "syn: write"    ON hero_synergy      FOR ALL    USING (can_write_team(team_id));

-- ── players ──
CREATE POLICY "players: read"  ON players FOR SELECT USING (can_read_roster(team_id));
CREATE POLICY "players: write" ON players FOR ALL    USING (can_write_team(team_id));

-- ── tier_data ──
-- scope='team' — командный тир-лист
CREATE POLICY "tiers: team read"  ON tier_data FOR SELECT
  USING (scope = 'team' AND (can_read_game_data(team_id) OR is_app_admin()));
CREATE POLICY "tiers: team write" ON tier_data FOR ALL
  USING (scope = 'team' AND (can_write_team(team_id) OR is_app_admin()));
-- scope='personal' — владелец, manager команды или по публичной share-ссылке
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

-- ── global_tier_data ──
-- Читают все включая anon — публичная страница без регистрации
CREATE POLICY "global_tiers: public read"      ON global_tier_data FOR SELECT USING (true);
CREATE POLICY "global_tiers: superadmin write" ON global_tier_data FOR ALL    USING (is_superadmin());

-- ── tier_share_links ──
CREATE POLICY "share_links: owner"       ON tier_share_links FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "share_links: public read" ON tier_share_links FOR SELECT USING (is_public = true);

-- ── personal_tier_sets ──
CREATE POLICY "tier_sets: owner"      ON personal_tier_sets FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tier_sets: mgr read"   ON personal_tier_sets FOR SELECT USING (can_manage_roles(team_id));
CREATE POLICY "tier_sets: admin read" ON personal_tier_sets FOR SELECT USING (is_app_admin());

-- ── sheets_tokens ──
CREATE POLICY "sheets: read"  ON sheets_tokens FOR SELECT USING (can_export_sheets(team_id));
CREATE POLICY "sheets: write" ON sheets_tokens FOR ALL    USING (can_export_sheets(team_id));
