// @hash 8e9f7835 2026-07-03T06:55
// ════ CONFIG ════

// ── Базовый путь публикации (GitHub Pages, репозиторий в подпапке) ──
// Единственный источник — переменная BASE_PATH в build.sh, подставляется
// сюда через sed (__BASE_PATH__). Не хардкодить '/drafthub_ow' больше
// нигде в JS — всегда через BASE_PATH или basePathRegex() отсюда.
const BASE_PATH = '__BASE_PATH__';

// Собирает RegExp вида ^BASE_PATH<suffix>$ с корректно экранированным
// BASE_PATH (на случай если в пути когда-нибудь появятся спецсимволы regex).
// Пример: basePathRegex('/tier/([A-Za-z0-9_=-]{10,})') →
//   /^\/drafthub_ow\/tier\/([A-Za-z0-9_=-]{10,})$/
function basePathRegex(suffixPattern){
  const escapedBase = BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escapedBase + suffixPattern + '$');
}

// ── Прокси для обратной совместимости ──────────────────────
// Пока файлы не мигрированы на store.get()/set(),
// эти геттеры/сеттеры перенаправляют обращения в store.

// Auth (не в store — нужны до инициализации)
let tokenClient=null,gapiInited=false,gisInited=false,gisLibReady=false;

// Данные из Sheets
Object.defineProperties(window, {
  heroes:        { get(){ return store.get('heroes'); },        set(v){ store.set('heroes',v); },        configurable:true },
  maps:          { get(){ return store.get('maps'); },          set(v){ store.set('maps',v); },          configurable:true },
  players:       { get(){ return store.get('players'); },       set(v){ store.set('players',v); },       configurable:true },
  heroMap:       { get(){ return store.get('heroMap'); },       set(v){ store.set('heroMap',v); },       configurable:true },
  heroPortraits: { get(){ return store.get('heroPortraits'); }, set(v){ store.set('heroPortraits',v); }, configurable:true },
  mapScreenshots:{ get(){ return store.get('mapScreenshots'); },set(v){ store.set('mapScreenshots',v); },configurable:true },

  // Фильтры
  mapFilter:     { get(){ return store.get('mapFilter'); },     set(v){ store.set('mapFilter',v); },     configurable:true },
  heroFilter:    { get(){ return store.get('heroFilter'); },    set(v){ store.set('heroFilter',v); },    configurable:true },

  // Picker
  pickerMode:         { get(){ return store.get('pickerMode'); },         set(v){ store.set('pickerMode',v); },         configurable:true },
  pickerSelected:     { get(){ return store.get('pickerSelected'); },     set(v){ store.set('pickerSelected',v); },     configurable:true },
  pickerRoleFilter:   { get(){ return store.get('pickerRoleFilter'); },   set(v){ store.set('pickerRoleFilter',v); },   configurable:true },
  pickerMax:          { get(){ return store.get('pickerMax'); },          set(v){ store.set('pickerMax',v); },          configurable:true },
  mapPickerMode:      { get(){ return store.get('mapPickerMode'); },      set(v){ store.set('mapPickerMode',v); },      configurable:true },
  mapPickerSelected:  { get(){ return store.get('mapPickerSelected'); },  set(v){ store.set('mapPickerSelected',v); },  configurable:true },
  mapPickerTypeFilter:{ get(){ return store.get('mapPickerTypeFilter'); },set(v){ store.set('mapPickerTypeFilter',v); },configurable:true },
  counterPickerRoleFilter:{ get(){ return store.get('counterPickerRoleFilter'); }, set(v){ store.set('counterPickerRoleFilter',v); }, configurable:true },
  counterPickerSelected:  { get(){ return store.get('counterPickerSelected'); },   set(v){ store.set('counterPickerSelected',v); },   configurable:true },
});
// ────────────────────────────────────────────────────────────

const SCOPES='https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY='https://sheets.googleapis.com/$discovery/rest?version=v4';
// [store] let tokenClient → store.state

// [store] let heroes → store.state
// [store] let mapFilter → store.state

const rc={Tank:'var(--tank)',Damage:'var(--damage)',Support:'var(--support)'};
const ts={S:{bg:'rgba(240,160,48,.15)',c:'var(--tier-s)'},A:{bg:'rgba(139,195,74,.15)',c:'var(--tier-a)'},B:{bg:'rgba(91,155,213,.15)',c:'var(--tier-b)'},C:{bg:'rgba(136,136,136,.1)',c:'var(--tier-c)'},D:{bg:'rgba(160,64,48,.15)',c:'var(--tier-d)'}};

const NO_ATKDEF=['Control','Flashpoint','Push'];

// ════ PICKER STATE ════
// [store] let pickerMode → store.state
// [store] pickerSelected → store.state (extended keys below in INITIAL_STATE)
// [store] let pickerRoleFilter → store.state
// [store] let pickerMax → store.state

// [store] let mapPickerMode → store.state
// [store] let mapPickerSelected → store.state
// [store] let mapPickerTypeFilter → store.state

// ════ WIKI ICONS (hardcoded URLs — no API needed) ════
const BASE='https://static.wikia.nocookie.net/overwatch_gamepedia/images';

const WIKI_ROLE={
  Tank:       `${BASE}/c/c8/Role_Tank_Circle.svg/revision/latest`,
  Damage:     `${BASE}/8/80/Role_Damage_Circle.svg/revision/latest`,
  Support:    `${BASE}/9/93/Role_Support_Circle.svg/revision/latest`,
  Flex:       `${BASE}/d/da/Flex_Icon.svg/revision/latest`,
};

const WIKI_SUBROLE={
  Tank:{
    Initiator: `${BASE}/4/47/Sub-Role_Tank_Initiator_Circle.svg/revision/latest`,
    Bruiser:   `${BASE}/a/a3/Sub-Role_Tank_Bruiser_Circle.svg/revision/latest`,
    Stalwart:  `${BASE}/f/f5/Sub-Role_Tank_Stalwart_Circle.svg/revision/latest`,
  },
  Damage:{
    Flanker:      `${BASE}/d/d2/Sub-Role_Damage_Flanker_Circle.svg/revision/latest`,
    Sharpshooter: `${BASE}/5/58/Sub-Role_Damage_Sharpshooter_Circle.svg/revision/latest`,
    Specialist:   `${BASE}/9/9b/Sub-Role_Damage_Specialist_Circle.svg/revision/latest`,
    Recon:        `${BASE}/b/bc/Sub-Role_Damage_Recon_Circle.svg/revision/latest`,
  },
  Support:{
    Medic:      `${BASE}/6/61/Sub-Role_Support_Medic_Circle.svg/revision/latest`,
    Tactician:  `${BASE}/3/31/Sub-Role_Support_Tactician_Circle.svg/revision/latest`,
    Survivor:   `${BASE}/2/22/Sub-Role_Support_Survivor_Circle.svg/revision/latest`,
  },
};

// Map type icons
const WIKI_MAPTYPE={
  Control:    `${BASE}/e/e5/Control.png/revision/latest`,
  Escort:     `${BASE}/d/d3/Escort.png/revision/latest`,
  Hybrid:     `${BASE}/e/ed/Hybrid.png/revision/latest`,
  Push:       `${BASE}/6/6a/Push.png/revision/latest`,
  Flashpoint: `${BASE}/f/f2/Flashpoint.png/revision/latest`,
  Clash:      `${BASE}/d/d1/Clash.svg/revision/latest`,
};

function _roleColor(role){
  return role==='Tank'?'var(--tank)':role==='Damage'?'var(--damage)':role==='Support'?'var(--support)':'var(--accent)';
}

// <img> иконка роли
function roleIcon(role,size=20){
  const url=WIKI_ROLE[role];
  if(!url)return'';
  return`<img src="${url}" width="${size}" height="${size}" style="object-fit:contain;flex-shrink:0" alt="${role}">`;
}

// <img> иконка подкласса
function subroleIcon(role,subrole,size=16){
  if(!subrole||!role)return'';
  const url=WIKI_SUBROLE[role]?.[subrole];
  if(!url)return'';
  return`<img src="${url}" width="${size}" height="${size}" style="object-fit:contain;flex-shrink:0" alt="${subrole}">`;
}

// <img> иконка типа карты
function mapTypeIcon(type,size=14){
  const url=WIKI_MAPTYPE[type];
  if(!url)return'';
  return`<img src="${url}" width="${size}" height="${size}" style="object-fit:contain;flex-shrink:0;opacity:.85" alt="${type}">`;
}

// ════ MAP KEY ════
function mapKey(name){
  return name.toLowerCase()
    .replace(/['’]/g,'')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_|_$/g,'')
    .replace(/_+/g,'_');
}
// heroKey: strips ALL punctuation for lookup (e.g. "Soldier: 76" → "soldier76")
function heroKey(name){
  return name.toLowerCase().replace(/[^a-z0-9]/g,'');
}

// ════ PORTRAITS ════
// ── Retry helper ──────────────────────────────────────────────
// Пробует fetch N раз с нарастающей задержкой.
// При полной недоступности — возвращает null и показывает предупреждение.
async function _fetchWithRetry(url, retries = 2, delayMs = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === retries) return null;
      await new Promise(res => setTimeout(res, delayMs * (i + 1)));
    }
  }
  return null;
}

async function loadPortraits() {
  const LS_KEY = 'draft_cache_portraits';
  // Пробуем API
  const data = await _fetchWithRetry('https://overfast-api.tekrop.fr/heroes');
  if (data) {
    data.forEach(h => {
      heroPortraits[h.name.toLowerCase()] = h.portrait;
      heroPortraits[h.key]                = h.portrait;
      heroPortraits[heroKey(h.name)]      = h.portrait;
    });
    // Кэшируем в localStorage для офлайн-режима
    try { localStorage.setItem(LS_KEY, JSON.stringify(heroPortraits)); } catch (_) {}
  } else {
    // Fallback: берём из кэша прошлой успешной загрузки
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) Object.assign(heroPortraits, JSON.parse(cached));
    } catch (_) {}
    if (!Object.keys(heroPortraits).length) {
      console.warn('[DraftHub] Portrait API недоступен, портреты не загружены');
    }
  }
}

async function loadMapScreenshots() {
  const LS_KEY = 'draft_cache_mapshots';
  const data = await _fetchWithRetry('https://overfast-api.tekrop.fr/maps');
  if (data) {
    data.forEach(m => {
      mapScreenshots[m.name.toLowerCase()] = m.screenshot;
      mapScreenshots[mapKey(m.name)]       = m.screenshot;
    });
    try { localStorage.setItem(LS_KEY, JSON.stringify(mapScreenshots)); } catch (_) {}
  } else {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) Object.assign(mapScreenshots, JSON.parse(cached));
    } catch (_) {}
    if (!Object.keys(mapScreenshots).length) {
      console.warn('[DraftHub] Map screenshot API недоступен');
    }
  }
}

function portrait(name){
  if(!name)return null;
  const k=name.toLowerCase();
  return heroPortraits[k]||heroPortraits[mapKey(name)]||heroPortraits[heroKey(name)]||null;
}
function mapImg(name){
  if(!name)return null;
  const k=name.toLowerCase();
  const u=mapScreenshots[k]||mapScreenshots[mapKey(name)]||null;
  if(u)return u;
  const slug=name.toLowerCase().replace(/['']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return`https://overfast-api.tekrop.fr/static/maps/${slug}.jpg`;
}

function imgH(src,cls,fallbackLetter,extra=''){
  if(src)return`<img src="${src}" class="${cls}" alt="" onerror="this.outerHTML='<div class=\\'${cls}-ph\\'>${fallbackLetter}</div>'" ${extra}>`;
  return`<div class="${cls}-ph">${fallbackLetter}</div>`;
}

const ICON_ATK=`<svg class="ow-icon" style="color:#E05555;flex-shrink:0" width="13" height="13" viewBox="0 0 100 100" fill="currentColor">
  <!-- Sword 1: bottom-left handle → top-right blade -->
  <g transform="rotate(-45 50 50)">
    <rect x="46" y="4" width="8" height="54" rx="2"/>
    <polygon points="50,2 43,14 57,14"/>
    <rect x="32" y="55" width="36" height="7" rx="3"/>
    <rect x="45" y="62" width="10" height="18" rx="3"/>
    <circle cx="50" cy="86" r="7"/>
  </g>
  <!-- Sword 2: bottom-right handle → top-left blade -->
  <g transform="rotate(45 50 50)">
    <rect x="46" y="4" width="8" height="54" rx="2"/>
    <polygon points="50,2 43,14 57,14"/>
    <rect x="32" y="55" width="36" height="7" rx="3"/>
    <rect x="45" y="62" width="10" height="18" rx="3"/>
    <circle cx="50" cy="86" r="7"/>
  </g>
</svg>`;
const ICON_DEF=`<svg class="ow-icon" style="color:#4A9EE0;flex-shrink:0" width="13" height="13" viewBox="0 0 100 112" fill="currentColor">
  <path d="M50 3 L7 22 L7 54 C7 79 26 101 50 109 C74 101 93 79 93 54 L93 22 Z"/>
  <path fill="white" d="
    M33 87 L67 87 L67 78 L62 78 L62 47 L68 47 L68 36 L60 36 L60 41 L55 41 L55 36 L45 36 L45 41 L40 41 L40 36 L32 36 L32 47 L38 47 L38 78 L33 78 Z
    M36 90 L64 90 L64 87 L36 87 Z
  "/>
</svg>`;
const ICON_DIF=`<svg class="ow-icon" style="color:var(--accent);flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
