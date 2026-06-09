// ════ CONFIG ════
const SCOPES='https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY='https://sheets.googleapis.com/$discovery/rest?version=v4';
let tokenClient=null,gapiInited=false,gisInited=false;

let heroes=[],maps=[],players=[],heroMap={},heroPortraits={},mapScreenshots={};
let mapFilter='all',heroFilter='all';

const rc={Tank:'var(--tank)',Damage:'var(--damage)',Support:'var(--support)'};
const ts={S:{bg:'rgba(240,160,48,.15)',c:'var(--tier-s)'},A:{bg:'rgba(139,195,74,.15)',c:'var(--tier-a)'},B:{bg:'rgba(91,155,213,.15)',c:'var(--tier-b)'},C:{bg:'rgba(136,136,136,.1)',c:'var(--tier-c)'},D:{bg:'rgba(160,64,48,.15)',c:'var(--tier-d)'}};

// Control/Flashpoint — нет ATK/DEF
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

// Map picker state (для strong/weak карт героя)
let mapPickerMode='heroStrong';
let mapPickerSelected={heroStrong:[],heroWeak:[]};
let mapPickerTypeFilter='all';

// ════ ROLE ICONS ════
const ROLE_ICONS={
  Tank:`<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 5v6c0 5.25 3.5 10.15 8 11.5C16.5 21.15 20 16.25 20 11V5l-8-3zm0 2.18l6 2.25V11c0 4.1-2.7 7.9-6 9.1-3.3-1.2-6-5-6-9.1V6.43l6-2.25z"/>
    <rect x="10" y="9" width="4" height="7" rx="1"/>
    <rect x="8" y="11" width="8" height="3" rx="1"/>
  </svg>`,
  Damage:`<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l2.5 7.5H22l-6.5 4.7 2.5 7.5L12 17.2l-6 4.5 2.5-7.5L2 9.5h7.5L12 2z"/>
  </svg>`,
  Support:`<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/>
  </svg>`,
  Flex:`<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    <path d="M8 6l-4 6 4 6M16 6l4 6-4 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`
};

// ════ MAP KEY (для screenshot URL) ════
function mapKey(name){
  return name.toLowerCase()
    .replace(/['']/g,'')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_|_$/g,'');
}

// ════ PORTRAIT ════
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

// OW-style SVG icons
const ICON_ATK=`<svg class="ow-icon" style="color:#E05555;flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 2L2 6.5l11 11L6.5 20H9l3.5-3.5L21 21l-4-14.5L6.5 2zm8.6 13.1L8.9 9 18 12l-2.9 3.1z"/></svg>`;
const ICON_DEF=`<svg class="ow-icon" style="color:#4A9EE0;flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l6 2.67V11c0 3.86-2.57 7.45-6 8.83C8.57 18.45 6 14.86 6 11V7.67L12 5z"/></svg>`;
const ICON_DIF=`<svg class="ow-icon" style="color:var(--accent);flex-shrink:0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
