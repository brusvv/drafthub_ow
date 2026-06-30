// @hash 5b4dfe9d 2026-06-30T04:44
// ════ SHEETS BRIDGE — Google Sheets экспорт ════
// Отдельный OAuth-флоу: Google токен здесь используется ТОЛЬКО для записи
// в Sheets API, не связан с основной авторизацией (Supabase).
// Доступно только ролям с can_export_sheets=true.
//
// Зависимости: auth.js (_sb), session.js (currentTeam, canExportSheets)

let _sheetsTokenClient = null;
let _sheetsAccessToken = null;
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// ── Инициализация Google Identity Services для Sheets-доступа ──
// Вызывается лениво — только когда пользователь открывает вкладку экспорта
function initSheetsBridge(clientId){
  if(!window.google?.accounts?.oauth2){
    console.warn('Google Identity Services не загружен');
    return;
  }
  _sheetsTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SHEETS_SCOPE,
    callback: (resp) => {
      if(resp.error){ toast('Ошибка авторизации Google: ' + resp.error, 'err'); return; }
      _sheetsAccessToken = resp.access_token;
      toast('Google авторизован ✓', 'ok');
      renderSheetsExportPanel();
    },
  });
}

function connectGoogleForSheets(){
  if(!_sheetsTokenClient){ toast('Google API не загружен', 'err'); return; }
  _sheetsTokenClient.requestAccessToken();
}

function disconnectGoogleSheets(){
  _sheetsAccessToken = null;
  renderSheetsExportPanel();
}

// ── Привязка Sheet ID к команде (хранится в sheets_tokens) ──
async function loadSheetsConfig(){
  if(!canExportSheets()) return null;
  const { data } = await _sb.from('sheets_tokens')
    .select('sheet_id, last_sync_at')
    .eq('team_id', currentTeam().id)
    .maybeSingle();
  return data;
}

async function saveSheetsConfig(sheetId){
  if(!canExportSheets()){ toast('Нет прав на экспорт', 'err'); return; }
  await _sb.from('sheets_tokens').upsert({
    team_id: currentTeam().id,
    sheet_id: sheetId,
    last_sync_at: new Date().toISOString(),
  }, { onConflict: 'team_id' });
}

// ── Низкоуровневые вызовы Sheets API через fetch (без gapi-клиента) ──
async function _sheetsApiCall(method, sheetId, range, body){
  if(!_sheetsAccessToken) throw new Error('Сначала авторизуйся в Google');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
    + (method === 'GET' ? '' : '?valueInputOption=USER_ENTERED');
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${_sheetsAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function _sheetsClear(sheetId, range){
  return _sheetsApiCall('POST', sheetId, range + ':clear', {});
}
async function _sheetsWrite(sheetId, range, values){
  return _sheetsApiCall('PUT', sheetId, range, { values });
}

// ── batchGet — читает НЕСКОЛЬКО листов одним HTTP-запросом ──
// IMPORT-1a: используется импортом — вместо до 12 последовательных GET на
// каждую вкладку делаем один запрос с массивом ranges. Google Sheets API
// поддерживает это нативно через /values:batchGet.
// Возвращает Map<sheetName, string[][]> — только листы которые реально
// существуют и содержат данные (больше одной строки — заголовок не считается).
// Отсутствующий/пустой лист просто не попадёт в Map; вызывающий код не
// должен на это падать — пользователь мог не заполнять какие-то вкладки.
async function _sheetsBatchGet(sheetId, sheetNames){
  if(!_sheetsAccessToken) throw new Error('Сначала авторизуйся в Google');
  if(!sheetNames.length) return new Map();

  // range вида "Heroes!A:Z" на каждый лист — с запасом по колонкам
  const rangesQuery = sheetNames
    .map(name => `ranges=${encodeURIComponent(name + '!A:Z')}`)
    .join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${rangesQuery}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${_sheetsAccessToken}` },
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    // Несуществующий лист в одном из ranges валит ВЕСЬ batchGet целиком
    // (в отличие от одиночного _sheetsApiCall, где 400 ловится на конкретный
    // лист) — сообщаем явно, чтобы UI подсказал снять галку с этого пункта.
    throw new Error(err?.error?.message || `HTTP ${res.status} (проверь что все выбранные листы существуют в таблице)`);
  }
  const data = await res.json();

  const result = new Map();
  (data.valueRanges || []).forEach((vr, i) => {
    const name = sheetNames[i];
    const rows = vr.values || [];
    // rows[0] — заголовок; rows.length>1 значит есть хотя бы одна строка данных
    if(rows.length > 1) result.set(name, rows);
  });
  return result;
}

// Создаёт лист если его нет (через batchUpdate)
async function _ensureSheetTab(sheetId, title){
  const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
    headers: { 'Authorization': `Bearer ${_sheetsAccessToken}` },
  }).then(r => r.json());
  const exists = (meta.sheets || []).some(s => s.properties.title === title);
  if(exists) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${_sheetsAccessToken}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
}

// ════ ИМПОРТ — парсеры строк листов в Supabase-объекты (IMPORT-1b) ════
// Чистые функции, без сети — принимают rows (string[][], rows[0]=заголовок)
// и собирают объекты в формате готовом для UPSERT. Логика записи/scope —
// в IMPORT-1c (importXFromSheets), здесь только трансформация данных.

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


// Экспорт односторонний (Supabase → Sheets), не импорт обратно
async function exportTeamToSheets(){
  if(!canExportSheets()){ toast('Нет прав на экспорт', 'err'); return; }
  if(!_sheetsAccessToken){ toast('Сначала авторизуйся в Google', 'err'); return; }

  const config = await loadSheetsConfig();
  if(!config?.sheet_id){ toast('Укажи Sheet ID для экспорта', 'err'); return; }
  const sheetId = config.sheet_id;

  try{
    toast('Экспорт начат...', 'ok');

    // ── Heroes ──
    await _ensureSheetTab(sheetId, 'Heroes');
    const heroRows = [
      ['name','role','subrole','priority','banned','notes','counters'],
      ...heroes.map(h => [
        h.name, h.role, h.subrole, h.priority, h.banned ? 'TRUE':'FALSE', h.notes,
        (h.counters||[]).map(c => `${c.name}:${c.score}`).join(','),
      ]),
    ];
    await _sheetsClear(sheetId, 'Heroes!A:Z');
    await _sheetsWrite(sheetId, `Heroes!A1:G${heroRows.length}`, heroRows);

    // ── Maps ──
    await _ensureSheetTab(sheetId, 'Maps');
    const mapRows = [
      ['name','type','tier','priority','atk','def','dif','notes','in_pool'],
      ...maps.map(m => [m.name,m.type,m.tier,m.priority,m.atk,m.def,m.dif,m.notes, m.inPool?'TRUE':'FALSE']),
    ];
    await _sheetsClear(sheetId, 'Maps!A:Z');
    await _sheetsWrite(sheetId, `Maps!A1:I${mapRows.length}`, mapRows);

    // ── Players ──
    await _ensureSheetTab(sheetId, 'Players');
    const playerRows = [
      ['name','btag','main_role','off_role','rank_tank','rank_dmg','rank_sup','main_heroes','pool_heroes'],
      ...players.map(p => [p.name,p.btag,p.mainRole,p.offRole,p.rankTank,p.rankDmg,p.rankSup,
        (p.mainHeroes||[]).join(';'), (p.poolHeroes||[]).join(';')]),
    ];
    await _sheetsClear(sheetId, 'Players!A:Z');
    await _sheetsWrite(sheetId, `Players!A1:I${playerRows.length}`, playerRows);

    // ── HeroMapStrength ──
    await _ensureSheetTab(sheetId, 'HeroMapStrength');
    const hmsRows = [['hero','map','atk','def']];
    Object.entries(heroMapStrength).forEach(([hero, byMap]) => {
      Object.entries(byMap).forEach(([map, v]) => hmsRows.push([hero, map, v.atk, v.def]));
    });
    await _sheetsClear(sheetId, 'HeroMapStrength!A:Z');
    await _sheetsWrite(sheetId, `HeroMapStrength!A1:D${hmsRows.length}`, hmsRows);

    // ── HeroSynergy ──
    await _ensureSheetTab(sheetId, 'HeroSynergy');
    const synRows = [['hero','synergy_hero','score']];
    Object.entries(heroSynergy).forEach(([hero, list]) => {
      list.forEach(s => synRows.push([hero, s.name, s.score]));
    });
    await _sheetsClear(sheetId, 'HeroSynergy!A:Z');
    await _sheetsWrite(sheetId, `HeroSynergy!A1:C${synRows.length}`, synRows);

    await saveSheetsConfig(sheetId);
    toast('Экспорт завершён ✓', 'ok');
    renderSheetsExportPanel();
  }catch(e){
    toast('Ошибка экспорта: ' + e.message, 'err'); console.error(e);
  }
}

// ── UI панель экспорта (вызывается из вкладки настроек) ──
async function renderSheetsExportPanel(){
  const el = document.getElementById('sheetsExportPanel'); if(!el) return;
  if(!canExportSheets()){
    el.innerHTML = '<div class="empty">Нет прав на экспорт</div>'; return;
  }
  const config = await loadSheetsConfig();
  el.innerHTML = `
    <div class="role-card">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Экспорт в Google Sheets</div>
      <p style="font-size:11px;color:var(--text3);margin-bottom:12px">
        Текущие данные команды (герои, карты, игроки, силы, синергии) будут записаны
        в указанную Google-таблицу. Импорт обратно не выполняется — это снимок для отчётности.
      </p>
      <div class="form-group">
        <label class="form-label">Google Sheet ID</label>
        <input class="form-input" id="exportSheetId" placeholder="1aBcD..." value="${config?.sheet_id||''}">
      </div>
      ${!_sheetsAccessToken
        ? `<button class="btn btn-primary" onclick="connectGoogleForSheets()">Подключить Google</button>`
        : `<div style="display:flex;gap:8px">
             <button class="btn btn-primary" onclick="_submitExport()">Экспортировать сейчас</button>
             <button class="btn" onclick="disconnectGoogleSheets()">Отключить Google</button>
           </div>`}
      ${config?.last_sync_at ? `<div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:8px">
        Последний экспорт: ${new Date(config.last_sync_at).toLocaleString('ru-RU')}</div>` : ''}
    </div>`;
}

async function _submitExport(){
  const sheetId = document.getElementById('exportSheetId')?.value.trim();
  if(!sheetId){ toast('Укажи Sheet ID', 'err'); return; }
  await saveSheetsConfig(sheetId);
  await exportTeamToSheets();
}
