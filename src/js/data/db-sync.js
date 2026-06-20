// @hash f2fab166 2026-06-20T08:48
// ════ DATA — SYNC / SEED (Supabase) ════
// Замена sheets-sync.js. Для новой команды наполняет стартовым
// набором героев и карт. Схема БД фиксирована миграциями (001_initial_schema.sql),
// поэтому в отличие от Sheets-версии здесь не нужен ensureSheets()/migrateSheet().

// ════ SEED DATA — те же герои/карты что и раньше ════
const SEED_HEROES = [
  ['D.Va','Tank','Initiator',5],['Doomfist','Tank','Initiator',5],['Hazard','Tank','Initiator',5],
  ['Winston','Tank','Initiator',5],['Wrecking Ball','Tank','Initiator',5],
  ['Orisa','Tank','Bruiser',5],['Mauga','Tank','Bruiser',5],['Roadhog','Tank','Bruiser',5],['Zarya','Tank','Bruiser',5],
  ['Domina','Tank','Stalwart',5],['Junker Queen','Tank','Stalwart',5],['Ramattra','Tank','Stalwart',5],
  ['Reinhardt','Tank','Stalwart',5],['Sigma','Tank','Stalwart',5],
  ['Bastion','Damage','Specialist',5],['Emre','Damage','Specialist',5],['Junkrat','Damage','Specialist',5],
  ['Mei','Damage','Specialist',5],['Soldier: 76','Damage','Specialist',5],['Symmetra','Damage','Specialist',5],
  ['Torbjörn','Damage','Specialist',5],
  ['Ashe','Damage','Sharpshooter',5],['Cassidy','Damage','Sharpshooter',5],['Hanzo','Damage','Sharpshooter',5],
  ['Widowmaker','Damage','Sharpshooter',5],['Sojourn','Damage','Sharpshooter',5],
  ['Anran','Damage','Flanker',5],['Genji','Damage','Flanker',5],['Reaper','Damage','Flanker',5],
  ['Tracer','Damage','Flanker',5],['Vendetta','Damage','Flanker',5],['Venture','Damage','Flanker',5],
  ['Echo','Damage','Recon',5],['Freja','Damage','Recon',5],['Pharah','Damage','Recon',5],
  ['Sierra','Damage','Recon',5],['Sombra','Damage','Recon',5],
  ['Ana','Support','Tactician',5],['Baptiste','Support','Tactician',5],['Jetpack Cat','Support','Tactician',5],
  ['Lucio','Support','Tactician',5],['Zenyatta','Support','Tactician',5],
  ['Kiriko','Support','Medic',5],['Lifeweaver','Support','Medic',5],['Mercy','Support','Medic',5],['Moira','Support','Medic',5],
  ['Brigitte','Support','Survivor',5],['Illari','Support','Survivor',5],['Juno','Support','Survivor',5],
  ['Mizuki','Support','Survivor',5],['Wuyang','Support','Survivor',5],
];

const SEED_MAPS = [
  ['Blizzard World','Hybrid','B',1,3,3,3],["King's Row",'Hybrid','S',2,5,5,3],
  ['Midtown','Hybrid','B',3,3,3,3],['Numbani','Hybrid','A',4,4,3,3],
  ['Paraíso','Hybrid','B',5,3,3,3],['Eichenwalde','Hybrid','A',6,4,4,3],['Hollywood','Hybrid','B',7,3,3,3],
  ['Dorado','Escort','B',8,3,3,3],['Havana','Escort','B',9,3,4,3],['Junkertown','Escort','A',10,4,3,3],
  ['Circuit Royal','Escort','S',11,3,5,3],['Rialto','Escort','B',12,3,3,3],
  ['Shambali Monastery','Escort','A',13,4,4,3],['Watchpoint: Gibraltar','Escort','B',14,3,3,3],['Route 66','Escort','C',15,2,3,3],
  ['Antarctic Peninsula','Control','A',16,3,3,3],['Ilios','Control','S',17,3,3,3],['Lijiang Tower','Control','S',18,3,3,3],
  ['Nepal','Control','A',19,3,3,3],['Oasis','Control','B',20,3,3,3],['Busan','Control','A',21,3,3,3],['Samoa','Control','A',22,3,3,3],
  ['Runasapi','Push','B',23,3,3,3],['New Queen Street','Push','A',24,4,3,3],
  ['Esperança','Push','B',25,3,3,3],['Colosseo','Push','A',26,4,3,3],
  ['Suravasa','Flashpoint','A',27,3,3,4],['New Junk City','Flashpoint','C',28,3,3,3],
];

// ── Заполняет новую (пустую) команду стартовыми данными ──────
async function seedTeamData(teamId = _teamId()){
  try{
    const heroRows = SEED_HEROES.map(([name,role,subrole,priority]) => ({
      team_id: teamId, name, role, subrole, priority, banned:false, notes:'', counters:[],
    }));
    const mapRows = SEED_MAPS.map(([name,type,tier,priority,atk,def,dif]) => ({
      team_id: teamId, name, type, tier, priority, atk, def, dif, notes:'', in_pool:true,
      preferred_heroes:[], ban_heroes:[], counters:[], comp:[],
    }));

    const { error: heroErr } = await _sb.from('heroes').insert(heroRows);
    if(heroErr) throw heroErr;
    const { error: mapErr } = await _sb.from('maps').insert(mapRows);
    if(mapErr) throw mapErr;

    toast(`Заполнено: ${heroRows.length} героев, ${mapRows.length} карт ✓`, 'ok');
  }catch(e){ toast('Ошибка seed: ' + e.message, 'err'); console.error(e); }
}

// ── Добавляет недостающих героев/карты без перезаписи существующих ──
// (аналог старого smartSync — для команд которые уже что-то отредактировали)
async function smartSyncSeed(){
  if(!canWrite()){ toast('Нет прав', 'err'); return; }
  try{
    const existingHeroNames = new Set(heroes.map(h => h.name));
    const existingMapNames  = new Set(maps.map(m => m.name));

    const newHeroes = SEED_HEROES.filter(([name]) => !existingHeroNames.has(name))
      .map(([name,role,subrole,priority]) => ({
        team_id:_teamId(), name, role, subrole, priority, banned:false, notes:'', counters:[],
      }));
    const maxPriority = maps.reduce((m,x) => Math.max(m, x.priority||0), 0);
    let nextP = maxPriority + 1;
    const newMaps = SEED_MAPS.filter(([name]) => !existingMapNames.has(name))
      .map(([name,type,tier,,atk,def,dif]) => ({
        team_id:_teamId(), name, type, tier, priority:nextP++, atk, def, dif, notes:'', in_pool:true,
        preferred_heroes:[], ban_heroes:[], counters:[], comp:[],
      }));

    if(newHeroes.length) await _sb.from('heroes').insert(newHeroes);
    if(newMaps.length)   await _sb.from('maps').insert(newMaps);

    const msgs = [];
    if(newHeroes.length) msgs.push(`+${newHeroes.length} героев`);
    if(newMaps.length)   msgs.push(`+${newMaps.length} карт`);
    toast(msgs.length ? msgs.join(' · ') : 'Всё актуально', 'ok');

    await loadAllData();
  }catch(e){ toast('Ошибка синка: ' + e.message, 'err'); console.error(e); }
}
