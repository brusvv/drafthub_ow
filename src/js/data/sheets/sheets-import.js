// @hash b54e98f9 2026-07-04T23:29
// ════ SHEETS IMPORT — ЗАПИСЬ В SUPABASE (IMPORT-1c + MIGR-6) ════
// Основной файл группы sheets-import-*.js после FILESPLIT-1 (03.07) —
// парсеры вынесены в sheets-import-parse.js, резолв имён→id каталога в
// sheets-import-resolve.js. Здесь — только importXFromSheets, вызываемые
// UI-обвязкой (data/sheets/sheets-import-ui.js).
//
// Каждая функция независима: вызывающий код (sheets-import-ui.js) оборачивает
// каждую в try/catch и копит {imported,skipped,partial,errors} на уровне ГРУПП.
// Контракт возврата — {count, unresolved} (IMPORT-BUG-1, 04.07: раньше был
// {count}, нерезолвленные имена уходили только в console.warn и терялись
// для UI). unresolved — deduped массив имён не найденных в каталоге,
// может быть пустым. Не поднимается до уровня group-error — это мягкая
// деградация внутри успешной группы, не сбой всей группы.
//
// Зависимости: sheets-import-parse.js (_parseCounters, _parseBoolTrue,
//              _rowsToObjects), sheets-import-resolve.js (_resolveHeroId,
//              _resolveMapId, _assembleMapsFromSheets, _assemblePlayersFromSheets,
//              _warnUnresolved), sheets-auth.js (_sheetsAccessToken, _sheetsBatchGet),
//              auth.js (_sb), session.js (currentUser, isSuperAdmin, canWrite),
//              data/db/db-load.js (_teamId, _resolveTierListId, activeTierSetId),
//              data/db/db-write.js (createTierSet)

async function importHeroesFromSheets(sheetsMap){
  const rows = sheetsMap.get('Heroes');
  if(!rows) return { count: 0, unresolved: [] };

  // role/subrole больше НЕ читаем — это поля hero_catalog (MIGR-1), правит
  // только superadmin через админку. Имя всё ещё нужно — ключ резолва
  // в существующего героя каталога, добавить нового героя импорт не может.
  const heroObjs = _rowsToObjects(rows, ['name','priority','banned','notes','counters']);

  const unresolvedNames = [];
  const resolved = heroObjs.map(h => {
    const heroId = _resolveHeroId(h.name);
    if(!heroId){ if(h.name) unresolvedNames.push(h.name); return null; }
    return { heroId, priority: h.priority, banned: h.banned, notes: h.notes,
             counters: _parseCounters(h.counters) };
  }).filter(Boolean);
  _warnUnresolved('Heroes', unresolvedNames);
  if(!resolved.length) return { count: 0, unresolved: [...new Set(unresolvedNames)] };

  const upsertRows = resolved.map(r => ({
    team_id:  _teamId(),
    hero_id:  r.heroId,
    priority: parseInt(r.priority, 10) || 5,
    banned:   _parseBoolTrue(r.banned),
    notes:    r.notes || '',
  }));
  const { error } = await _sb.from('heroes')
    .upsert(upsertRows, { onConflict: 'team_id,hero_id' });
  if(error) throw error;

  // Контрпики теперь отдельная таблица hero_counters (scope='team'), не
  // heroes.counters jsonb — см. пометку в 007_catalog_tables.sql про
  // архитектурное решение. Полностью заменяем набор контрпиков ТОЛЬКО для
  // героев из этого импорта (delete .in(heroIds) + insert), не трогая
  // контрпики героев не затронутых текущим импортом — тот же принцип
  // upsert-не-wipe, что и для остальных групп.
  const counterResult = await _importTeamHeroCounters(resolved.map(r => ({ heroId: r.heroId, counters: r.counters })));

  // IMPORT-BUG-1: раньше unresolvedCounters терялся внутри
  // _importTeamHeroCounters — теперь мержим с unresolvedNames героев.
  return {
    count: upsertRows.length,
    unresolved: [...new Set([...unresolvedNames, ...(counterResult.unresolved || [])])],
  };
}

// Bulk-версия _saveScopedHeroCounters (db-write.js) — та переписывает
// контрпики ОДНОГО героя за раз (2 запроса на героя, для интерактивного
// сохранения формы это нормально). Для импорта N героев это было бы 2N
// последовательных round-trip'ов — здесь один delete + один bulk insert
// на весь импортируемый батч.
async function _importTeamHeroCounters(entries){
  const withCounters = entries.filter(e => e.counters?.length);
  if(!withCounters.length) return { unresolved: [] };

  const heroIds = withCounters.map(e => e.heroId);
  const { error: delErr } = await _sb.from('hero_counters')
    .delete().eq('scope', 'team').eq('team_id', _teamId()).in('hero_id', heroIds);
  if(delErr) throw delErr;

  const unresolvedCounters = [];
  const insertRows = [];
  withCounters.forEach(e => {
    e.counters.forEach(c => {
      const counterId = _resolveHeroId(c.name);
      if(!counterId){ unresolvedCounters.push(c.name); return; }
      if(counterId === e.heroId) return; // CHECK(hero_id<>counter_hero_id) — герой не контрит сам себя
      insertRows.push({
        scope: 'team', team_id: _teamId(),
        hero_id: e.heroId, counter_hero_id: counterId, score: c.score,
      });
    });
  });
  _warnUnresolved('Heroes → counters', unresolvedCounters);
  if(!insertRows.length) return { unresolved: [...new Set(unresolvedCounters)] };

  const { error: insErr } = await _sb.from('hero_counters').insert(insertRows);
  if(insErr) throw insErr;

  return { unresolved: [...new Set(unresolvedCounters)] };
}

async function importMapsFromSheets(sheetsMap){
  const { rows, unresolved } = _assembleMapsFromSheets(sheetsMap);   // резолв id + warn уже внутри
  if(!rows.length) return { count: 0, unresolved };

  const upsertRows = rows.map(m => ({ ...m, team_id: _teamId() }));
  const { error } = await _sb.from('maps')
    .upsert(upsertRows, { onConflict: 'team_id,map_id' });
  if(error) throw error;
  return { count: upsertRows.length, unresolved };
}

async function importPlayersFromSheets(sheetsMap){
  const assembled = _assemblePlayersFromSheets(sheetsMap);
  if(!assembled.length) return { count: 0, unresolved: [] };

  const upsertRows = assembled.map(p => ({ ...p, team_id: _teamId() }));

  const { error } = await _sb.from('players')
    .upsert(upsertRows, { onConflict: 'team_id,name' });
  if(error) throw error;
  // players не ссылается на каталог (MIGR-1 не трогал) — резолва нет,
  // unresolved всегда пуст. Оставлен в контракте ради единообразия с
  // остальными importXFromSheets, чтобы sheets-import-ui.js не делал
  // ветвление по функциям.
  return { count: upsertRows.length, unresolved: [] };
}

async function importHeroMapStrengthFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroMapStrength');
  if(!rows) return { count: 0, unresolved: [] };

  const objs = _rowsToObjects(rows, ['hero','map','atk','def']);
  const unresolvedHeroes = [], unresolvedMaps = [];
  const upsertRows = objs.map(r => {
    const heroId = _resolveHeroId(r.hero);
    const mapId  = _resolveMapId(r.map);
    if(!heroId && r.hero) unresolvedHeroes.push(r.hero);
    if(!mapId  && r.map)  unresolvedMaps.push(r.map);
    if(!heroId || !mapId) return null;
    return {
      team_id: _teamId(), hero_id: heroId, map_id: mapId,
      atk: parseInt(r.atk, 10) || 0, def: parseInt(r.def, 10) || 0,
    };
  }).filter(Boolean);
  _warnUnresolved('HeroMapStrength → герои', unresolvedHeroes);
  _warnUnresolved('HeroMapStrength → карты', unresolvedMaps);
  const unresolved = [...new Set([...unresolvedHeroes, ...unresolvedMaps])];
  if(!upsertRows.length) return { count: 0, unresolved };

  // PRIMARY KEY (team_id,hero_id,map_id) — полный (не partial), чистый UPSERT ok
  const { error } = await _sb.from('hero_map_strength')
    .upsert(upsertRows, { onConflict: 'team_id,hero_id,map_id' });
  if(error) throw error;
  return { count: upsertRows.length, unresolved };
}

async function importHeroSynergyFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroSynergy');
  if(!rows) return { count: 0, unresolved: [] };

  const objs = _rowsToObjects(rows, ['hero','synergy_hero','score']);
  const unresolvedHeroes = [];
  const upsertRows = objs.map(r => {
    const heroId    = _resolveHeroId(r.hero);
    const synergyId = _resolveHeroId(r.synergy_hero);
    if(!heroId    && r.hero)         unresolvedHeroes.push(r.hero);
    if(!synergyId && r.synergy_hero) unresolvedHeroes.push(r.synergy_hero);
    if(!heroId || !synergyId) return null;
    if(heroId === synergyId) return null;   // CHECK(hero_id<>synergy_hero_id)
    return {
      team_id: _teamId(), hero_id: heroId, synergy_hero_id: synergyId,
      score: parseInt(r.score, 10) || 5,
    };
  }).filter(Boolean);
  _warnUnresolved('HeroSynergy', unresolvedHeroes);
  const unresolved = [...new Set(unresolvedHeroes)];
  if(!upsertRows.length) return { count: 0, unresolved };

  // PRIMARY KEY (team_id,hero_id,synergy_hero_id) — полный, чистый UPSERT ok
  const { error } = await _sb.from('hero_synergy')
    .upsert(upsertRows, { onConflict: 'team_id,hero_id,synergy_hero_id' });
  if(error) throw error;
  return { count: upsertRows.length, unresolved };
}

// ── Тир-листы — TierMaps/TierHeroes, с выбором scope ──
// scope: 'team' | 'personal' | 'global' — решение пользователя в UI.
// 'global' пишет в tier_lists/tier_entries с RLS "superadmin only" —
// проверяем isSuperAdmin() (не isAdmin()!), иначе обычный admin пройдёт
// клиентскую проверку и упадёт на RLS с непонятной ошибкой (см. 008_catalog_rls.sql
// "tier_lists: global write" — там именно is_superadmin(), не is_app_admin()).
//
// position берём из порядка строк в листе (индекс внутри каждого тира) —
// тот же принцип что в _tierObjToRows (db-write.js) для drag&drop сохранения.
async function importTiersFromSheets(sheetsMap, entityType, scope){
  const sheetName = entityType === 'map' ? 'TierMaps' : 'TierHeroes';
  const rows = sheetsMap.get(sheetName);
  if(!rows) return { count: 0, unresolved: [] };

  if(scope === 'global' && !isSuperAdmin()){
    throw new Error('Глобальный тир-лист может импортировать только суперадминистратор');
  }
  if(scope !== 'global' && !canWrite()){
    throw new Error('Нет прав на запись командного/личного тир-листа');
  }

  const objs = _rowsToObjects(rows, ['name','tier']);
  const resolveId = entityType === 'map' ? _resolveMapId : _resolveHeroId;

  const posCounters = {};
  const unresolvedNames = [];
  const entryRows = objs.filter(r => r.name && r.tier).map(r => {
    const id = resolveId(r.name);
    if(!id){ unresolvedNames.push(r.name); return null; }
    const tier = r.tier.toUpperCase();
    if(!(tier in posCounters)) posCounters[tier] = 0;
    const position = posCounters[tier]++;
    return {
      entity_type: entityType,
      hero_id: entityType === 'hero' ? id : null,
      map_id:  entityType === 'map'  ? id : null,
      tier, position,
    };
  }).filter(Boolean);
  _warnUnresolved(`Tier${entityType === 'map' ? 'Maps' : 'Heroes'}`, unresolvedNames);
  const unresolved = [...new Set(unresolvedNames)];
  if(!entryRows.length) return { count: 0, unresolved };

  // Резолв/создание контейнера — переиспользуем MIGR-2 хелперы, не пишем
  // свою версию (_resolveTierListId — data/db/db-load-tiers.js, createTierSet — data/db/db-write.js).
  let tierListId;
  if(scope === 'global'){
    tierListId = await _resolveTierListId('global', {});
  } else if(scope === 'team'){
    tierListId = await _resolveTierListId('team', { teamId: _teamId() });
  } else {
    // Личный: активный сет или создаём новый — та же логика что уже была
    // до MIGR-6, только имя переменной/таблицы сменилось (tier_set → tier_list).
    tierListId = activeTierSetId;
    if(!tierListId){
      const created = await createTierSet('Импортировано');
      tierListId = created?.id ?? null;
    }
  }
  if(!tierListId) throw new Error('Не удалось определить тир-лист для импорта');

  const rowsWithList = entryRows.map(r => ({ ...r, tier_list_id: tierListId }));

  // Delete-then-insert — тот же паттерн что _writeTierEntries (db-write.js):
  // idx_tier_entries_hero/_map частичные unique-индексы (WHERE entity_type=...),
  // чистый UPSERT с ON CONFLICT под partial index PostgREST не поддерживает.
  const { error: delErr } = await _sb.from('tier_entries').delete()
    .eq('tier_list_id', tierListId).eq('entity_type', entityType);
  if(delErr) throw delErr;

  const { error: insErr } = await _sb.from('tier_entries').insert(rowsWithList);
  if(insErr) throw insErr;

  return { count: rowsWithList.length, unresolved };
}
