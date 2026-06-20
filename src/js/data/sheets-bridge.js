// @hash 6a357dfc 2026-06-20T08:48
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

// ════ ЭКСПОРТ — пишем текущие данные команды в Sheets ════
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
