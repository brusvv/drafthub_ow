
// ════ LOAD ════
async function loadAllData(){
  if(!SID())return;
  showLoading('mapGrid');showLoading('heroPool');showLoading('playerGrid');
  try{
    await Promise.all([loadPortraits(),loadMapScreenshots(),loadHeroes(),loadMaps(),loadPlayers()]);
    renderCurrentView();
  }catch(e){showError('mapGrid','Ошибка: '+e.message);console.error(e)}
}

async function loadHeroes(){
  const rows=await sGet('Heroes!A:I');
  if(rows.length<2){heroes=[];return}
  const[h,...d]=rows;
  const i=f=>h.findIndex(x=>x.toLowerCase()===f.toLowerCase());
  const iN=i('name'),iR=i('role'),iS=i('subrole'),iP=i('priority'),iB=i('banned'),iNo=i('notes'),iC=i('counters'),iSt=i('strongmaps'),iWk=i('weakmaps');
  heroes=d.filter(r=>r[iN]).map((r,idx)=>({
    rowIndex:idx+2,
    name:r[iN]||'',role:r[iR]||'',subrole:r[iS]||'',
    priority:parseInt(r[iP])||5,
    banned:(r[iB]||'').toUpperCase()==='TRUE',
    notes:r[iNo]||'',
    counters:parseCounters(r[iC]||''),
    strongMaps:(r[iSt]||'').split(',').map(x=>x.trim()).filter(Boolean),
    weakMaps:(r[iWk]||'').split(',').map(x=>x.trim()).filter(Boolean)
  }));
  heroMap={};heroes.forEach(h=>{heroMap[h.name]=h});
}

function parseCounters(str){
  // Формат: "Zarya:9, Ana:7" или просто "Zarya, Ana"
  return str.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{
    const p=s.split(':');return{name:p[0].trim(),score:parseInt(p[1])||5};
  });
}

async function loadMaps(){
  const[mr,pr,br,cr,mcr]=await Promise.all([
    sGet('Maps!A:H'),sGet('MapPreferred!A:B'),sGet('MapBans!A:B'),
    sGet('Compositions!A:C'),sGet('MapCounters!A:B')
  ]);
  const pf={},bn={},co={},mc={};
  pr.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!pf[r[0]])pf[r[0]]=[];pf[r[0]].push(r[1])}});
  br.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!bn[r[0]])bn[r[0]]=[];bn[r[0]].push(r[1])}});
  cr.slice(1).forEach(r=>{if(r[0]&&r[1]){if(!co[r[0]])co[r[0]]=[];co[r[0]].push({hero:r[1],role:r[2]||''})}});
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
    preferredHeroes:pf[r[i('name')]]||[],bans:bn[r[i('name')]]||[],
    comp:co[r[i('name')]]||[],counters:mc[r[i('name')]]||[]
  }));
}

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
    mainHeroes:hm.main[r[i('name')]]||[],
    poolHeroes:hm.pool[r[i('name')]]||[]
  }));
}

// ════ SEED ════
const SH=[['name','role','subrole','priority','banned','notes','counters','strongmaps','weakmaps'],['D.Va','Tank','Initiator',5,'FALSE','','','',''],['Doomfist','Tank','Initiator',5,'FALSE','','','',''],['Hazard','Tank','Initiator',5,'FALSE','','','',''],['Winston','Tank','Initiator',5,'FALSE','','','',''],['Wrecking Ball','Tank','Initiator',5,'FALSE','','','',''],['Orisa','Tank','Bruiser',5,'FALSE','','','',''],['Mauga','Tank','Bruiser',5,'FALSE','','','',''],['Roadhog','Tank','Bruiser',5,'FALSE','','','',''],['Zarya','Tank','Bruiser',5,'FALSE','','','',''],['Domina','Tank','Stalwart',5,'FALSE','','','',''],['Junker Queen','Tank','Stalwart',5,'FALSE','','','',''],['Ramattra','Tank','Stalwart',5,'FALSE','','','',''],['Reinhardt','Tank','Stalwart',5,'FALSE','','','',''],['Sigma','Tank','Stalwart',5,'FALSE','','','',''],['Bastion','Damage','Specialist',5,'FALSE','','','',''],['Emre','Damage','Specialist',5,'FALSE','','','',''],['Junkrat','Damage','Specialist',5,'FALSE','','','',''],['Mei','Damage','Specialist',5,'FALSE','','','',''],['Soldier: 76','Damage','Specialist',5,'FALSE','','','',''],['Symmetra','Damage','Specialist',5,'FALSE','','','',''],['Torbjörn','Damage','Specialist',5,'FALSE','','','',''],['Ashe','Damage','Sharpshooter',5,'FALSE','','','',''],['Cassidy','Damage','Sharpshooter',5,'FALSE','','','',''],['Hanzo','Damage','Sharpshooter',5,'FALSE','','','',''],['Widowmaker','Damage','Sharpshooter',5,'FALSE','','','',''],['Sojourn','Damage','Sharpshooter',5,'FALSE','','','',''],['Anran','Damage','Flanker',5,'FALSE','','','',''],['Genji','Damage','Flanker',5,'FALSE','','','',''],['Reaper','Damage','Flanker',5,'FALSE','','','',''],['Tracer','Damage','Flanker',5,'FALSE','','','',''],['Vendetta','Damage','Flanker',5,'FALSE','','','',''],['Venture','Damage','Flanker',5,'FALSE','','','',''],['Echo','Damage','Recon',5,'FALSE','','','',''],['Freja','Damage','Recon',5,'FALSE','','','',''],['Pharah','Damage','Recon',5,'FALSE','','','',''],['Sierra','Damage','Recon',5,'FALSE','','','',''],['Sombra','Damage','Recon',5,'FALSE','','','',''],['Ana','Support','Tactician',5,'FALSE','','','',''],['Baptiste','Support','Tactician',5,'FALSE','','','',''],['Jetpack Cat','Support','Tactician',5,'FALSE','','','',''],['Lucio','Support','Tactician',5,'FALSE','','','',''],['Zenyatta','Support','Tactician',5,'FALSE','','','',''],['Kiriko','Support','Medic',5,'FALSE','','','',''],['Lifeweaver','Support','Medic',5,'FALSE','','','',''],['Mercy','Support','Medic',5,'FALSE','','','',''],['Moira','Support','Medic',5,'FALSE','','','',''],['Brigitte','Support','Survivor',5,'FALSE','','','',''],['Illari','Support','Survivor',5,'FALSE','','','',''],['Juno','Support','Survivor',5,'FALSE','','','',''],['Mizuki','Support','Survivor',5,'FALSE','','','',''],['Wuyang','Support','Survivor',5,'FALSE','','','']];
const SM=[['name','type','tier','priority','atk','def','dif','notes'],["Blizzard World",'Hybrid','B',1,3,3,3,''],["King's Row",'Hybrid','S',2,5,5,3,''],['Midtown','Hybrid','B',3,3,3,3,''],['Numbani','Hybrid','A',4,4,3,3,''],['Paraíso','Hybrid','B',5,3,3,3,''],['Eichenwalde','Hybrid','A',6,4,4,3,''],['Hollywood','Hybrid','B',7,3,3,3,''],['Dorado','Escort','B',8,3,3,3,''],['Havana','Escort','B',9,3,4,3,''],['Junkertown','Escort','A',10,4,3,3,''],['Circuit Royal','Escort','S',11,3,5,3,''],['Rialto','Escort','B',12,3,3,3,''],['Shambali Monastery','Escort','A',13,4,4,3,''],['Watchpoint: Gibraltar','Escort','B',14,3,3,3,''],['Route 66','Escort','C',15,2,3,3,''],['Antarctic Peninsula','Control','A',16,3,3,3,''],['Ilios','Control','S',17,3,3,3,''],['Lijiang Tower','Control','S',18,3,3,3,''],['Nepal','Control','A',19,3,3,3,''],['Oasis','Control','B',20,3,3,3,''],['Runasapi','Push','B',21,3,3,3,''],['New Queen Street','Push','A',22,4,3,3,''],['Esperança','Push','B',23,3,3,3,''],['Colosseo','Push','A',24,4,3,3,''],['Suravasa','Flashpoint','A',25,3,3,4,''],['New Junk City','Flashpoint','C',26,3,3,3,'']];

async function seedSheets(){
  if(!SID()){toast('Сначала укажи Sheet ID','err');return}
  if(!confirm('Заполнить таблицу стартовыми данными?\nHeroes и Maps будут перезаписаны.'))return;
  try{
    await sUp('Heroes!A1:I'+SH.length,SH);
    await sUp('Maps!A1:H'+SM.length,SM);
    await sUp('MapPreferred!A1:B1',[['map','hero']]);
    await sUp('MapBans!A1:B1',[['map','hero']]);
    await sUp('Compositions!A1:C1',[['map','hero','role']]);
    await sUp('MapCounters!A1:B1',[['map','hero']]);
    await sUp('Players!A1:H1',[['name','btag','mainrole','offrole','ranktank','rankdmg','ranksup','notes']]);
    await sUp('PlayerHeroes!A1:C1',[['player','hero','type']]);
    toast('Таблица заполнена ✓','ok');await loadAllData();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
