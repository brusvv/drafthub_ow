// @hash 4bf5cb06 2026-06-30T04:58
// ════ SHEETS AUTH — Google OAuth + низкоуровневые вызовы Sheets API ════
// Отдельный OAuth-флоу: Google токен здесь используется ТОЛЬКО для доступа
// к Sheets API (импорт И экспорт), не связан с основной авторизацией
// (Supabase). Доступно только ролям с can_export_sheets=true.
//
// Это базовый файл — sheets-import.js и sheets-export.js используют
// _sheetsAccessToken/_sheetsApiCall/_sheetsBatchGet/_sheetsClear/_sheetsWrite
// из этого файла напрямую (общий module-level scope, без window.*).
//
// Зависимости: auth.js (_sb), session.js (currentTeam, canExportSheets)

let _sheetsTokenClient = null;
let _sheetsAccessToken = null;
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// ── Инициализация Google Identity Services для Sheets-доступа ──
// Вызывается лениво — только когда пользователь открывает вкладку экспорта/импорта
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
  const ranges = sheetNames.map(n => `${n}!A:Z`);
  const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${_sheetsAccessToken}` },
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();

  const result = new Map();
  (data.valueRanges || []).forEach((vr, i) => {
    const rows = vr.values;
    if(rows && rows.length > 1) result.set(sheetNames[i], rows);
  });
  return result;
}

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
