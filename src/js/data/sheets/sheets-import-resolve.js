// @hash 94bc987d 2026-07-04T23:29
// ════ SHEETS IMPORT — РЕЗОЛВЕРЫ ИМЁН → ID КАТАЛОГА (MIGR-6) ════
// Вынесено из sheets-import.js (FILESPLIT-1, 03.07). Sheets — свободный
// текст, вводится руками, подвержен опечаткам/разнице в форматировании
// ("King's Row" vs "Kings Row"). heroKey()/mapKey() (config.js) — та же
// нормализация что уже использует portrait-matching, переиспользуем
// вместо новой логики. Индексы строятся ЛЕНИВО и кэшируются на время
// сессии — каталог не меняется посреди одного захода в импорт
// (_heroCatalogByName/_mapCatalogByName уже загружены _loadCatalogs()
// при старте приложения, доп. сетевых запросов не требуется).
//
// Зависимости: data/db/db-load.js (_heroCatalogByName, _mapCatalogByName),
//              core/config.js (heroKey, mapKey),
//              sheets-import-parse.js (не используется напрямую, но
//              загружается раньше по build.sh — оба нужны writer-функциям)

let _importHeroKeyIndex = null;   // heroKey(name) -> hero_catalog.id
let _importMapKeyIndex  = null;   // mapKey(name)  -> map_catalog.id

// БАГ (найден): индекс строился один раз за сессию и больше никогда не
// обновлялся. Если каталог меняется после первой загрузки страницы
// (superadmin добавил карту/героя в hero_catalog/map_catalog, например
// добавили 'Neon Junction' в map_catalog уже после того как пользователь
// открыл вкладку) — резолв по старому кэшу либо промахивался мимо новых
// записей, либо расходился между двумя запусками импорта в одной сессии
// (team отработал по свежему кэшу, global — по кэшу построенному раньше,
// или наоборот, в зависимости от того что вызывалось первым). Теперь
// перестраиваем индекс на каждый ЗАПУСК импорта (не на каждый вызов
// resolveId — дорого), а не один раз за всю сессию.
function _resetImportIndices(){ _importHeroKeyIndex = null; _importMapKeyIndex = null; }

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
// ⚠️ ИЗВЕСТНЫЙ ПРОБЕЛ (найден при аудите 03.07, не исправлен в этом проходе —
// см. AGENT_TASKS.md IMPORT-BUG-1): имена уходят только в console.warn,
// НИКУДА не возвращаются вызывающему коду. sheets-import-ui.js формирует
// report.skipped только когда ВСЯ группа вернула {count:0} — частичные
// пропуски внутри успешной группы (напр. 8 из 10 героев резолвились)
// невидимы пользователю, только в консоли браузера.
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
  // IMPORT-BUG-1: раньше имена уходили только в console.warn и терялись для
  // вызывающего кода — sheets-import-ui.js не мог показать их в отчёте.
  // Теперь возвращаем вместе с rows, dedup через Set как и в _warnUnresolved.
  return { rows, unresolved: [...new Set([...unresolvedMaps, ...unresolvedHeroes])] };
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
