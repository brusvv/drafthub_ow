// ════ SHEETS API ════
const SID=()=>getSheetId();
async function sGet(r){const res=await gapi.client.sheets.spreadsheets.values.get({spreadsheetId:SID(),range:r});return res.result.values||[]}
async function sUp(r,v){await gapi.client.sheets.spreadsheets.values.update({spreadsheetId:SID(),range:r,valueInputOption:'USER_ENTERED',resource:{values:v}})}
async function sApp(s,v){await gapi.client.sheets.spreadsheets.values.append({spreadsheetId:SID(),range:s+'!A1',valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',resource:{values:v}})}
async function sClear(r){await gapi.client.sheets.spreadsheets.values.clear({spreadsheetId:SID(),range:r})}
async function sDelRow(gid,idx){await gapi.client.sheets.spreadsheets.batchUpdate({spreadsheetId:SID(),resource:{requests:[{deleteDimension:{range:{sheetId:gid,dimension:'ROWS',startIndex:idx,endIndex:idx+1}}}]}})}
async function sGid(name){const m=await gapi.client.sheets.spreadsheets.get({spreadsheetId:SID()});const s=(m.result.sheets||[]).find(s=>s.properties.title===name);return s?s.properties.sheetId:null}

// ════ LOAD ALL ════
async function loadAllData(){
  if(!SID())return;
  showLoading('mapGrid','card',8);showLoading('heroPool','hero',12);showLoading('playerGrid','player',5);
  try{
    await Promise.all([
      loadPortraits(),loadMapScreenshots(),
      loadHeroes(),loadMaps(),loadPlayers(),
      loadTiers(),loadHeroMapStrength(),loadHeroSynergy()
    ]);
    renderCurrentView();
  }catch(e){showError('mapGrid','Ошибка: '+e.message);console.error(e)}
}

// ════ TIERS ════
async function loadTiers(){
  let tm=[],th=[];
  try{[tm,th]=await Promise.all([sGet('TierMaps!A:B'),sGet('TierHeroes!A:B')])}catch(e){return;}
  const rowsM=tm.slice(1).filter(r=>r[0]&&r[1]);
  if(rowsM.length){
    tierOrderMaps={S:[],A:[],B:[],C:[],D:[]};
    rowsM.forEach(r=>{const t=r[1];if(tierOrderMaps[t])tierOrderMaps[t].push(r[0]);});
  }
  const rowsH=th.slice(1).filter(r=>r[0]&&r[1]);
  if(rowsH.length){
    tierOrderHeroes={S:[],A:[],B:[],C:[],D:[]};
    rowsH.forEach(r=>{const t=r[1];if(tierOrderHeroes[t])tierOrderHeroes[t].push(r[0]);});
  }
}

// ════ HEROES ════
async function loadHeroes(){
  const rows=await sGet('Heroes!A:I');
  if(rows.length<2){heroes=[];return}
  const[h,...d]=rows;
  const i=f=>h.findIndex(x=>x.toLowerCase()===f.toLowerCase());
  const iN=i('name'),iR=i('role'),iS=i('subrole'),iP=i('priority'),iB=i('banned'),iNo=i('notes'),iC=i('counters');
  heroes=d.filter(r=>r[iN]).map((r,idx)=>({
    rowIndex:idx+2,
    name:r[iN]||'',role:r[iR]||'',subrole:r[iS]||'',
    priority:parseInt(r[iP])||5,
    banned:(r[iB]||'').toUpperCase()==='TRUE',
    notes:r[iNo]||'',
    counters:parseCounters(r[iC]||''),
    // strongMaps/weakMaps теперь вычисляются из HeroMapStrength
    strongMaps:[],weakMaps:[]
  }));
  heroMap={};heroes.forEach(h=>{heroMap[h.name]=h});
}

function parseCounters(str){
  return str.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
    const sep=s.lastIndexOf(':');
    const scoreText=sep>=0?s.slice(sep+1).trim():'';
    const score=parseInt(scoreText,10);
    if(sep>=0&&Number.isFinite(score)&&score>=1&&score<=10)return{name:s.slice(0,sep).trim(),score};
    return{name:s.trim(),score:5};
  });
}

// ════ MAPS ════
async function loadMaps(){
  const[mr,pr,br,cr,mcr]=await Promise.all([
    sGet('Maps!A:I'),sGet('MapPreferred!A:B'),sGet('MapBans!A:B'),
    sGet('Compositions!A:D'),sGet('MapCounters!A:B')
  ]);
  const pf={},bn={},co={},mc={};
  pr.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!pf[r[0]])pf[r[0]]=[];pf[r[0]].push(r[1])}});
  br.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!bn[r[0]])bn[r[0]]=[];bn[r[0]].push(r[1])}});
  cr.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!co[r[0]])co[r[0]]=[];co[r[0]].push({hero:r[1],role:r[2]||'',playerRole:r[3]||r[2]||''})}});
  mcr.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!mc[r[0]])mc[r[0]]=[];mc[r[0]].push(r[1])}});
  if(mr.length<2){maps=[];return}
  const[h,...d]=mr;
  const i=f=>h.findIndex(x=>x.toLowerCase()===f.toLowerCase());
  maps=d.filter(r=>r[i('name')]).map((r,idx)=>({
    rowIndex:idx+2,
    name:r[i('name')]||'',type:r[i('type')]||'',tier:r[i('tier')]||'B',
    priority:parseInt(r[i('priority')])||5,
    atk:parseInt(r[i('atk')])||3,def:parseInt(r[i('def')])||3,
    dif:parseInt(r[i('dif')])||3,
    notes:r[i('notes')]||'',
    inPool:r[i('inpool')]!=='FALSE'&&r[i('inpool')]!=='false',
    preferredHeroes:pf[r[i('name')]]||[],
    bans:bn[r[i('name')]]||[],
    comp:co[r[i('name')]]||[],
    counters:mc[r[i('name')]]||[]
  }));
}

// ════ PLAYERS ════
async function loadPlayers(){
  const[pr,ph]=await Promise.all([sGet('Players!A:H'),sGet('PlayerHeroes!A:C')]);
  const hm={main:{},pool:{}};
  ph.slice(1).forEach(r=>{
    if(!r[0]||!r[1])return;
    const t=r[2]||'pool';
    if(!hm[t])hm[t]={};
    if(!hm[t][r[0]])hm[t][r[0]]=[];
    hm[t][r[0]].push(r[1]);
  });
  if(pr.length<2){players=[];return}
  const[h,...d]=pr;
  const i=f=>h.findIndex(x=>x.toLowerCase()===f.toLowerCase());
  players=d.filter(r=>r[i('name')]).map((r,idx)=>({
    rowIndex:idx+2,
    name:r[i('name')]||'',btag:r[i('btag')]||'',
    mainRole:r[i('mainrole')]||'',offRole:r[i('offrole')]||'',
    rankTank:r[i('ranktank')]||'',rankDmg:r[i('rankdmg')]||'',rankSup:r[i('ranksup')]||'',
    notes:r[i('notes')]||'',
    inPool:r[i('inpool')]!=='FALSE'&&r[i('inpool')]!=='false',
    mainHeroes:hm.main[r[i('name')]]||[],
    poolHeroes:hm.pool[r[i('name')]]||[]
  }));
}

// ════ HERO MAP STRENGTH ════
// Лист: hero | map | atk | def
// atk/def = 1–10. Для Control/Push/Flashpoint — только atk (общая сила)
let heroMapStrength={};  // { heroName: { mapName: {atk,def,avg} } }

async function loadHeroMapStrength(){
  heroMapStrength={};
  let rows=[];
  try{rows=await sGet('HeroMapStrength!A:D')}catch(e){return;}
  if(rows.length<2)return;
  rows.slice(1).forEach(r=>{
    const [hero,map,atkRaw,defRaw]=r;
    if(!hero||!map)return;
    const atk=parseInt(atkRaw)||0;
    const def=parseInt(defRaw)||atk;  // для режимов без ATK/DEF def=atk
    const avg=def?Math.round((atk+def)/2):atk;
    if(!heroMapStrength[hero])heroMapStrength[hero]={};
    heroMapStrength[hero][map]={atk,def,avg};
  });
  // Обновляем strongMaps/weakMaps на героях на основе порогов
  heroes.forEach(h=>{
    const entries=Object.entries(heroMapStrength[h.name]||{});
    h.strongMaps=entries.filter(([,v])=>v.avg>=7).map(([m])=>m);
    h.weakMaps  =entries.filter(([,v])=>v.avg<=4).map(([m])=>m);
  });
}

// ════ HERO SYNERGY ════
// Лист: hero | synergy_hero | score
let heroSynergy={};  // { heroName: [ {name, score} ] }

async function loadHeroSynergy(){
  heroSynergy={};
  let rows=[];
  try{rows=await sGet('HeroSynergy!A:C')}catch(e){return;}
  if(rows.length<2)return;
  rows.slice(1).forEach(r=>{
    const [hero,syn,scoreRaw]=r;
    if(!hero||!syn)return;
    const score=parseInt(scoreRaw)||5;
    if(!heroSynergy[hero])heroSynergy[hero]=[];
    heroSynergy[hero].push({name:syn,score});
  });
}
