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

// ════ SEED DATA ════
const SH=[
  ['name','role','subrole','priority','banned','notes','counters','strongmaps','weakmaps'],
  ['D.Va','Tank','Initiator',5,'FALSE','','','',''],
  ['Doomfist','Tank','Initiator',5,'FALSE','','','',''],
  ['Hazard','Tank','Initiator',5,'FALSE','','','',''],
  ['Winston','Tank','Initiator',5,'FALSE','','','',''],
  ['Wrecking Ball','Tank','Initiator',5,'FALSE','','','',''],
  ['Orisa','Tank','Bruiser',5,'FALSE','','','',''],
  ['Mauga','Tank','Bruiser',5,'FALSE','','','',''],
  ['Roadhog','Tank','Bruiser',5,'FALSE','','','',''],
  ['Zarya','Tank','Bruiser',5,'FALSE','','','',''],
  ['Domina','Tank','Stalwart',5,'FALSE','','','',''],
  ['Junker Queen','Tank','Stalwart',5,'FALSE','','','',''],
  ['Ramattra','Tank','Stalwart',5,'FALSE','','','',''],
  ['Reinhardt','Tank','Stalwart',5,'FALSE','','','',''],
  ['Sigma','Tank','Stalwart',5,'FALSE','','','',''],
  ['Bastion','Damage','Specialist',5,'FALSE','','','',''],
  ['Emre','Damage','Specialist',5,'FALSE','','','',''],
  ['Junkrat','Damage','Specialist',5,'FALSE','','','',''],
  ['Mei','Damage','Specialist',5,'FALSE','','','',''],
  ['Soldier: 76','Damage','Specialist',5,'FALSE','','','',''],
  ['Symmetra','Damage','Specialist',5,'FALSE','','','',''],
  ['Torbjörn','Damage','Specialist',5,'FALSE','','','',''],
  ['Ashe','Damage','Sharpshooter',5,'FALSE','','','',''],
  ['Cassidy','Damage','Sharpshooter',5,'FALSE','','','',''],
  ['Hanzo','Damage','Sharpshooter',5,'FALSE','','','',''],
  ['Widowmaker','Damage','Sharpshooter',5,'FALSE','','','',''],
  ['Sojourn','Damage','Sharpshooter',5,'FALSE','','','',''],
  ['Anran','Damage','Flanker',5,'FALSE','','','',''],
  ['Genji','Damage','Flanker',5,'FALSE','','','',''],
  ['Reaper','Damage','Flanker',5,'FALSE','','','',''],
  ['Tracer','Damage','Flanker',5,'FALSE','','','',''],
  ['Vendetta','Damage','Flanker',5,'FALSE','','','',''],
  ['Venture','Damage','Flanker',5,'FALSE','','','',''],
  ['Echo','Damage','Recon',5,'FALSE','','','',''],
  ['Freja','Damage','Recon',5,'FALSE','','','',''],
  ['Pharah','Damage','Recon',5,'FALSE','','','',''],
  ['Sierra','Damage','Recon',5,'FALSE','','','',''],
  ['Sombra','Damage','Recon',5,'FALSE','','','',''],
  ['Ana','Support','Tactician',5,'FALSE','','','',''],
  ['Baptiste','Support','Tactician',5,'FALSE','','','',''],
  ['Jetpack Cat','Support','Tactician',5,'FALSE','','','',''],
  ['Lucio','Support','Tactician',5,'FALSE','','','',''],
  ['Zenyatta','Support','Tactician',5,'FALSE','','','',''],
  ['Kiriko','Support','Medic',5,'FALSE','','','',''],
  ['Lifeweaver','Support','Medic',5,'FALSE','','','',''],
  ['Mercy','Support','Medic',5,'FALSE','','','',''],
  ['Moira','Support','Medic',5,'FALSE','','','',''],
  ['Brigitte','Support','Survivor',5,'FALSE','','','',''],
  ['Illari','Support','Survivor',5,'FALSE','','','',''],
  ['Juno','Support','Survivor',5,'FALSE','','','',''],
  ['Mizuki','Support','Survivor',5,'FALSE','','','',''],
  ['Wuyang','Support','Survivor',5,'FALSE','','','',''],
];

const SM=[
  ['name','type','tier','priority','atk','def','dif','notes'],
  ['Blizzard World','Hybrid','B',1,3,3,3,''],
  ["King's Row",'Hybrid','S',2,5,5,3,''],
  ['Midtown','Hybrid','B',3,3,3,3,''],
  ['Numbani','Hybrid','A',4,4,3,3,''],
  ['Paraíso','Hybrid','B',5,3,3,3,''],
  ['Eichenwalde','Hybrid','A',6,4,4,3,''],
  ['Hollywood','Hybrid','B',7,3,3,3,''],
  ['Dorado','Escort','B',8,3,3,3,''],
  ['Havana','Escort','B',9,3,4,3,''],
  ['Junkertown','Escort','A',10,4,3,3,''],
  ['Circuit Royal','Escort','S',11,3,5,3,''],
  ['Rialto','Escort','B',12,3,3,3,''],
  ['Shambali Monastery','Escort','A',13,4,4,3,''],
  ['Watchpoint: Gibraltar','Escort','B',14,3,3,3,''],
  ['Route 66','Escort','C',15,2,3,3,''],
  ['Antarctic Peninsula','Control','A',16,3,3,3,''],
  ['Ilios','Control','S',17,3,3,3,''],
  ['Lijiang Tower','Control','S',18,3,3,3,''],
  ['Nepal','Control','A',19,3,3,3,''],
  ['Oasis','Control','B',20,3,3,3,''],
  ['Busan','Control','A',21,3,3,3,''],
  ['Samoa','Control','A',22,3,3,3,''],
  ['Runasapi','Push','B',23,3,3,3,''],
  ['New Queen Street','Push','A',24,4,3,3,''],
  ['Esperança','Push','B',25,3,3,3,''],
  ['Colosseo','Push','A',26,4,3,3,''],
  ['Suravasa','Flashpoint','A',27,3,3,4,''],
  ['New Junk City','Flashpoint','C',28,3,3,3,''],
];

// ════ ENSURE SHEETS ════
// Создаёт листы которых нет, не трогает существующие
const REQUIRED_SHEETS=[
  {title:'Heroes',      headers:['name','role','subrole','priority','banned','notes','counters','strongmaps','weakmaps']},
  {title:'Maps',        headers:['name','type','tier','priority','atk','def','dif','notes']},
  {title:'MapPreferred',headers:['map','hero']},
  {title:'MapBans',     headers:['map','hero']},
  {title:'Compositions',headers:['map','hero','role']},
  {title:'MapCounters', headers:['map','hero']},
  {title:'Players',     headers:['name','btag','mainrole','offrole','ranktank','rankdmg','ranksup','notes']},
  {title:'PlayerHeroes',headers:['player','hero','type']},
];

async function ensureSheets(){
  // Получаем список существующих листов
  const meta=await gapi.client.sheets.spreadsheets.get({spreadsheetId:SID()});
  const existing=new Set((meta.result.sheets||[]).map(s=>s.properties.title));

  const toCreate=REQUIRED_SHEETS.filter(s=>!existing.has(s.title));
  if(!toCreate.length)return{created:[]};

  // Создаём все отсутствующие листы одним запросом
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId:SID(),
    resource:{requests:toCreate.map(s=>({addSheet:{properties:{title:s.title}}}))}
  });

  // Пишем заголовки в новые листы
  await Promise.all(toCreate.map(s=>sUp(`${s.title}!A1`,[ s.headers ])));

  return{created:toCreate.map(s=>s.title)};
}

// ════ SYNC ════
// Добавляет новых героев/карты не трогая существующих данных

async function syncHeroes(){
  const{created}=await ensureSheets();

  const rows=await sGet('Heroes!A:A'); // только имена — быстро
  const existing=new Set(rows.slice(1).map(r=>r[0]).filter(Boolean));

  // Герои из SEED которых нет в таблице
  const toAdd=SH.slice(1).filter(r=>!existing.has(r[0]));
  if(!toAdd.length)return{added:0,created};

  await sApp('Heroes',toAdd);
  return{added:toAdd.length,created};
}

async function syncMaps(){
  const{created}=await ensureSheets();

  const rows=await sGet('Maps!A:A');
  const existing=new Set(rows.slice(1).map(r=>r[0]).filter(Boolean));

  // Назначаем приоритет: продолжение от максимального существующего
  const priorities=rows.slice(1).map(r=>parseInt(r[3])||0).filter(n=>n>0);
  let nextPriority=priorities.length?Math.max(...priorities)+1:1;

  const toAdd=SM.slice(1)
    .filter(r=>!existing.has(r[0]))
    .map(r=>[r[0],r[1],r[2],nextPriority++,r[4],r[5],r[6],r[7]]);

  if(!toAdd.length)return{added:0,created};

  await sApp('Maps',toAdd);
  return{added:toAdd.length,created};
}

// ════ SEED (полная перезапись, только для новых таблиц) ════
async function seedSheets(){
  if(!SID()){toast('Сначала укажи Sheet ID','err');return}
  if(!confirm('Заполнить таблицу стартовыми данными?\nHeroes и Maps будут перезаписаны полностью.'))return;
  try{
    const{created}=await ensureSheets();
    if(created.length)toast(`Созданы листы: ${created.join(', ')}`, 'ok');

    await sUp('Heroes!A1:I'+SH.length,SH);
    await sUp('Maps!A1:H'+SM.length,SM);
    toast('Таблица заполнена ✓','ok');
    await loadAllData();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}

// ════ SMART SYNC (обновить без потери данных) ════
async function smartSync(){
  if(!SID()){toast('Сначала укажи Sheet ID','err');return}
  try{
    toast('Синхронизация...','ok');
    const[h,m]=await Promise.all([syncHeroes(),syncMaps()]);

    const msgs=[];
    if(h.created.length)msgs.push(`Созданы листы: ${h.created.join(', ')}`);
    if(h.added)msgs.push(`Добавлено героев: ${h.added}`);
    if(m.added)msgs.push(`Добавлено карт: ${m.added}`);
    if(!msgs.length)msgs.push('Всё актуально — новых записей нет');

    toast(msgs.join(' · '),'ok');
    await loadAllData();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}
