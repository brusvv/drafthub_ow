// @hash fdf67067 2026-06-30T04:58
// ════ SHEETS IMPORT — Google Sheets → Supabase ════
// IMPORT-1a/1b/1c: чтение листов через _sheetsBatchGet (sheets-auth.js),
// парсинг строк в объекты, запись в Supabase через UPSERT.
// UI-обвязка (выбор типа импорта, превью, кнопка запуска) — отдельно,
// в render/render-admin-import.js (Фаза 7 admin-панель).
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, _sheetsBatchGet),
//              auth.js (_sb), session.js (currentUser, isAdmin, canWrite),
//              data/db-write.js (createTierSet, activeTierSetId)

// ════ ПАРСЕРЫ — строки листов в Supabase-объекты (IMPORT-1b) ════
// Чистые функции, без сети — принимают rows (string[][], rows[0]=заголовок)
// и собирают объекты в формате готовом для UPSERT. Логика записи/scope —
// в функциях importXFromSheets ниже, здесь только трансформация данных.

// "Ana:8,Baptiste:7" → [{name:'Ana',score:8},{name:'Baptiste',score:7}]
// Пустая строка/мусор в одном элементе не валит весь парсинг — просто
// пропускается (toString().trim() защищает от undefined ячеек).
function _parseCounters(str){
  if(!str) return [];
  return String(str).split(',')
    .map(s => s.trim()).filter(Boolean)
    .map(pair => {
      const [name, scoreRaw] = pair.split(':').map(x => x?.trim());
      const score = parseInt(scoreRaw, 10);
      // Без числового score после ':' запись считаем мусором/опечаткой,
      // не угадываем дефолт — реальные данные всегда "Name:score"
      return (name && Number.isFinite(score)) ? { name, score } : null;
    })
    .filter(Boolean);
}

// 'TRUE'/'true'/'1' → true, всё остальное (включая пусто) → false
function _parseBoolTrue(str){
  const s = String(str || '').trim().toLowerCase();
  return s === 'true' || s === '1';
}

// "Tracer;Genji;Ana" → ['Tracer','Genji','Ana']  (для PlayerHeroes, если
// где-то понадобится строка вместо отдельных строк-листа — сейчас не
// используется т.к. PlayerHeroes хранит по одной паре player/hero на строку,
// но оставляю как общий хелпер для согласованности с экспортным форматом)
function _parseSemicolonList(str){
  if(!str) return [];
  return String(str).split(';').map(s => s.trim()).filter(Boolean);
}

// rows (string[][], rows[0]=header) → [{col1:val1,col2:val2,...}, ...]
// Header матчится по позиции по ожидаемому списку колонок (case-insensitive,
// trim) — НЕ полагаемся на точный порядок колонок в реальном листе, мапим
// по имени, если порядок в боевой таблице вдруг отличается от REQUIRED_SHEETS.
function _rowsToObjects(rows, expectedCols){
  if(!rows || rows.length < 2) return [];
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const colIdx = {};
  expectedCols.forEach(col => {
    const idx = header.indexOf(col.toLowerCase());
    colIdx[col] = idx;   // -1 если колонки нет в листе — поле останется undefined
  });
  return rows.slice(1)
    .filter(r => r.some(cell => String(cell || '').trim()))   // пропускаем полностью пустые строки
    .map(r => {
      const obj = {};
      expectedCols.forEach(col => { obj[col] = colIdx[col] >= 0 ? r[colIdx[col]] : undefined; });
      return obj;
    });
}

// ── Сборка Maps из 5 листов: Maps + MapPreferred + MapBans + Compositions + MapCounters ──
// Принимает Map<sheetName,rows> от _sheetsBatchGet — листы которых нет в Map
// (пользователь не выбрал/лист пуст) просто дают пустые join-данные, базовая
// карта всё равно соберётся из Maps.
function _assembleMapsFromSheets(sheetsMap){
  const mapsRows = sheetsMap.get('Maps');
  if(!mapsRows) return [];

  const base = _rowsToObjects(mapsRows,
    ['name','type','tier','priority','atk','def','dif','notes','inpool']);

  // join-листы группируем по имени карты заранее — O(n) вместо O(n*m) перебора
  const groupByMap = (sheetName, cols) => {
    const rows = sheetsMap.get(sheetName);
    const grouped = {};
    if(!rows) return grouped;
    _rowsToObjects(rows, cols).forEach(r => {
      const key = r.map;
      if(!key) return;
      (grouped[key] ??= []).push(r);
    });
    return grouped;
  };

  const preferred = groupByMap('MapPreferred', ['map','hero']);
  const bans      = groupByMap('MapBans',      ['map','hero']);
  const comp      = groupByMap('Compositions', ['map','hero','role','playerRole']);
  const counters  = groupByMap('MapCounters',  ['map','hero']);

  return base.map(m => ({
    name:     m.name,
    type:     m.type,
    tier:     m.tier || 'B',
    priority: parseInt(m.priority, 10) || 5,
    atk:      parseInt(m.atk, 10) || 3,
    def:      parseInt(m.def, 10) || 3,
    dif:      parseInt(m.dif, 10) || 3,
    notes:    m.notes || '',
    in_pool:  m.inpool === undefined ? true : _parseBoolTrue(m.inpool),
    preferred_heroes: (preferred[m.name] || []).map(r => r.hero).filter(Boolean),
    ban_heroes:       (bans[m.name]      || []).map(r => r.hero).filter(Boolean),
    counters:         (counters[m.name]  || []).map(r => r.hero).filter(Boolean),
    comp: (comp[m.name] || []).map(r => ({
      hero: r.hero, role: r.role || '', playerRole: r.playerRole || r.role || '',
    })).filter(c => c.hero),
  })).filter(m => m.name && m.type);
}

// ── Сборка Players из 2 листов: Players + PlayerHeroes ──
// PlayerHeroes.type: 'main' → основная роль (main_heroes), 'pool' → офф-роль
// (pool_heroes) — подтверждено пользователем явно, не угадано.
function _assemblePlayersFromSheets(sheetsMap){
  const playersRows = sheetsMap.get('Players');
  if(!playersRows) return [];

  const base = _rowsToObjects(playersRows,
    ['name','btag','mainrole','offrole','ranktank','rankdmg','ranksup','notes']);

  const heroesByPlayer = {};   // { playerName: { main:[...], pool:[...] } }
  const phRows = sheetsMap.get('PlayerHeroes');
  if(phRows){
    _rowsToObjects(phRows, ['player','hero','type']).forEach(r => {
      if(!r.player || !r.hero) return;
      const entry = (heroesByPlayer[r.player] ??= { main: [], pool: [] });
      const type = String(r.type || '').trim().toLowerCase();
      if(type === 'main') entry.main.push(r.hero);
      else if(type === 'pool') entry.pool.push(r.hero);
      // неизвестный type — молча пропускаем (не падаем на грязных данных)
    });
  }

  return base.map(p => {
    const h = heroesByPlayer[p.name] || { main: [], pool: [] };
    return {
      name:      p.name,
      btag:      p.btag || '',
      main_role: p.mainrole || '',
      off_role:  p.offrole || '',
      rank_tank: p.ranktank || '',
      rank_dmg:  p.rankdmg || '',
      rank_sup:  p.ranksup || '',
      notes:     p.notes || '',
      main_heroes: h.main,
      pool_heroes: h.pool,
    };
  }).filter(p => p.name);
}

// ════ ИМПОРТ — запись в Supabase через UPSERT (IMPORT-1c) ════
// Каждая функция независима: вызывающий код (UI в render-admin-import.js)
// оборачивает каждую в try/catch и копит {imported,skipped,errors} — одна
// упавшая группа не должна блокировать остальные пять.
// onConflict использует существующие UNIQUE/PK из 001_tables.sql —
// никаких изменений схемы не требуется.

async function importHeroesFromSheets(sheetsMap){
  const rows = sheetsMap.get('Heroes');
  if(!rows) return { count: 0 };

  const heroObjs = _rowsToObjects(rows,
    ['name','role','subrole','priority','banned','notes','counters']);

  const upsertRows = heroObjs.filter(h => h.name && h.role).map(h => ({
    team_id:  _teamId(),
    name:     h.name,
    role:     h.role,
    subrole:  h.subrole || '',
    priority: parseInt(h.priority, 10) || 5,
    banned:   _parseBoolTrue(h.banned),
    notes:    h.notes || '',
    counters: _parseCounters(h.counters),
  }));
  if(!upsertRows.length) return { count: 0 };

  const { error } = await _sb.from('heroes')
    .upsert(upsertRows, { onConflict: 'team_id,name' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importMapsFromSheets(sheetsMap){
  const assembled = _assembleMapsFromSheets(sheetsMap);
  if(!assembled.length) return { count: 0 };

  const upsertRows = assembled.map(m => ({ ...m, team_id: _teamId() }));

  const { error } = await _sb.from('maps')
    .upsert(upsertRows, { onConflict: 'team_id,name' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importPlayersFromSheets(sheetsMap){
  const assembled = _assemblePlayersFromSheets(sheetsMap);
  if(!assembled.length) return { count: 0 };

  const upsertRows = assembled.map(p => ({ ...p, team_id: _teamId() }));

  const { error } = await _sb.from('players')
    .upsert(upsertRows, { onConflict: 'team_id,name' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importHeroMapStrengthFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroMapStrength');
  if(!rows) return { count: 0 };

  const objs = _rowsToObjects(rows, ['hero','map','atk','def']);
  const upsertRows = objs.filter(r => r.hero && r.map).map(r => ({
    team_id:   _teamId(),
    hero_name: r.hero,
    map_name:  r.map,
    atk:       parseInt(r.atk, 10) || 0,
    def:       parseInt(r.def, 10) || 0,
  }));
  if(!upsertRows.length) return { count: 0 };

  // composite PK (team_id,hero_name,map_name) — см. 001_tables.sql
  const { error } = await _sb.from('hero_map_strength')
    .upsert(upsertRows, { onConflict: 'team_id,hero_name,map_name' });
  if(error) throw error;
  return { count: upsertRows.length };
}

async function importHeroSynergyFromSheets(sheetsMap){
  const rows = sheetsMap.get('HeroSynergy');
  if(!rows) return { count: 0 };

  const objs = _rowsToObjects(rows, ['hero','synergy_hero','score']);
  const upsertRows = objs.filter(r => r.hero && r.synergy_hero).map(r => ({
    team_id:      _teamId(),
    hero_name:    r.hero,
    synergy_hero: r.synergy_hero,
    score:        parseInt(r.score, 10) || 5,
  }));
  if(!upsertRows.length) return { count: 0 };

  const { error } = await _sb.from('hero_synergy')
    .upsert(upsertRows, { onConflict: 'team_id,hero_name,synergy_hero' });
  if(error) throw error;
  return { count: upsertRows.length };
}

// ── Тир-листы — TierMaps/TierHeroes, с выбором scope ──
// scope: 'team' | 'personal' | 'global' — решение пользователя в UI.
// 'global' доступен только если isAdmin() — это же проверяется в UI (radio
// скрыт/disabled), здесь дублируем проверку на случай прямого вызова.
//
// position берём из порядка строк в листе (индекс внутри каждого тира) —
// тот же принцип что в _tierObjToRows для drag&drop сохранения.
async function importTiersFromSheets(sheetsMap, entityType, scope){
  const sheetName = entityType === 'map' ? 'TierMaps' : 'TierHeroes';
  const rows = sheetsMap.get(sheetName);
  if(!rows) return { count: 0 };

  if(scope === 'global' && !isAdmin()){
    throw new Error('Глобальный тир-лист может импортировать только администратор');
  }
  if(scope !== 'global' && !canWrite()){
    throw new Error('Нет прав на запись командного/личного тир-листа');
  }

  const objs = _rowsToObjects(rows, ['name','tier']);

  // position — порядковый номер ВНУТРИ каждого тира, не глобальный индекс
  // строки в листе (иначе сортировка S/A/B/C/D вперемешку даст неверный
  // порядок отображения — ровно так же считает _tierObjToRows на фронте).
  const posCounters = {};
  const baseRows = objs.filter(r => r.name && r.tier).map(r => {
    const tier = r.tier.toUpperCase();
    if(!(tier in posCounters)) posCounters[tier] = 0;
    const position = posCounters[tier]++;
    return { entity_type: entityType, name: r.name, tier, position };
  });
  if(!baseRows.length) return { count: 0 };

  if(scope === 'global'){
    const { error } = await _sb.from('global_tier_data')
      .upsert(baseRows, { onConflict: 'entity_type,name' });
    if(error) throw error;
    return { count: baseRows.length };
  }

  const isPersonal = scope === 'personal';
  // Личный тир-лист требует активного tier_set_id — создаём «Импортировано»
  // если у пользователя ещё нет ни одного личного сета в этой команде.
  let tierSetId = null;
  if(isPersonal){
    tierSetId = activeTierSetId;
    if(!tierSetId){
      const created = await createTierSet('Импортировано');
      tierSetId = created?.id ?? null;
      if(!tierSetId) throw new Error('Не удалось создать личный тир-сет для импорта');
    }
  }

  const upsertRows = baseRows.map(r => ({
    ...r,
    team_id:     _teamId(),
    scope:       isPersonal ? 'personal' : 'team',
    user_id:     isPersonal ? currentUser().id : null,
    tier_set_id: isPersonal ? tierSetId : null,
  }));

  // Delete-then-insert как в saveTierOrder — у tier_data нет единого
  // uniq-индекса покрывающего оба scope сразу (idx_tier_team_unique и
  // idx_tier_personal_unique частичные), проще и надёжнее снести старые
  // записи этого entity_type+scope перед вставкой новых, чем городить UPSERT
  // с разным onConflict в зависимости от scope.
  let delQuery = _sb.from('tier_data').delete()
    .eq('team_id', _teamId()).eq('entity_type', entityType).eq('scope', isPersonal ? 'personal' : 'team');
  if(isPersonal) delQuery = delQuery.eq('user_id', currentUser().id).eq('tier_set_id', tierSetId);
  const { error: delErr } = await delQuery;
  if(delErr) throw delErr;

  const { error: insErr } = await _sb.from('tier_data').insert(upsertRows);
  if(insErr) throw insErr;
  return { count: upsertRows.length };
}
