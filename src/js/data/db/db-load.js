// @hash b996b478 2026-07-03T20:00
// ════ DATA — LOAD (Supabase) ════
// MIGR-2: переезд на id-based каталог (hero_catalog/map_catalog) +
// hero_counters на 3 scope (team добавлен — раньше team-контрпики жили
// прямо в heroes.counters).
//
// Тир-листы (tier_lists/tier_entries, personal-сеты, режимы global/team/
// personal) — в соседнем db-load-tiers.js (FILESPLIT-1, 03.07: файл разросся
// до 418 строк, тир-часть была больше половины и логически самодостаточна).
//
// Сохраняет ВНЕШНИЙ контракт для render-файлов: heroes[]/maps[] по-прежнему
// содержат .name (не .heroId) как основной идентификатор для UI,
// heroMapStrength/heroSynergy по-прежнему keyed by name — MIGR-3
// (render-tiers.js/render-tier-share.js) и остальной рендер-код не должны
// меняться из-за этого файла. id-based связи — деталь реализации внутри
// db-load*.js/db-write*.js.
//
// Зависимости: auth.js (_sb, dbSelect), session.js (currentTeam, currentUser),
//              db-load-tiers.js (loadTiers — вызывается из loadAllData)

// ════ LOAD ALL ════
async function loadAllData(){
  if(!currentTeam()) return;
  showLoading('mapGrid','card',8); showLoading('heroPool','hero',12); showLoading('playerGrid','player',5);
  try{
    await _loadCatalogs(); // hero_catalog/map_catalog — нужны ДО heroes/maps/tiers (id→name резолв)
    await Promise.all([
      loadPortraits(), loadMapScreenshots(),
      loadHeroes(), loadMaps(), loadPlayers(),
      loadTiers(), loadHeroMapStrength(), loadHeroSynergy(), // loadTiers() — db-load-tiers.js
    ]);
    // После loadHeroes() — нужен снимок teamHeroCounters (см. конец loadHeroes)
    await loadHeroCounters();
    renderCurrentView();
    // Обновляем счётчики в навигации после загрузки всех данных
    if(typeof updateNavCounts === 'function') updateNavCounts();
  }catch(e){ handleError(e); showError('mapGrid', 'Ошибка загрузки данных'); }
}

const _teamId = () => currentTeam()?.id;

// ════ КАТАЛОГИ (hero_catalog / map_catalog) — курируемый справочник игры,
// маленький (~50/~30 строк), грузим целиком раз за loadAllData(). Все
// дальнейшие id→name резолвы идут через эти карты, не через отдельные
// PostgREST embed-запросы — так проще и не завязано на угадывание имён
// FK-constraint'ов, которых у нас несколько на одну и ту же hero_catalog
// (hero_id/synergy_hero_id/counter_hero_id и т.д.). Используется и здесь,
// и в db-load-tiers.js (_mapCatalogById/_heroCatalogById читаются оттуда). ════
let _heroCatalogById   = {};  // id -> {id,name,role,subrole}
let _heroCatalogByName = {};  // name -> {id,name,role,subrole} — нужен db-write*.js
let _mapCatalogById    = {};  // id -> {id,name,type,in_pool}
let _mapCatalogByName  = {};  // name -> {id,name,type,in_pool}

async function _loadCatalogs(){
  const [{ data: hc, error: e1 }, { data: mc, error: e2 }] = await Promise.all([
    _sb.from('hero_catalog').select('id, name, role, subrole'),
    _sb.from('map_catalog').select('id, name, type, in_pool'),
  ]);
  if(e1) console.warn('_loadCatalogs hero_catalog error', e1);
  if(e2) console.warn('_loadCatalogs map_catalog error', e2);
  _heroCatalogById = {}; _heroCatalogByName = {};
  (hc||[]).forEach(h => { _heroCatalogById[h.id] = h; _heroCatalogByName[h.name] = h; });
  _mapCatalogById = {}; _mapCatalogByName = {};
  (mc||[]).forEach(m => { _mapCatalogById[m.id] = m; _mapCatalogByName[m.name] = m; });
}

function _resolveHeroNames(ids){ return (ids||[]).map(id => _heroCatalogById[id]?.name).filter(Boolean); }
function _resolveComp(comp){
  // ВАЖНО: поле называется .hero (не .name) — render-maps.js buildCompDisplay()
  // читает c.hero везде (heroMap[c.hero], portrait(c.hero), c.hero[0] для
  // плейсхолдера). Раньше здесь стояло .name — c.hero был undefined,
  // c.hero[0] кидал TypeError на любой карте с составом. Найдено при
  // проверке "preferred_heroes/comp — id vs имя" после MIGR-5.
  return (comp||[]).map(entry => {
    const cat = _heroCatalogById[entry.hero_id] || {};
    return { ...entry, hero: cat.name || '(?)', role: cat.role || entry.role };
  });
}

// ════ HEROES ════
async function loadHeroes(){
  const { data, error } = await _sb.from('heroes')
    .select('id, hero_id, priority, banned, notes, updated_at')
    .eq('team_id', _teamId());
  if(error){ heroes=[]; throw error; }

  heroes = (data||[]).map(r => {
    const cat = _heroCatalogById[r.hero_id] || {};
    return {
      id: r.id, heroId: r.hero_id,
      name: cat.name || '(?)', role: cat.role || '', subrole: cat.subrole || '',
      priority: r.priority ?? 5,
      banned: !!r.banned,
      notes: r.notes || '',
      counters: [], // заполняется ниже в loadHeroCounters() из hero_counters(scope='team') — раньше лежало прямо в heroes.counters, колонка удалена в MIGR-1
      strongMaps: [], weakMaps: [],
    };
  }).sort((a,b) => a.name.localeCompare(b.name)); // сортировка теперь клиентская — name живёт не в heroes, а в hero_catalog

  heroMap = {}; heroes.forEach(h => heroMap[h.name] = h);
}

// ════ HERO COUNTERS — global / team / personal (все три теперь в одной
// таблице hero_counters после MIGR-1, раньше team жил в heroes.counters) ════
let globalHeroCounters   = {}; // {heroName: [{name,score}]}
let teamHeroCounters     = {}; // {heroName: [{name,score}]} — теперь из БД, не снимок heroes.counters
let personalHeroCounters = {}; // {heroName: [{name,score}]}

async function loadHeroCounters(){
  await Promise.all([loadGlobalHeroCounters(), loadTeamHeroCounters(), loadPersonalHeroCounters()]);
  _applyCounterMode(tierViewMode); // tierViewMode — db-load-tiers.js
}

async function loadGlobalHeroCounters(){
  const { data, error } = await _sb.from('hero_counters')
    .select('hero_id, counter_hero_id, score').eq('scope', 'global');
  if(error){ console.warn('loadGlobalHeroCounters error', error); return; }
  globalHeroCounters = _groupHeroCounters(data);
}

async function loadTeamHeroCounters(){
  const { data, error } = await _sb.from('hero_counters')
    .select('hero_id, counter_hero_id, score')
    .eq('scope', 'team').eq('team_id', _teamId());
  if(error){ console.warn('loadTeamHeroCounters error', error); return; }
  teamHeroCounters = _groupHeroCounters(data);
}

async function loadPersonalHeroCounters(){
  if(!currentUser()){ personalHeroCounters = {}; return; }
  const { data, error } = await _sb.from('hero_counters')
    .select('hero_id, counter_hero_id, score')
    .eq('scope', 'personal').eq('team_id', _teamId()).eq('user_id', currentUser().id);
  if(error){ console.warn('loadPersonalHeroCounters error', error); return; }
  personalHeroCounters = _groupHeroCounters(data);
}

function _groupHeroCounters(rows){
  const out = {};
  (rows || []).forEach(r => {
    const heroName    = _heroCatalogById[r.hero_id]?.name;
    const counterName = _heroCatalogById[r.counter_hero_id]?.name;
    if(!heroName || !counterName) return; // защита от осиротевших id (не должно случаться при FK ON DELETE CASCADE, но не доверяем молча)
    if(!out[heroName]) out[heroName] = [];
    out[heroName].push({ name: counterName, score: r.score });
  });
  return out;
}

// Подменяет .counters у каждого героя в массиве heroes — все существующие
// читатели (render-heroes.js, scoring-bans.js, scoring-comp.js, драфт-вью,
// modal-hero.js) просто читают hero.counters и не знают о режимах вообще.
// Вызывается и отсюда (после загрузки), и из db-load-tiers.js switchTierMode()
// (после переключения режима на лету).
function _applyCounterMode(mode){
  const source = mode === 'global'   ? globalHeroCounters
                : mode === 'personal' ? personalHeroCounters
                : teamHeroCounters;
  heroes.forEach(h => { h.counters = source[h.name] || []; });
}

// ════ MAPS ════
async function loadMaps(){
  const { data, error } = await _sb.from('maps')
    .select('id, map_id, tier, priority, atk, def, dif, notes, preferred_heroes, ban_heroes, counters, comp, updated_at')
    .eq('team_id', _teamId());
  if(error){ maps=[]; throw error; }

  maps = (data||[]).map(r => {
    const cat = _mapCatalogById[r.map_id] || {};
    return {
      id: r.id, mapId: r.map_id,
      name: cat.name || '(?)', type: cat.type || '', tier: r.tier || 'B',
      priority: r.priority ?? 5,
      atk: r.atk ?? 3, def: r.def ?? 3, dif: r.dif ?? 3,
      notes: r.notes || '',
      inPool: cat.in_pool !== false, // сезонный пул теперь глобальный факт игры (map_catalog), не per-team поле
      preferredHeroes: _resolveHeroNames(r.preferred_heroes), // было text[] имён, теперь uuid[] hero_id
      bans: _resolveHeroNames(r.ban_heroes),
      counters: _resolveHeroNames(r.counters),
      comp: _resolveComp(r.comp), // jsonb [{hero_id,...}] → [{hero_id,name,role,...}]
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
}

// ════ PLAYERS ════ (не тронуто MIGR-1 — players не ссылается на каталог)
async function loadPlayers(){
  const { data, error } = await _sb.from('players')
    .select('*').eq('team_id', _teamId()).order('name');
  if(error){ players=[]; throw error; }

  players = (data||[]).map(r => ({
    id: r.id,
    name: r.name, btag: r.btag || '',
    mainRole: r.main_role || '', offRole: r.off_role || '',
    rankTank: r.rank_tank || '', rankDmg: r.rank_dmg || '', rankSup: r.rank_sup || '',
    notes: r.notes || '',
    mainHeroes: r.main_heroes || [],
    poolHeroes: r.pool_heroes || [],
    userId: r.user_id || null,
  }));
}

// ════ HERO MAP STRENGTH ════
let heroMapStrength = {};  // { heroName: { mapName: {atk,def,avg} } } — контракт не изменился

async function loadHeroMapStrength(){
  heroMapStrength = {};
  const { data, error } = await _sb.from('hero_map_strength')
    .select('hero_id, map_id, atk, def').eq('team_id', _teamId());
  if(error){ console.warn('loadHeroMapStrength error', error); return; }

  (data||[]).forEach(r => {
    const heroName = _heroCatalogById[r.hero_id]?.name;
    const mapName  = _mapCatalogById[r.map_id]?.name;
    if(!heroName || !mapName) return;
    const atk = r.atk || 0;
    const def = r.def || atk;
    const avg = def ? Math.round((atk+def)/2) : atk;
    if(!heroMapStrength[heroName]) heroMapStrength[heroName] = {};
    heroMapStrength[heroName][mapName] = { atk, def, avg };
  });

  heroes.forEach(h => {
    const entries = Object.entries(heroMapStrength[h.name] || {});
    h.strongMaps = entries.filter(([,v]) => v.avg>=7).map(([m])=>m);
    h.weakMaps   = entries.filter(([,v]) => v.avg<=4).map(([m])=>m);
  });
}

// ════ HERO SYNERGY ════
let heroSynergy = {};  // { heroName: [{name, score}] } — контракт не изменился

async function loadHeroSynergy(){
  heroSynergy = {};
  const { data, error } = await _sb.from('hero_synergy')
    .select('hero_id, synergy_hero_id, score').eq('team_id', _teamId());
  if(error){ console.warn('loadHeroSynergy error', error); return; }

  (data||[]).forEach(r => {
    const heroName    = _heroCatalogById[r.hero_id]?.name;
    const synergyName = _heroCatalogById[r.synergy_hero_id]?.name;
    if(!heroName || !synergyName) return;
    if(!heroSynergy[heroName]) heroSynergy[heroName] = [];
    heroSynergy[heroName].push({ name: synergyName, score: r.score });
  });
}
