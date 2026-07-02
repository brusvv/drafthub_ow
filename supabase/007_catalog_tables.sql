-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 007_catalog_tables.sql
-- MIGR-1, файл 1/3: id-based каталог героев/карт + unified tier-архитектура.
-- Только DDL — таблицы, индексы, триггерные функции. RLS/GRANT →
-- 008_catalog_rls.sql. Seed данные → 009_catalog_seed.sql.
--
-- (Триггерные функции _check_tier_list_limit/_reassign_default_tier_list
-- живут здесь, а не в 002_functions.sql — тот файл уже финализирован
-- предыдущей консолидацией, эта миграция самодостаточна как единый
-- пакет, тем же паттерном что personal_tier_sets в старом 005-файле.)
--
-- Контекст: name-based связи (hero_name/map_name text) были источником
-- рассинхрона. 3 разных механизма под 3 scope тир-листов (team/personal
-- через tier_data+scope, global — отдельная global_tier_data) путали
-- и JS, и людей. Здесь — id-based FK везде + единый tier_lists/tier_entries
-- вместо tier_data+global_tier_data, единый hero_counters на 3 scope
-- вместо heroes.counters(team) + hero_counters(global/personal).
--
-- Применять после 001_tables.sql → 002_functions.sql → 003_rls.sql,
-- ДО 008_catalog_rls.sql и 009_catalog_seed.sql (обе зависят от таблиц
-- отсюда). Бэкфилл не нужен — живой БД с реальными данными ещё нет,
-- можно DROP и пересоздавать напрямую.
--
-- ⚠️ 006_hero_counters.sql УДАЛЁН из цепочки применения: создавал
-- 2-scope hero_counters (global/personal), которую этот файл тут же
-- дропает (ЧАСТЬ 1) и пересоздаёт на 3 scope — 006 был чистым overhead,
-- ничего кроме самого себя на него не ссылалось.
--
-- ⚠️ РЕШЕНИЕ, ОТМЕЧУ ЯВНО: спецификация MIGR-1 описывает новую heroes
-- БЕЗ колонки counters, но не даёт explicit-замены для командных
-- контрпиков (в старой схеме единственный источник team-уровня —
-- heroes.counters jsonb). Чтобы не потерять функциональность и следуя
-- духу MIGR-0 ("3 механизма путают"), hero_counters здесь расширен на
-- 3-й scope='team' — теперь ОДНА таблица на все три уровня, тем же
-- паттерном что tier_lists. Если это неверная трактовка — see CHANGELOG,
-- откатить на "оставить counters в heroes" отдельным ALTER.
--
-- ⚠️ 011_rpc.sql (был 004_rpc.sql) применяется ПОСЛЕ этого файла, не до —
-- `create_tier_set`/`set_default_tier_set` объявляют `tier_lists%ROWTYPE`,
-- а %ROWTYPE резолвится СРАЗУ при `CREATE FUNCTION` (в отличие от обычных
-- SQL-запросов в теле функции, которые резолвятся лениво при первом
-- вызове) — если применить его раньше этого файла, `CREATE FUNCTION`
-- падает с `relation "tier_lists" does not exist`. Это и произошло при
-- первой попытке наката со старой нумерацией (004 перед 007) — файл
-- переименован в 011, порядок исправлен, см. его собственный заголовок.
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 1 — DROP старых объектов
-- ════════════════════════════════════════════════════════════

-- tier_share_links остаётся (не в списке DROP), но ссылается на
-- personal_tier_sets, которую мы удаляем ниже — снимаем старый FK
-- сейчас, новый (на tier_lists) добавим в конце файла.
ALTER TABLE tier_share_links DROP CONSTRAINT IF EXISTS fk_share_links_tier_set;

-- Порядок DROP важен из-за FK: tier_data/tier_share_links(было) →
-- personal_tier_sets. DROP TABLE автоматически сносит свои политики
-- и индексы — отдельный DROP POLICY не нужен для удаляемых таблиц.
DROP TABLE IF EXISTS tier_data          CASCADE;
DROP TABLE IF EXISTS global_tier_data   CASCADE;
DROP TABLE IF EXISTS personal_tier_sets CASCADE;
DROP TABLE IF EXISTS hero_counters      CASCADE;   -- пересоздаём ниже на 3 scope
DROP TABLE IF EXISTS hero_map_strength  CASCADE;   -- текстовые hero_name/map_name
DROP TABLE IF EXISTS hero_synergy       CASCADE;   -- текстовые hero_name/synergy_hero

-- heroes/maps пересоздаём: DROP + CREATE, а не ALTER — колонки role/type/
-- subrole/in_pool уходят в каталог, счётчики уходят в hero_counters,
-- добавляется hero_id/map_id FK. Ни tier_data (уже удалена), ни
-- hero_map_strength/hero_synergy (уже удалены) не держат FK на heroes/maps.id,
-- так что прямой DROP безопасен.
DROP TABLE IF EXISTS heroes CASCADE;
DROP TABLE IF EXISTS maps   CASCADE;

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 2 — КАТАЛОГИ (курируемый справочник игры, НЕ per-team)
-- ════════════════════════════════════════════════════════════

CREATE TABLE hero_catalog (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  role       text NOT NULL CHECK (role IN ('Tank','Damage','Support')),
  subrole    text CHECK (
    subrole IS NULL OR (
      (role = 'Tank'    AND subrole IN ('Initiator','Bruiser','Stalwart')) OR
      (role = 'Damage'  AND subrole IN ('Flanker','Recon','Specialist','Sharpshooter')) OR
      (role = 'Support' AND subrole IN ('Tactician','Medic','Survivor'))
    )
  ),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE map_catalog (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  type       text NOT NULL CHECK (type IN ('Hybrid','Escort','Control','Push','Flashpoint','Clash')),
  in_pool    bool NOT NULL DEFAULT true,   -- актуальный сезонный пул — влияет на фильтр «Пул карт» и соревновательный драфт
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER trg_hero_catalog_updated BEFORE UPDATE ON hero_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_map_catalog_updated  BEFORE UPDATE ON map_catalog  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 3 — HEROES / MAPS (per-team данные, ссылаются на каталог)
-- ════════════════════════════════════════════════════════════

CREATE TABLE heroes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_id    uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE RESTRICT,
  priority   int  DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  banned     bool DEFAULT false,
  notes      text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, hero_id)
);

CREATE TABLE maps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  map_id           uuid NOT NULL REFERENCES map_catalog(id) ON DELETE RESTRICT,
  tier             text DEFAULT 'B' CHECK (tier IN ('S','A','B','C','D')),
  priority         int DEFAULT 5,
  atk              int DEFAULT 3 CHECK (atk BETWEEN 1 AND 5),
  def              int DEFAULT 3 CHECK (def BETWEEN 1 AND 5),
  dif              int DEFAULT 3 CHECK (dif BETWEEN 1 AND 5),
  notes            text DEFAULT '',
  preferred_heroes uuid[] DEFAULT '{}',   -- было text[] имён → uuid[] hero_catalog.id
  ban_heroes       uuid[] DEFAULT '{}',
  counters         uuid[] DEFAULT '{}',
  comp             jsonb  DEFAULT '[]',   -- элементы {hero_id, role, playerRole} — hero_id вместо имени
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(team_id, map_id)
);

CREATE TRIGGER trg_heroes_updated BEFORE UPDATE ON heroes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_maps_updated   BEFORE UPDATE ON maps   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 4 — HERO_MAP_STRENGTH / HERO_SYNERGY (id-based)
-- ════════════════════════════════════════════════════════════

CREATE TABLE hero_map_strength (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_id uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE CASCADE,
  map_id  uuid NOT NULL REFERENCES map_catalog(id) ON DELETE CASCADE,
  atk     int DEFAULT 0 CHECK (atk BETWEEN 0 AND 10),
  def     int DEFAULT 0 CHECK (def BETWEEN 0 AND 10),
  PRIMARY KEY (team_id, hero_id, map_id)
);

CREATE TABLE hero_synergy (
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hero_id         uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE CASCADE,
  synergy_hero_id uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE CASCADE,
  score           int DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  PRIMARY KEY (team_id, hero_id, synergy_hero_id),
  CHECK (hero_id <> synergy_hero_id)   -- герой не может быть синергетом сам себе
);

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 5 — HERO_COUNTERS (объединены 3 scope: team/global/personal —
-- см. пометку в шапке файла про архитектурное решение)
-- ════════════════════════════════════════════════════════════

CREATE TABLE hero_counters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           text NOT NULL CHECK (scope IN ('team','global','personal')),
  team_id         uuid REFERENCES teams(id) ON DELETE CASCADE,       -- NULL только для global
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NOT NULL только для personal
  hero_id         uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE CASCADE,
  counter_hero_id uuid NOT NULL REFERENCES hero_catalog(id) ON DELETE CASCADE,
  score           int  NOT NULL DEFAULT 5 CHECK (score BETWEEN 1 AND 10),
  updated_at      timestamptz DEFAULT now(),
  CHECK (hero_id <> counter_hero_id),
  CHECK (
    (scope = 'global'   AND team_id IS NULL     AND user_id IS NULL) OR
    (scope = 'team'     AND team_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'personal' AND team_id IS NOT NULL AND user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_hero_counters_global   ON hero_counters(hero_id, counter_hero_id) WHERE scope = 'global';
CREATE UNIQUE INDEX idx_hero_counters_team     ON hero_counters(team_id, hero_id, counter_hero_id) WHERE scope = 'team';
CREATE UNIQUE INDEX idx_hero_counters_personal ON hero_counters(user_id, team_id, hero_id, counter_hero_id) WHERE scope = 'personal';
CREATE INDEX idx_hero_counters_lookup ON hero_counters(scope, team_id, user_id);

CREATE TRIGGER trg_hero_counters_updated BEFORE UPDATE ON hero_counters FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 6 — TIER_LISTS / TIER_ENTRIES (единый механизм на 3 scope
-- вместо tier_data+scope и отдельной global_tier_data)
-- ════════════════════════════════════════════════════════════

CREATE TABLE tier_lists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      text NOT NULL CHECK (scope IN ('global','team','personal')),
  team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,       -- NULL только для global
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NOT NULL только для personal
  name       text NOT NULL DEFAULT 'Тир-лист',
  is_default bool NOT NULL DEFAULT false,   -- смысл только для personal (несколько сетов у пользователя)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (
    (scope = 'global'   AND team_id IS NULL     AND user_id IS NULL) OR
    (scope = 'team'     AND team_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'personal' AND team_id IS NOT NULL AND user_id IS NOT NULL)
  )
);

-- Ровно 1 global-строка во всей таблице
CREATE UNIQUE INDEX idx_tier_lists_one_global ON tier_lists(scope) WHERE scope = 'global';
-- Ровно 1 team-строка на team_id
CREATE UNIQUE INDEX idx_tier_lists_one_team   ON tier_lists(team_id) WHERE scope = 'team';
-- Не более 1 default personal-сета на (user_id, team_id) — сам лимит "до 10" через триггер ниже
CREATE UNIQUE INDEX idx_tier_lists_default    ON tier_lists(user_id, team_id) WHERE scope = 'personal' AND is_default = true;

CREATE OR REPLACE FUNCTION _check_tier_list_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scope = 'personal' THEN
    IF (SELECT COUNT(*) FROM tier_lists
        WHERE user_id = NEW.user_id AND team_id = NEW.team_id AND scope = 'personal') >= 10 THEN
      RAISE EXCEPTION 'max_personal_tier_lists';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tier_list_limit BEFORE INSERT ON tier_lists FOR EACH ROW EXECUTE FUNCTION _check_tier_list_limit();

CREATE OR REPLACE FUNCTION _reassign_default_tier_list()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.scope = 'personal' AND OLD.is_default THEN
    UPDATE tier_lists SET is_default = true
    WHERE id = (
      SELECT id FROM tier_lists
      WHERE user_id = OLD.user_id AND team_id = OLD.team_id AND scope = 'personal' AND id <> OLD.id
      ORDER BY created_at LIMIT 1
    );
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_tier_list_reassign_default AFTER DELETE ON tier_lists FOR EACH ROW EXECUTE FUNCTION _reassign_default_tier_list();
CREATE TRIGGER trg_tier_lists_updated BEFORE UPDATE ON tier_lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tier_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_list_id uuid NOT NULL REFERENCES tier_lists(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('hero','map')),
  hero_id      uuid REFERENCES hero_catalog(id) ON DELETE CASCADE,
  map_id       uuid REFERENCES map_catalog(id) ON DELETE CASCADE,
  tier         text NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  position     smallint NOT NULL DEFAULT 0,
  CHECK (
    (entity_type = 'hero' AND hero_id IS NOT NULL AND map_id IS NULL) OR
    (entity_type = 'map'  AND map_id  IS NOT NULL AND hero_id IS NULL)
  )
);

-- Один item — одна запись в конкретном тир-листе
CREATE UNIQUE INDEX idx_tier_entries_hero ON tier_entries(tier_list_id, hero_id) WHERE entity_type = 'hero';
CREATE UNIQUE INDEX idx_tier_entries_map  ON tier_entries(tier_list_id, map_id)  WHERE entity_type = 'map';
CREATE INDEX idx_tier_entries_list ON tier_entries(tier_list_id, entity_type);

-- ════════════════════════════════════════════════════════════
-- ЧАСТЬ 7 — tier_share_links: репойнт FK на tier_lists
-- ════════════════════════════════════════════════════════════

ALTER TABLE tier_share_links
  ADD CONSTRAINT fk_share_links_tier_list
  FOREIGN KEY (tier_set_id) REFERENCES tier_lists(id) ON DELETE CASCADE;
-- Политики "share_links: owner"/"share_links: public read" уже существуют
-- (003_rls.sql) и работают только с user_id/is_public — репойнт FK их не касается.
