// @hash 79f503be 2026-07-02T09:25
// ════ DATA — LOAD (Supabase) ════
// MIGR-2: переезд на id-based каталог (hero_catalog/map_catalog) +
// unified tier_lists/tier_entries вместо tier_data+global_tier_data+
// personal_tier_sets, hero_counters на 3 scope (team добавлен — раньше
// team-контрпики жили прямо в heroes.counters).
//
// Сохраняет ВНЕШНИЙ контракт для render-файлов: heroes[]/maps[] по-прежнему
// содержат .name (не .heroId) как основной идентификатор для UI,
// tierOrderMaps/tierOrderHeroes/heroMapStrength/heroSynergy по-прежнему
// keyed by name — MIGR-3 (render-tiers.js/render-tier-share.js) и остальной
// рендер-код не должны меняться из-за этого файла. id-based связи — деталь
// реализации внутри db-load.js/db-write.js.
//
// Зависимости: auth.js (_sb, dbSelect), session.js (currentTeam, currentUser)

// ════ LOAD ALL ════
async function loadAllData(){
  if(!currentTeam()) return;
  showLoading('mapGrid','card',8); showLoading('heroPool','hero',12); showLoading('playerGrid','player',5);
  try{
    await _loadCatalogs(); // hero_catalog/map_catalog — нужны ДО heroes/maps/tiers (id→name резолв)
    await Promise.all([
      loadPortraits(), loadMapScreenshots(),
      loadHeroes(), loadMaps(), loadPlayers(),
      loadTiers(), loadHeroMapStrength(), loadHeroSynergy(),
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
// (hero_id/synergy_hero_id/counter_hero_id и т.д.). ════
let _heroCatalogById   = {};  // id -> {id,name,role,subrole}
let _heroCatalogByName = {};  // name -> {id,name,role,subrole} — нужен db-write.js
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
  _applyCounterMode(tierViewMode);
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

// ════ TIER_LISTS — единый контейнер на 3 scope (MIGR-1). tier_lists
// стартует ПУСТОЙ таблицей — seed (009) наполнил только каталоги, не
// сами списки. Здесь — find-or-create на клиенте, чтобы не блокироваться
// на MIGR-4 (RPC/admin слой должен со временем взять на себя атомарное
// создание team-tier_list прямо в момент создания команды — см. заметку
// в AGENT_TASKS, MIGR-2 не блокирует остальных, но это дыра которую надо
// закрыть отдельно). ════

let _tierListIdCache = {}; // `${scope}:${teamId}:${userId}` -> id, чтобы не дёргать find-or-create на каждый loadTiers()

async function _resolveTierListId(scope, { teamId=null, userId=null, name=null } = {}){
  const cacheKey = `${scope}:${teamId||''}:${userId||''}`;
  if(_tierListIdCache[cacheKey]) return _tierListIdCache[cacheKey];

  let query = _sb.from('tier_lists').select('id').eq('scope', scope);
  if(scope === 'team')     query = query.eq('team_id', teamId);
  if(scope === 'personal') query = query.eq('team_id', teamId).eq('user_id', userId).eq('is_default', true);
  const { data: existing, error: selErr } = await query.maybeSingle();
  if(selErr) console.warn('_resolveTierListId select error', selErr);

  if(existing?.id){ _tierListIdCache[cacheKey] = existing.id; return existing.id; }

  const insertRow = { scope, team_id: teamId, user_id: userId,
                       name: name || 'Тир-лист', is_default: scope === 'personal' };
  const { data: created, error: insErr } = await _sb.from('tier_lists')
    .insert(insertRow).select('id').single();
  if(insErr){
    // 23505 = unique_violation (idx_tier_lists_one_global/_one_team) —
    // кто-то создал параллельно (два таба, гонка на первом заходе) — перечитываем
    if(insErr.code === '23505'){
      const { data: retry } = await query.maybeSingle();
      if(retry?.id){ _tierListIdCache[cacheKey] = retry.id; return retry.id; }
    }
    console.warn('_resolveTierListId insert error', insErr);
    return null;
  }
  _tierListIdCache[cacheKey] = created.id;
  return created.id;
}

let globalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
let globalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};
let teamTierMaps     = {S:[],A:[],B:[],C:[],D:[]};
let teamTierHeroes   = {S:[],A:[],B:[],C:[],D:[]};
let personalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
let personalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};

// tier_list.id текущих контейнеров — нужен db-write.js/saveTierOrder(),
// чтобы не пересчитывать _resolveTierListId на каждый drag-drop.
let _globalTierListId = null;
let _teamTierListId   = null;
// personal — это и есть activeTierSetId ниже, отдельной переменной не нужно.

let tierViewMode = 'team'; // 'global' | 'team' | 'personal'

async function loadTiers(){
  await Promise.all([
    loadGlobalTiers(), loadTeamTiers(), loadPersonalTiers(),
    loadPersonalDefaultMapTiers(), // MIGR-5: для вкладки "Карты" в личном режиме
  ]);
  _applyTierMode(tierViewMode);
}

async function _loadTierEntries(tierListId){
  const mapsObj = {S:[],A:[],B:[],C:[],D:[]}, heroesObj = {S:[],A:[],B:[],C:[],D:[]};
  if(!tierListId) return { mapsObj, heroesObj };
  const { data, error } = await _sb.from('tier_entries')
    .select('entity_type, hero_id, map_id, tier')
    .eq('tier_list_id', tierListId).order('position');
  if(error){ console.warn('_loadTierEntries error', error); return { mapsObj, heroesObj }; }
  (data||[]).forEach(r => {
    if(r.entity_type === 'map'){
      const name = _mapCatalogById[r.map_id]?.name;
      if(name && mapsObj[r.tier]) mapsObj[r.tier].push(name);
    }else{
      const name = _heroCatalogById[r.hero_id]?.name;
      if(name && heroesObj[r.tier]) heroesObj[r.tier].push(name);
    }
  });
  return { mapsObj, heroesObj };
}

async function loadGlobalTiers(){
  _globalTierListId = await _resolveTierListId('global', {});
  const { mapsObj, heroesObj } = await _loadTierEntries(_globalTierListId);
  globalTierMaps = mapsObj; globalTierHeroes = heroesObj;
}

async function loadTeamTiers(){
  _teamTierListId = await _resolveTierListId('team', { teamId: _teamId() });
  const { mapsObj, heroesObj } = await _loadTierEntries(_teamTierListId);
  teamTierMaps = mapsObj; teamTierHeroes = heroesObj;
}

async function loadPersonalTiers(){
  if(!currentUser()) return;
  await loadTierSets(); // наполняет tierSets[] и activeTierSetId
  const { mapsObj, heroesObj } = await _loadTierEntries(activeTierSetId);
  personalTierMaps = mapsObj; personalTierHeroes = heroesObj;
}

// MIGR-5: Карты↔Тир-листы в личном режиме связаны конкретно с ДЕФОЛТНЫМ
// личным сетом (is_default=true), а не с тем что сейчас открыт на странице
// Tier List (activeTierSetId может указывать на другой именованный сет,
// если пользователь переключился) — по требованию: "связь должна быть
// с тирлистом который выбран по умолчанию", независимо от навигации.
// Формат — плоский объект name→tier (не S/A/B/C/D массивы) для O(1) лукапа
// во вкладке "Карты" (render-maps.js).
let personalDefaultMapTierByName = {};

async function loadPersonalDefaultMapTiers(){
  personalDefaultMapTierByName = {};
  if(!currentUser()) return;
  const defaultListId = await _resolveTierListId('personal', { teamId: _teamId(), userId: currentUser().id });
  if(!defaultListId) return;
  const { data, error } = await _sb.from('tier_entries')
    .select('map_id, tier').eq('tier_list_id', defaultListId).eq('entity_type', 'map');
  if(error){ console.warn('loadPersonalDefaultMapTiers error', error); return; }
  (data||[]).forEach(r => {
    const name = _mapCatalogById[r.map_id]?.name;
    if(name) personalDefaultMapTierByName[name] = r.tier;
  });
}

// ════ PERSONAL TIER LISTS (были personal_tier_sets, теперь строки
// tier_lists со scope='personal') ════
let tierSets        = [];   // [{id, name, is_default}]
let activeTierSetId = null; // uuid | null — он же tier_lists.id

async function loadTierSets(){
  if(!currentUser()) return;
  const { data, error } = await _sb.from('tier_lists')
    .select('id, name, is_default')
    .eq('scope', 'personal').eq('team_id', _teamId()).eq('user_id', currentUser().id)
    .order('created_at');
  if(error){ console.warn('loadTierSets error', error); return; }
  tierSets = data || [];

  if(tierSets.length === 0){
    // Первый заход пользователя в личный режим для этой команды — создаём дефолтный сет
    const id = await _resolveTierListId('personal', { teamId: _teamId(), userId: currentUser().id });
    if(id) tierSets = [{ id, name: 'Тир-лист', is_default: true }];
  }
  if(!activeTierSetId || !tierSets.find(s => s.id === activeTierSetId)){
    const def = tierSets.find(s => s.is_default) ?? tierSets[0];
    activeTierSetId = def?.id ?? null;
  }
}

async function switchTierSet(setId){
  activeTierSetId = setId;
  await loadPersonalTiers();
  _applyTierMode('personal');
  renderTiers();
}

function _applyTierMode(mode){
  tierViewMode = mode;
  if(mode === 'global'){ tierOrderMaps = globalTierMaps;   tierOrderHeroes = globalTierHeroes; }
  else if(mode === 'team'){ tierOrderMaps = teamTierMaps;   tierOrderHeroes = teamTierHeroes; }
  else { tierOrderMaps = personalTierMaps; tierOrderHeroes = personalTierHeroes; }
}

function switchTierMode(mode){
  _applyTierMode(mode);
  _applyCounterMode(mode);
  renderTiers();
  renderHeroes();              // контрпики поменялись — перерисовываем Героев
  renderAppModeSwitcher();     // держим переключатель в хедере в синхроне
}

async function loadSharedTier(token){
  const { data, error } = await _sb.rpc('view_shared_tier', { p_token: token });
  if(error) return { error: 'rpc_failed' };
  return data;
}
