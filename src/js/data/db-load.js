// ════ DATA — LOAD (Supabase) ════
// Замена sheets-load.js. Сохраняет те же глобальные переменные
// (heroes, maps, players, heroMap, heroMapStrength, heroSynergy) —
// render-файлы не меняются.
//
// Тир-листы — три уровня: global / team / personal (см. секцию TIERS ниже).
//
// Зависимости: auth.js (_sb, dbSelect), session.js (currentTeam, currentUser)

// ════ LOAD ALL ════
async function loadAllData(){
  if(!currentTeam()) return;
  showLoading('mapGrid','card',8); showLoading('heroPool','hero',12); showLoading('playerGrid','player',5);
  try{
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

// ════ HEROES ════
async function loadHeroes(){
  const { data, error } = await _sb.from('heroes')
    .select('*').eq('team_id', _teamId()).order('name');
  if(error){ heroes=[]; throw error; }

  heroes = (data||[]).map(r => ({
    id: r.id,
    name: r.name, role: r.role, subrole: r.subrole || '',
    priority: r.priority ?? 5,
    banned: !!r.banned,
    notes: r.notes || '',
    counters: r.counters || [],
    strongMaps: [], weakMaps: [],
  }));
  heroMap = {}; heroes.forEach(h => heroMap[h.name] = h);

  // Снимок командных контрпиков «как есть» из heroes.counters —
  // используется при возврате в режим 'team' (см. _applyCounterMode ниже),
  // потому что hero.counters мутируется при переключении режима.
  teamHeroCounters = {};
  heroes.forEach(h => { teamHeroCounters[h.name] = h.counters; });
}

// ════ HERO COUNTERS — global / team / personal (006_hero_counters.sql) ════
// team-уровень — это просто heroes.counters как раньше (см. снимок
// teamHeroCounters в loadHeroes() выше). global/personal — отдельная
// таблица hero_counters. Режим общий с тир-листом (tierViewMode) —
// один переключатель в хедере управляет и тем, и тем.
let globalHeroCounters   = {}; // {heroName: [{name,score}]}
let teamHeroCounters     = {}; // снимок heroes.counters на момент загрузки
let personalHeroCounters = {}; // {heroName: [{name,score}]}

async function loadHeroCounters(){
  await Promise.all([loadGlobalHeroCounters(), loadPersonalHeroCounters()]);
  _applyCounterMode(tierViewMode);
}

async function loadGlobalHeroCounters(){
  const { data, error } = await _sb.from('hero_counters')
    .select('hero_name, counter_hero, score').eq('scope', 'global');
  if(error){ console.warn('loadGlobalHeroCounters error', error); return; }
  globalHeroCounters = _groupHeroCounters(data);
}

async function loadPersonalHeroCounters(){
  if(!currentUser()) return;
  const { data, error } = await _sb.from('hero_counters')
    .select('hero_name, counter_hero, score')
    .eq('scope', 'personal').eq('team_id', _teamId()).eq('user_id', currentUser().id);
  if(error){ console.warn('loadPersonalHeroCounters error', error); return; }
  personalHeroCounters = _groupHeroCounters(data);
}

function _groupHeroCounters(rows){
  const out = {};
  (rows || []).forEach(r => {
    if(!out[r.hero_name]) out[r.hero_name] = [];
    out[r.hero_name].push({ name: r.counter_hero, score: r.score });
  });
  return out;
}

// Подменяет .counters у каждого героя в массиве heroes — все существующие
// читатели (render-heroes.js, scoring-bans.js, scoring-comp.js, draft-вью,
// modal-hero.js) просто читают hero.counters и не знают о режимах вообще.
function _applyCounterMode(mode){
  const source = mode === 'global'   ? globalHeroCounters
                : mode === 'personal' ? personalHeroCounters
                : teamHeroCounters;
  heroes.forEach(h => { h.counters = source[h.name] || []; });
}


async function loadMaps(){
  const { data, error } = await _sb.from('maps')
    .select('*').eq('team_id', _teamId()).order('name');
  if(error){ maps=[]; throw error; }

  maps = (data||[]).map(r => ({
    id: r.id,
    name: r.name, type: r.type, tier: r.tier || 'B',
    priority: r.priority ?? 5,
    atk: r.atk ?? 3, def: r.def ?? 3, dif: r.dif ?? 3,
    notes: r.notes || '',
    inPool: r.in_pool !== false,
    preferredHeroes: r.preferred_heroes || [],
    bans: r.ban_heroes || [],
    comp: r.comp || [],
    counters: r.counters || [],
  }));
}

// ════ PLAYERS ════
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
let heroMapStrength = {};  // { heroName: { mapName: {atk,def,avg} } }

async function loadHeroMapStrength(){
  heroMapStrength = {};
  const { data, error } = await _sb.from('hero_map_strength')
    .select('hero_name, map_name, atk, def').eq('team_id', _teamId());
  if(error){ console.warn('loadHeroMapStrength error', error); return; }

  (data||[]).forEach(r => {
    const atk = r.atk || 0;
    const def = r.def || atk;
    const avg = def ? Math.round((atk+def)/2) : atk;
    if(!heroMapStrength[r.hero_name]) heroMapStrength[r.hero_name] = {};
    heroMapStrength[r.hero_name][r.map_name] = { atk, def, avg };
  });

  heroes.forEach(h => {
    const entries = Object.entries(heroMapStrength[h.name] || {});
    h.strongMaps = entries.filter(([,v]) => v.avg>=7).map(([m])=>m);
    h.weakMaps   = entries.filter(([,v]) => v.avg<=4).map(([m])=>m);
  });
}

// ════ HERO SYNERGY ════
let heroSynergy = {};  // { heroName: [{name, score}] }

async function loadHeroSynergy(){
  heroSynergy = {};
  const { data, error } = await _sb.from('hero_synergy')
    .select('hero_name, synergy_hero, score').eq('team_id', _teamId());
  if(error){ console.warn('loadHeroSynergy error', error); return; }

  (data||[]).forEach(r => {
    if(!heroSynergy[r.hero_name]) heroSynergy[r.hero_name] = [];
    heroSynergy[r.hero_name].push({ name: r.synergy_hero, score: r.score });
  });
}

// ════ TIERS — три уровня: global / team / personal ════
//let tierOrderMaps   = {S:[],A:[],B:[],C:[],D:[]};
//let tierOrderHeroes = {S:[],A:[],B:[],C:[],D:[]};

// let в <script> не идёт на window, поэтому window.tierOrderMaps (proxy) и let tierOrderMaps — разные вещи.
// Присвоение tierOrderMaps = snap попадает в let, store не видит. Мой фикс (store.get() → tierOrderMaps) — лечит симптом, не причину.
// Правильный фикс: удалить строки

let globalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
let globalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};
let teamTierMaps     = {S:[],A:[],B:[],C:[],D:[]};
let teamTierHeroes   = {S:[],A:[],B:[],C:[],D:[]};
let personalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
let personalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};

let tierViewMode = 'team'; // 'global' | 'team' | 'personal'

async function loadTiers(){
  await Promise.all([loadGlobalTiers(), loadTeamTiers(), loadPersonalTiers()]);
  _applyTierMode(tierViewMode);
}

async function loadGlobalTiers(){
  const { data, error } = await _sb.from('global_tier_data')
  .select('entity_type, name, tier').order('position');
  if(error){ console.warn('loadGlobalTiers error', error); return; }
  globalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
  globalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};
  _fillTierOrder(data, globalTierMaps, globalTierHeroes);
}

async function loadTeamTiers(){
  const { data, error } = await _sb.from('tier_data')
    .select('entity_type, name, tier')
    .eq('team_id', _teamId()).eq('scope', 'team').order('position');
  if(error){ console.warn('loadTeamTiers error', error); return; }
  teamTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
  teamTierHeroes = {S:[],A:[],B:[],C:[],D:[]};
  _fillTierOrder(data, teamTierMaps, teamTierHeroes);
}

async function loadPersonalTiers(){
  if(!currentUser()) return;

  // Загружаем список сетов и активный
  await loadTierSets();

  // Загружаем данные активного сета (или всех личных если сета нет)
  let query = _sb.from('tier_data')
    .select('entity_type, name, tier')
    .eq('team_id', _teamId()).eq('scope', 'personal').eq('user_id', currentUser().id);
  if(activeTierSetId) query = query.eq('tier_set_id', activeTierSetId);
  const { data, error } = await query.order('position');
  if(error){ console.warn('loadPersonalTiers error', error); return; }
  personalTierMaps   = {S:[],A:[],B:[],C:[],D:[]};
  personalTierHeroes = {S:[],A:[],B:[],C:[],D:[]};
  _fillTierOrder(data, personalTierMaps, personalTierHeroes);
}

// ════ PERSONAL TIER SETS ════
let tierSets      = [];       // [{id, name, is_default}]
let activeTierSetId = null;   // uuid | null

async function loadTierSets(){
  if(!currentUser()) return;
  const { data, error } = await _sb.from('personal_tier_sets')
    .select('id, name, is_default')
    .eq('team_id', _teamId())
    .eq('user_id', currentUser().id)
    .order('created_at');
  if(error){ console.warn('loadTierSets error', error); return; }
  tierSets = data || [];
  // Активный сет — дефолтный или первый
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

function _fillTierOrder(rows, mapsObj, heroesObj){
  (rows || []).forEach(r => {
    const target = r.entity_type === 'map' ? mapsObj : heroesObj;
    if(target[r.tier]) target[r.tier].push(r.name);
  });
}

async function loadSharedTier(token){
  const { data, error } = await _sb.rpc('view_shared_tier', { p_token: token });
  if(error) return { error: 'rpc_failed' };
  return data;
}
