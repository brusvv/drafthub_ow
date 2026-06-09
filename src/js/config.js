// ════ CONFIG ════
const SCOPES='https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY='https://sheets.googleapis.com/$discovery/rest?version=v4';
let tokenClient=null,gapiInited=false,gisInited=false;

let heroes=[],maps=[],players=[],heroMap={},heroPortraits={},mapScreenshots={};
let mapFilter='all',heroFilter='all';

const rc={Tank:'var(--tank)',Damage:'var(--damage)',Support:'var(--support)'};
const ts={S:{bg:'rgba(240,160,48,.15)',c:'var(--tier-s)'},A:{bg:'rgba(139,195,74,.15)',c:'var(--tier-a)'},B:{bg:'rgba(91,155,213,.15)',c:'var(--tier-b)'},C:{bg:'rgba(136,136,136,.1)',c:'var(--tier-c)'},D:{bg:'rgba(160,64,48,.15)',c:'var(--tier-d)'}};

const NO_ATKDEF=['Control','Flashpoint'];

// ════ PICKER STATE ════
let pickerMode='preferred';
let pickerSelected={
  preferred:[],bans:[],comp:[],
  playerMain:[],playerPool:[],
  playerRole_Tank:[],playerRole_Damage:[],playerRole_Support:[],playerRole_Flex:[]
};
let pickerRoleFilter='all';
let pickerMax=999;

let mapPickerMode='heroStrong';
let mapPickerSelected={heroStrong:[],heroWeak:[]};
let mapPickerTypeFilter='all';

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
    .replace(/['']/g,'')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_|_$/g,'');
}

// ════ PORTRAITS ════
async function loadPortraits(){
  try{
    const r=await fetch('https://overfast-api.tekrop.fr/heroes');
    const data=await r.json();
    data.forEach(h=>{
      heroPortraits[h.name.toLowerCase()]=h.portrait;
      heroPortraits[h.key]=h.portrait;
    });
  }catch(e){console.warn('Portrait API error',e)}
}

async function loadMapScreenshots(){
  try{
    const r=await fetch('https://overfast-api.tekrop.fr/maps');
    const data=await r.json();
    data.forEach(m=>{
      mapScreenshots[m.name.toLowerCase()]=m.screenshot;
      mapScreenshots[mapKey(m.name)]=m.screenshot;
    });
  }catch(e){console.warn('Maps API error',e)}
}

function portrait(name){
  if(!name)return null;
  const k=name.toLowerCase();
  return heroPortraits[k]||heroPortraits[mapKey(name)]||null;
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

const ICON_ATK=`<svg class="ow-icon" style="color:#E05555;flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 2L2 6.5l11 11L6.5 20H9l3.5-3.5L21 21l-4-14.5L6.5 2zm8.6 13.1L8.9 9 18 12l-2.9 3.1z"/></svg>`;
const ICON_DEF=`<svg class="ow-icon" style="color:#4A9EE0;flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l6 2.67V11c0 3.86-2.57 7.45-6 8.83C8.57 18.45 6 14.86 6 11V7.67L12 5z"/></svg>`;
const ICON_DIF=`<svg class="ow-icon" style="color:var(--accent);flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
