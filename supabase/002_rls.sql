-- ════════════════════════════════════════════════════════════
-- DraftHub — Row Level Security
-- Применять после 001_initial_schema.sql
-- ════════════════════════════════════════════════════════════

-- ── Включаем RLS на всех таблицах ───────────────────────────
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_map_strength ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_synergy      ENABLE ROW LEVEL SECURITY;
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_data         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets_tokens     ENABLE ROW LEVEL SECURITY;

-- ── Вспомогательные функции ──────────────────────────────────

-- Роль текущего пользователя в команде (NULL если не член)
CREATE OR REPLACE FUNCTION my_team_role(p_team_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM team_members
  WHERE team_id = p_team_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- Может ли текущий пользователь писать в команду (coach или admin)
CREATE OR REPLACE FUNCTION can_write_team(p_team_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND role IN ('admin','coach')
  );
$$;

-- ════ teams ════
-- Видят команду: все её члены
CREATE POLICY "teams: members read" ON teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = teams.id AND user_id = auth.uid()
  ));

-- Создаёт команду: любой авторизованный
CREATE POLICY "teams: authenticated create" ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Обновляет/удаляет: только admin
CREATE POLICY "teams: admin update" ON teams FOR UPDATE
  USING (my_team_role(id) = 'admin');
CREATE POLICY "teams: admin delete" ON teams FOR DELETE
  USING (my_team_role(id) = 'admin');

-- ════ team_members ════
-- Видят список: члены команды (кроме viewer — они видят только себя)
CREATE POLICY "members: player+ read" ON team_members FOR SELECT
  USING (
    user_id = auth.uid()  -- себя всегда видишь
    OR my_team_role(team_id) IN ('admin','coach','player')
  );

-- Добавлять членов: admin
CREATE POLICY "members: admin insert" ON team_members FOR INSERT
  WITH CHECK (my_team_role(team_id) = 'admin');

-- Менять роль: admin (не может понизить себя если последний admin)
CREATE POLICY "members: admin update" ON team_members FOR UPDATE
  USING (my_team_role(team_id) = 'admin');

-- Удалять: admin или сам пользователь (выход из команды)
CREATE POLICY "members: admin or self delete" ON team_members FOR DELETE
  USING (my_team_role(team_id) = 'admin' OR user_id = auth.uid());

-- ════ team_invites ════
-- Видят инвайты: coach и admin
CREATE POLICY "invites: coach+ read" ON team_invites FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach'));

-- Создаёт инвайты: coach и admin
CREATE POLICY "invites: coach+ create" ON team_invites FOR INSERT
  WITH CHECK (can_write_team(team_id));

-- Удаляет инвайты: admin
CREATE POLICY "invites: admin delete" ON team_invites FOR DELETE
  USING (my_team_role(team_id) = 'admin');

-- ── Специальная функция: принять инвайт ─────────────────────
-- Вызывается анонимно (пользователь ещё не член команды)
-- Проверяет токен и добавляет пользователя
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite  team_invites%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM team_invites
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','invalid_or_expired');
  END IF;

  -- Добавляем или обновляем роль
  INSERT INTO team_members(team_id, user_id, role)
  VALUES (v_invite.team_id, v_user_id, v_invite.role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Увеличиваем счётчик использований
  UPDATE team_invites SET uses = uses + 1 WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'team_id', v_invite.team_id,
    'role', v_invite.role
  );
END;
$$;

-- ════ heroes / maps / players ════
-- Правила одинаковые для всех игровых таблиц:
-- viewer — только tier_data
-- player+ — всё читает
-- coach/admin — пишет

-- heroes
CREATE POLICY "heroes: player+ read" ON heroes FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach','player'));
CREATE POLICY "heroes: coach+ write" ON heroes FOR ALL
  USING (can_write_team(team_id));

-- maps
CREATE POLICY "maps: player+ read" ON maps FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach','player'));
CREATE POLICY "maps: coach+ write" ON maps FOR ALL
  USING (can_write_team(team_id));

-- hero_map_strength
CREATE POLICY "hms: player+ read" ON hero_map_strength FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach','player'));
CREATE POLICY "hms: coach+ write" ON hero_map_strength FOR ALL
  USING (can_write_team(team_id));

-- hero_synergy
CREATE POLICY "syn: player+ read" ON hero_synergy FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach','player'));
CREATE POLICY "syn: coach+ write" ON hero_synergy FOR ALL
  USING (can_write_team(team_id));

-- players
CREATE POLICY "players: player+ read" ON players FOR SELECT
  USING (my_team_role(team_id) IN ('admin','coach','player'));
CREATE POLICY "players: coach+ write" ON players FOR ALL
  USING (can_write_team(team_id));

-- tier_data — viewer тоже видит (публичная часть)
CREATE POLICY "tiers: viewer+ read" ON tier_data FOR SELECT
  USING (my_team_role(team_id) IS NOT NULL);   -- любой член команды
CREATE POLICY "tiers: coach+ write" ON tier_data FOR ALL
  USING (can_write_team(team_id));

-- sheets_tokens — только coach/admin
CREATE POLICY "sheets: coach+ read" ON sheets_tokens FOR SELECT
  USING (can_write_team(team_id));
CREATE POLICY "sheets: coach+ write" ON sheets_tokens FOR ALL
  USING (can_write_team(team_id));
