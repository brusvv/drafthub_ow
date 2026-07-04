// @hash 6ba82d9f 2026-07-03T20:00
// @hash PLACEHOLDER
// ════ DATA — LOAD TIERS (Supabase) ════
// Вынесено из db-load.js (FILESPLIT-1, 03.07 — файл разросся до 418 строк,
// тир-часть больше половины и логически самодостаточна: свой набор
// глобальных переменных, свой резолвер tier_lists, свой режим-свитчер).
//
// unified tier_lists/tier_entries (MIGR-1) вместо tier_data+global_tier_data+
// personal_tier_sets. Три scope (global/team/personal) + управление личными
// именованными сетами (были personal_tier_sets, теперь строки tier_lists).
//
// Зависимости: db-load.js (_teamId, _heroCatalogById, _mapCatalogById,
//              _applyCounterMode, heroes), auth.js (_sb),
//              session.js (currentTeam, currentUser),
//              render-tiers/render-tiers.js (renderTiers — вызывается из switchTierMode),
//              render-heroes.js (renderHeroes), render-nav.js (renderAppModeSwitcher)

// ════ TIER_LISTS — единый контейнер на 3 scope (MIGR-1). tier_lists
// стартует ПУСТОЙ таблицей — seed (009) наполнил только каталоги, не
// сами списки. Здесь — find-or-create на клиенте, чтобы не блокироваться
// на MIGR-4 (RPC/admin слой со временем взял на себя атомарное создание
// team-tier_list прямо в момент создания команды — см. create_team в
// 011_rpc.sql — но find-or-create здесь остаётся как fallback для команд
// созданных до MIGR-4 и для personal/global scope которые create_team
// не создаёт). ════

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

// tier_list.id текущих контейнеров — нужен db-write*.js/saveTierOrder(),
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
  _applyCounterMode(mode); // db-load.js
  renderTiers();
  renderHeroes();              // контрпики поменялись — перерисовываем Героев
  renderAppModeSwitcher();     // держим переключатель в хедере в синхроне
}

async function loadSharedTier(token){
  const { data, error } = await _sb.rpc('view_shared_tier', { p_token: token });
  if(error) return { error: 'rpc_failed' };
  return data;
}
