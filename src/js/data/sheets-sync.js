// ════ SEED DATA ════
const SH=[
  ['name','role','subrole','priority','banned','notes','counters'],
  ['D.Va','Tank','Initiator',5,'FALSE','',''],
  ['Doomfist','Tank','Initiator',5,'FALSE','',''],
  ['Hazard','Tank','Initiator',5,'FALSE','',''],
  ['Winston','Tank','Initiator',5,'FALSE','',''],
  ['Wrecking Ball','Tank','Initiator',5,'FALSE','',''],
  ['Orisa','Tank','Bruiser',5,'FALSE','',''],
  ['Mauga','Tank','Bruiser',5,'FALSE','',''],
  ['Roadhog','Tank','Bruiser',5,'FALSE','',''],
  ['Zarya','Tank','Bruiser',5,'FALSE','',''],
  ['Domina','Tank','Stalwart',5,'FALSE','',''],
  ['Junker Queen','Tank','Stalwart',5,'FALSE','',''],
  ['Ramattra','Tank','Stalwart',5,'FALSE','',''],
  ['Reinhardt','Tank','Stalwart',5,'FALSE','',''],
  ['Sigma','Tank','Stalwart',5,'FALSE','',''],
  ['Bastion','Damage','Specialist',5,'FALSE','',''],
  ['Emre','Damage','Specialist',5,'FALSE','',''],
  ['Junkrat','Damage','Specialist',5,'FALSE','',''],
  ['Mei','Damage','Specialist',5,'FALSE','',''],
  ['Soldier: 76','Damage','Specialist',5,'FALSE','',''],
  ['Symmetra','Damage','Specialist',5,'FALSE','',''],
  ['Torbjörn','Damage','Specialist',5,'FALSE','',''],
  ['Ashe','Damage','Sharpshooter',5,'FALSE','',''],
  ['Cassidy','Damage','Sharpshooter',5,'FALSE','',''],
  ['Hanzo','Damage','Sharpshooter',5,'FALSE','',''],
  ['Widowmaker','Damage','Sharpshooter',5,'FALSE','',''],
  ['Sojourn','Damage','Sharpshooter',5,'FALSE','',''],
  ['Anran','Damage','Flanker',5,'FALSE','',''],
  ['Genji','Damage','Flanker',5,'FALSE','',''],
  ['Reaper','Damage','Flanker',5,'FALSE','',''],
  ['Tracer','Damage','Flanker',5,'FALSE','',''],
  ['Vendetta','Damage','Flanker',5,'FALSE','',''],
  ['Venture','Damage','Flanker',5,'FALSE','',''],
  ['Echo','Damage','Recon',5,'FALSE','',''],
  ['Freja','Damage','Recon',5,'FALSE','',''],
  ['Pharah','Damage','Recon',5,'FALSE','',''],
  ['Sierra','Damage','Recon',5,'FALSE','',''],
  ['Sombra','Damage','Recon',5,'FALSE','',''],
  ['Ana','Support','Tactician',5,'FALSE','',''],
  ['Baptiste','Support','Tactician',5,'FALSE','',''],
  ['Jetpack Cat','Support','Tactician',5,'FALSE','',''],
  ['Lucio','Support','Tactician',5,'FALSE','',''],
  ['Zenyatta','Support','Tactician',5,'FALSE','',''],
  ['Kiriko','Support','Medic',5,'FALSE','',''],
  ['Lifeweaver','Support','Medic',5,'FALSE','',''],
  ['Mercy','Support','Medic',5,'FALSE','',''],
  ['Moira','Support','Medic',5,'FALSE','',''],
  ['Brigitte','Support','Survivor',5,'FALSE','',''],
  ['Illari','Support','Survivor',5,'FALSE','',''],
  ['Juno','Support','Survivor',5,'FALSE','',''],
  ['Mizuki','Support','Survivor',5,'FALSE','',''],
  ['Wuyang','Support','Survivor',5,'FALSE','',''],
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
const REQUIRED_SHEETS=[
  {title:'Heroes',       headers:['name','role','subrole','priority','banned','notes','counters']},
  {title:'Maps',         headers:['name','type','tier','priority','atk','def','dif','notes','inpool']},
  {title:'MapPreferred', headers:['map','hero']},
  {title:'MapBans',      headers:['map','hero']},
  {title:'Compositions', headers:['map','hero','role','playerRole']},
  {title:'MapCounters',  headers:['map','hero']},
  {title:'Players',      headers:['name','btag','mainrole','offrole','ranktank','rankdmg','ranksup','notes']},
  {title:'PlayerHeroes', headers:['player','hero','type']},
  {title:'TierMaps',     headers:['name','tier']},
  {title:'TierHeroes',   headers:['name','tier']},
  {title:'HeroMapStrength', headers:['hero','map','atk','def']},
  {title:'HeroSynergy',  headers:['hero','synergy_hero','score']},
];

async function ensureSheets(){
  const meta=await gapi.client.sheets.spreadsheets.get({spreadsheetId:SID()});
  const existing=new Set((meta.result.sheets||[]).map(s=>s.properties.title));
  const toCreate=REQUIRED_SHEETS.filter(s=>!existing.has(s.title));
  if(!toCreate.length)return{created:[]};
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId:SID(),
    resource:{requests:toCreate.map(s=>({addSheet:{properties:{title:s.title}}}))}
  });
  await Promise.all(toCreate.map(s=>sUp(`${s.title}!A1`,[s.headers])));
  return{created:toCreate.map(s=>s.title)};
}

async function syncHeroes(){
  const{created}=await ensureSheets();
  const rows=await sGet('Heroes!A:A');
  const existing=new Set(rows.slice(1).map(r=>r[0]).filter(Boolean));
  const toAdd=SH.slice(1).filter(r=>!existing.has(r[0]));
  if(!toAdd.length)return{added:0,created};
  await sApp('Heroes',toAdd);
  return{added:toAdd.length,created};
}

async function syncMaps(){
  const{created}=await ensureSheets();
  const rows=await sGet('Maps!A:A');
  const existing=new Set(rows.slice(1).map(r=>r[0]).filter(Boolean));
  const priorities=rows.slice(1).map(r=>parseInt(r[3])||0).filter(n=>n>0);
  let nextP=priorities.length?Math.max(...priorities)+1:1;
  const toAdd=SM.slice(1).filter(r=>!existing.has(r[0]))
    .map(r=>[r[0],r[1],r[2],nextP++,r[4],r[5],r[6],r[7]]);
  if(!toAdd.length)return{added:0,created};
  await sApp('Maps',toAdd);
  return{added:toAdd.length,created};
}

async function seedSheets(){
  if(!SID()){toast('Сначала укажи Sheet ID','err');return}
  if(!confirm('Заполнить таблицу стартовыми данными?\nHeroes и Maps будут перезаписаны полностью.'))return;
  try{
    const{created}=await ensureSheets();
    if(created.length)toast(`Созданы листы: ${created.join(', ')}`,'ok');
    await sUp('Heroes!A1:G'+SH.length,SH);
    await sUp('Maps!A1:H'+SM.length,SM);
    toast('Таблица заполнена ✓','ok');
    await loadAllData();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}

async function smartSync(){
  if(!SID()){toast('Сначала укажи Sheet ID','err');return}
  try{
    toast('Синхронизация...','ok');
    const[h,m]=await Promise.all([syncHeroes(),syncMaps()]);
    const msgs=[];
    if(h.created.length)msgs.push(`Созданы листы: ${h.created.join(', ')}`);
    if(h.added)msgs.push(`Добавлено героев: ${h.added}`);
    if(m.added)msgs.push(`Добавлено карт: ${m.added}`);
    if(!msgs.length)msgs.push('Всё актуально');
    toast(msgs.join(' · '),'ok');
    await loadAllData();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}
