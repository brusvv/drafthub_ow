// ════ CONFIG ════
const SCOPES='https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY='https://sheets.googleapis.com/$discovery/rest?version=v4';
let tokenClient=null,gapiInited=false,gisInited=false;

let heroes=[],maps=[],heroMap={},heroPortraits={},mapScreenshots={};
let mapFilter='all',heroFilter='all';

const rc={Tank:'var(--tank)',Damage:'var(--damage)',Support:'var(--support)'};
const ts={S:{bg:'rgba(240,160,48,.15)',c:'var(--tier-s)'},A:{bg:'rgba(139,195,74,.15)',c:'var(--tier-a)'},B:{bg:'rgba(91,155,213,.15)',c:'var(--tier-b)'},C:{bg:'rgba(136,136,136,.1)',c:'var(--tier-c)'},D:{bg:'rgba(160,64,48,.15)',c:'var(--tier-d)'}};

// Control/Flashpoint — нет ATK/DEF
const NO_ATKDEF=['Control','Flashpoint'];

// ════ PICKER STATE ════
let pickerMode='preferred'; // 'preferred'|'bans'|'comp'
let pickerSelected={preferred:[],bans:[],comp:[]};
let pickerRoleFilter='all';

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
  const k=name.toLowerCase();
  return heroPortraits[k]||heroPortraits[mapKey(name)]||null;
}
function mapImg(name){
  const k=name.toLowerCase();
  return mapScreenshots[k]||mapScreenshots[mapKey(name)]||null;
}

function imgH(src,cls,fallbackLetter,extra=''){
  if(src)return`<img src="${src}" class="${cls}" alt="" onerror="this.outerHTML='<div class=\\'${cls}-ph\\'>${fallbackLetter}</div>'" ${extra}>`;
  return`<div class="${cls}-ph">${fallbackLetter}</div>`;
}

