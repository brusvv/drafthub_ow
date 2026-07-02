-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 010_catalog_team_seed_triggers.sql
-- MIGR-4: заменяет пункт «новый admin RPC для правки hero_catalog/
-- map_catalog» из исходного плана — он не нужен: RLS-политика
-- "hero_catalog: superadmin write" / "map_catalog: superadmin write"
-- (008_catalog_rls.sql) уже даёт superadmin полный CRUD напрямую через
-- обычный REST (_sb.from('hero_catalog').insert/update/delete(...)),
-- отдельная функция ничего не добавляет.
--
-- Единственное, чего RLS сама по себе не делает — это fan-out: если
-- create_team (004_rpc.sql) один раз bulk-seed'ит каталог в heroes/maps
-- новой команды, то при добавлении НОВОГО героя/карты в каталог (патч
-- игры, добавил superadmin) все УЖЕ существующие команды не получат
-- строку в своём ростере автоматически — просто останутся без него.
-- Эти два триггера закрывают именно это: любой INSERT в hero_catalog/
-- map_catalog сразу же заводит дефолтную roster-строку для каждой
-- существующей команды (per-team поля — дефолты колонок: priority=5,
-- banned=false и т.д., команда правит по мере надобности).
--
-- Применять после 007_catalog_tables.sql + 008_catalog_rls.sql + 009 (seed).
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _seed_hero_to_teams()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO heroes (team_id, hero_id)
  SELECT id, NEW.id FROM teams
  ON CONFLICT (team_id, hero_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_hero_catalog_seed_teams
  AFTER INSERT ON hero_catalog
  FOR EACH ROW EXECUTE FUNCTION _seed_hero_to_teams();

CREATE OR REPLACE FUNCTION _seed_map_to_teams()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO maps (team_id, map_id)
  SELECT id, NEW.id FROM teams
  ON CONFLICT (team_id, map_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_map_catalog_seed_teams
  AFTER INSERT ON map_catalog
  FOR EACH ROW EXECUTE FUNCTION _seed_map_to_teams();

-- Заметка: это ТОЛЬКО INSERT (новый герой/карта). UPDATE каталога (правка
-- роли/subrole/типа/in_pool существующей записи) ничего пересоздавать не
-- должен — per-team heroes/maps.hero_id/map_id ссылка не меняется, данные
-- на команды подтягиваются джойном на лету (db-load.js), не копируются.

NOTIFY pgrst, 'reload schema';
