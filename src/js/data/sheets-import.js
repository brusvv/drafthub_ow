// @hash d92b1158 2026-07-02T08:48
// ════ SHEETS IMPORT — Google Sheets → Supabase ════
// IMPORT-1a/1b/1c + MIGR-6: чтение листов через _sheetsBatchGet (sheets-auth.js),
// парсинг строк в объекты, резолв имён в id каталога, запись через UPSERT.
// UI-обвязка (выбор типа импорта, превью, кнопка запуска) — отдельно,
// в data/sheets-import-ui.js.
//
// MIGR-6: после MIGR-1 (id-based каталог) старые UPSERT по text-ключам
// (onConflict:'team_id,name' и т.п.) больше не матчат схему — heroes/maps
// теперь ссылаются на hero_catalog/map_catalog через hero_id/map_id.
// Каталог фиксированный, курируемый — импорт НЕ создаёт в нём новые записи;
// имя из Sheets, не найденное в каталоге, просто выпадает из этой конкретной
// строки/массива (console.warn со списком) — не блокирует остальной импорт.
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, _sheetsBatchGet),
//              auth.js (_sb), session.js (currentUser, isAdmin, isSuperAdmin, canWrite),
//              data/db-load.js (_teamId, _heroCatalogByName, _mapCatalogByName,
//                                _resolveTierListId, activeTierSetId),
//              data/db-write.js (createTierSet)

// ════ ПАРСЕРЫ — строки листов в Supabase-объекты (IMPORT-1b) ════
// Чистые функции, без сети — принимают rows (string[][], rows[0]=заголовок)
// и собирают объекты в формате готовом для UPSERT. Логика записи/scope —
// в функциях importXFromSheets ниже, здесь только трансформация данных.

// "Ana:8,Baptiste:7" → [{name:'Ana',score:8},{name:'Baptiste',score:7}]
// Пустая строка/мусор в одном элементе не валит весь парсинг — просто
// пропускается (toString().trim() защищает от undefined ячеек).
function _parseCounters(str){
  if(!str) return [];
  return String(str).split(',')
    .map(s => s.trim()).filter(Boolean)
    .map(pair => {
      const [name, scoreRaw] = pair.split(':').map(x => x?.trim());
      const score = parseInt(scoreRaw, 10);
      // Без числового score после ':' запись считаем мусором/опечаткой,
      // не угадываем дефолт — реальные данные всегда "Name:score"
      return (name && Number.isFinite(score)) ? { name, score } : null;
    })
    .filter(Boolean);
}

// 'TRUE'/'true'/'1' → true, всё остальное (включая пусто) → false
function _parseBoolTrue(str){
  const s = String(str || '').trim().toLowerCase();
  return s === 'true' || s === '1';
}

// "Tracer;Genji;Ana" → ['Tracer','Genji','Ana']  (для PlayerHeroes, если
// где-то понадобится строка вместо отдельных строк-листа — сейчас не
// используется т.к. PlayerHeroes хранит по одной паре player/hero на строку,
// но оставляю как общий хелпер для согласованности с экспортным форматом)
function _parseSemicolonList(str){
  if(!str) return [];
  return String(str).split(';').map(s => s.trim()).filter(Boolean);
}

// rows (string[][], rows[0]=header) → [{col1:val1,col2:val2,...}, ...]
// Header матчится по позиции по ожидаемому списку колонок (case-insensitive,
// trim) — НЕ полагаемся на точный порядок колонок в реальном листе, мапим
// по имени, если порядок в боевой таблице вдруг отличается от REQUIRED_SHEETS.
function _rowsToObjects(rows, expectedCols){
  if(!rows || rows.length < 2) return [];
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const colIdx = {};
  expectedCols.forEach(col => {
    const idx = header.indexOf(col.toLowerCase());
    colIdx[col] = idx;   // -1 если колонки нет в листе — поле останется undefined
  });
  return rows.slice(1)
    .filter(r => r.some(cell => String(cell || '').trim()))   // пропускаем полностью пустые строки
    .map(r => {
      const obj = {};
      expectedCols.forEach(col => { obj[col] = colIdx[col] >= 0 ? r[colIdx[col]] : undefined; });
      return obj;
    });
}

// ════ РЕЗОЛВЕРЫ ИМЁН → ID КАТАЛОГА (MIGR-6) ════
// Sheets — свободный текст, вводится руками, подвержен опечаткам/разнице
// в форматировании ("King's Row" vs "Kings Row"). heroKey()/mapKey()
// (config.js) — та же нормализация что уже использует portrait-matching,
// переиспользуем вместо новой логики. Индексы строятся ЛЕНИВО и кэшируются
// на время сессии — каталог не меняется посреди одного захода в импорт
// (_heroCatalogByName/_mapCatalogByName уже загружены _loadCatalogs() при
// старте приложения, доп. сетевых запросов не требуется).
let _importHeroKeyIndex = null;   // heroKey(name) -> hero_catalog.id
let _importMapKeyIndex  = null;   // mapKey(name)  -> map_catalog.id

function _buildImportIndices(){
  if(_importHeroKeyIndex && _importMapKeyIndex) return;
  _importHeroKeyIndex = {};
  Object.values(_heroCatalogByName).forEach(h => { _importHeroKeyIndex[heroKey(h.name)] = h.id; });
  _importMapKeyIndex = {};
  Object.values(_mapCatalogByName).forEach(m => { _importMapKeyIndex[mapKey(m.name)] = m.id; });
}

function _resolveHeroId(name){
  if(!name) return null;
  _buildImportIndices();
  return _importHeroKeyIndex[heroKey(name)] || null;
}
function _resolveMapId(name){
  if(!name) return null;
  _buildImportIndices();
  return _importMapKeyIndex[mapKey(name)] || null;
}

// Единая точка логирования нерезолвленных имён — не блокирует импорт,
// просто оставляет след в консоли, чтобы пользователь мог поправить Sheets
// или попросить добавить героя/карту в каталог.
function _warnUnresolved(label, names){
  if(!names?.length) return;
  console.warn(`[sheets-import] ${label}: не найдены в каталоге — ${[...new Set(names)].join(', ')}`);
}

// ── Сборка Maps из 5 листов: Maps + MapPreferred + MapBans + Compositions + MapCounters ──
// Принимает Map<sheetName,rows> от _sheetsBatchGet — листы которых нет в Map
// (пользователь не выбрал/лист пуст) просто дают пустые join-данные, базовая
// карта всё равно соберётся из Maps (если она сама резолвится в каталог).
//
// type/inpool больше НЕ читаем из листа — это поля map_catalog (MIGR-1),
// правит только superadmin через админку, импорт их не трогает.
function _assembleMapsFromSheets(sheetsMap){
  const mapsRows = sheetsMap.get('Maps');
  if(!mapsRows) return [];

  const base = _rowsToObjects(mapsRows, ['name','tier','priority','atk','def','dif','notes']);

  // join-листы группируем по имени карты заранее — O(n) вместо O(n*m) перебора
  const groupByMap = (sheetName, cols) => {
    const rows = sheetsMap.get(sheetName);
    const grouped = {};
    if(!rows) return grouped;
    _rowsToObjects(rows, cols).forEach(r => {
      const key = r.map;
      if(!key) return;
      (grouped[key] ??= []).push(r);
    });
    return grouped;
  };

  const preferred = groupByMap('MapPreferred', ['map','hero']);
  const bans      = groupByMap('MapBans',      ['map','hero']);
  const comp      = groupByMap('Compositions', ['map','hero','role','playerRole']);
  const counters  = groupByMap('MapCounters',  ['map','hero']);

  const unresolvedMaps = [];
  const unresolvedHeroes = [];

  // Список имён героев → список резолвленных id, нерезолвленные просто
  // выпадают из массива (не роняют всю карту) — см. шапку файла.
  const resolveHeroList = list => (list || []).map(r => {
    const id = _resolveHeroId(r.hero);
    if(!id && r.hero) unresolvedHeroes.push(r.hero);
    return id;
  }).filter(Boolean);

  const rows = base.map(m => {
    const mapId = _resolveMapId(m.name);
    if(!mapId){ if(m.name) unresolvedMaps.push(m.name); return null; }

    const compList = (comp[m.name] || []).map(r => {
      const heroId = _resolveHeroId(r.hero);
      if(!heroId){ if(r.hero) unresolvedHeroes.push(r.hero); return null; }
      return { hero_id: heroId, role: r.role || '', playerRole: r.playerRole || r.role || '' };
    }).filter(Boolean);

    return {
      map_id:   mapId,
      tier:     m.tier || 'B',
      priority: parseInt(m.priority, 10) || 5,
      atk:      parseInt(m.atk, 10) || 3,
      def:      parseInt(m.def, 10) || 3,
      dif:      parseInt(m.dif, 10) || 3,
      notes:    m.notes || '',
      preferred_heroes: resolveHeroList(preferred[m.name]),
      ban_heroes:       resolveHeroList(bans[m.name]),
      counters:         resolveHeroList(counters[m.name]),
      comp: compList,
    };
  }).filter(Boolean);

  _warnUnresolved('Maps', unresolvedMaps);
  _warnUnresolved('Maps → герои (preferred/bans/counters/comp)', unresolvedHeroes);
  return rows;
}

// ── Сборка Players из 2 листов: Players + PlayerHeroes ──
// players НЕ ссылается на каталог (MIGR-1 её не трогал) — main_heroes/
// pool_heroes остаются text[] имён как раньше, резолв id не нужен.
// PlayerHeroes.type: 'main' → основная роль (main_heroes), 'pool' → офф-роль
// (pool_heroes) — подтверждено пользователем явно, не угадано.
function _assemblePlayersFromSheets(sheetsMap){
  const playersRows = sheetsMap.get('Players');
  if(!playersRows) return [];

  const base = _rowsToObjects(playersRows,
    ['name','btag','mainrole','offrole','ranktank','rankdmg','ranksup','notes']);

  const heroesByPlayer = {};   // { playerName: { main:[...], pool:[...] } }
  const phRows = sheetsMap.get('PlayerHeroes');
  if(phRows){
    _rowsToObjects(phRows, ['player','hero','type']).forEach(r => {
      if(!r.player || !r.hero) return;
      const entry = (heroesByPlayer[r.player] ??= { main: [], pool: [] });
      const type = String(r.type || '').trim().toLowerCase();
      if(type === 'main') entry.main.push(r.hero);
      else if(type === 'pool') entry.pool.push(r.hero);
      // неизвестный type — молча пропускаем (не падаем на грязных данных)
    });
  }

  return base.map(p => {
    const h = heroesByPlayer[p.name] || { main: [], pool: [] };
    return {
      name:      p.name,
      btag:      p.btag || '',
      main_role: p.mainrole || '',
      off_role:  p.offrole || '',
      rank_tank: p.ranktank || '',
      rank_dmg:  p.rankdmg || '',
      rank_sup:  p.ranksup || '',
      notes:     p.notes || '',
      main_heroes: h.main,
      pool_heroes: h.pool,
    };
  }).filter(p => p.name);
}

// ════ ИМПОРТ — запись в Supabase через UPSERT (IMPORT-1c + MIGR-6) ════
// Каждая функция независима: вызывающий код (sheets-import-ui.js) оборачивает
// каждую в try/catch и копит {imported,skipped,errors} на уровне ГРУПП —
// возврат {count} здесь такой же контракт что был раньше, одна упавшая
// группа не блокирует остальные. Строки/имена, не резолвнутые в каталог —
// отдельная более мелкая деградация внутри группы (см. _warnUnresolved),
// не поднимаются до уровня group-error.

async function importHeroesFromSheets(sheetsMap){
  const rows = sheetsMap.get('Heroes');
  if(!rows) return { count: 0 };

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
  if(!resolved.length) return { count: 0 };

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
  await _importTeamHeroCounters(resolved.map(r => ({ heroId: r.heroId, counters: r.counters })));

  return { count: upsertRows.length };
}

// Bulk-версия _saveScopedHeroCounters (db-write.js) — та переписывает
// контрпики ОДНОГО героя за раз (2 запроса на героя, для интерактивного
// сохранения формы это нормально). Для импорта N героев это было бы 2N
// последовательных round-trip'ов — здесь один delete + один bulk insert
// на весь импортируемый батч.
async function _importTeamHeroCounters(entries){
  const withCounters = entries.filter(e => e.counters?.length);
  if(!withCounters.length) return;

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
  if(!insertRows.length) return;

  const { error: insErr } = await _sb.from('hero_counters').insert(insertRows);
  if(insErr) throw insErr;
}

async function importMapsFromSheets(sheetsMap){
  const rows = _assembleMapsFromSheets(sheetsMap);   // резолв id + warn уже внутри
  if(!rows.length) return { count: 0 };

  const upsertRows = rows.map(m => ({ ...m, team_id: _teamId() }));
  const { error } = await _sb.from('maps')
    .upsert(upsertRows, { onConflict: 'team_id,map_id' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importPlayersFromSheets(sheetsMap){
  const assembled = _assemblePlayersFromSheets(sheetsMap);
  if(!assembled.length) return { count: 0 };

  const upsertRows = assembled.map(p => ({ ...p, team_id: _teamId() }));

  const { error } = await _sb.from('players')
    .upsert(upsertRows, { onConflict: 'team_id,name' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importHeroMapStrengthFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroMapStrength');
  if(!rows) return { count: 0 };

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
  if(!upsertRows.length) return { count: 0 };

  // PRIMARY KEY (team_id,hero_id,map_id) — полный (не partial), чистый UPSERT ok
  const { error } = await _sb.from('hero_map_strength')
    .upsert(upsertRows, { onConflict: 'team_id,hero_id,map_id' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importHeroSynergyFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroSynergy');
  if(!rows) return { count: 0 };

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
  if(!upsertRows.length) return { count: 0 };

  // PRIMARY KEY (team_id,hero_id,synergy_hero_id) — полный, чистый UPSERT ok
  const { error } = await _sb.from('hero_synergy')
    .upsert(upsertRows, { onConflict: 'team_id,hero_id,synergy_hero_id' });
  if(error) throw error;
  return { count: upsertRows.length };
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
  if(!rows) return { count: 0 };

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
  if(!entryRows.length) return { count: 0 };

  // Резолв/создание контейнера — переиспользуем MIGR-2 хелперы, не пишем
  // свою версию (_resolveTierListId — db-load.js, createTierSet — db-write.js).
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

  return { count: rowsWithList.length };
}
