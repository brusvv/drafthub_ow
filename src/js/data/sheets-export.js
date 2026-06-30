// @hash 8fc849af 2026-06-30T05:11
// ════ SHEETS EXPORT — Supabase → Google Sheets (один в одну сторону) ════
// Экспорт односторонний, не импорт обратно — снимок текущих данных команды
// для отчётности. UI вызывается из вкладки Настройки → Sheets экспорт
// (auth/ui.js, _renderSettingsTabContent).
//
// IMPORT-1d/1e (поток Б): чеклист + scope-селектор + прогресс/отчёт для
// импорта из старой Sheets-схемы — логика чтения/парсинга/записи в
// sheets-import.js (importXFromSheets, _sheetsBatchGet), здесь только UI.
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, _ensureSheetTab,
//              _sheetsClear, _sheetsWrite, _sheetsBatchGet, loadSheetsConfig,
//              saveSheetsConfig, connectGoogleForSheets, disconnectGoogleSheets),
//              sheets-import.js (importHeroesFromSheets, importMapsFromSheets,
//              importPlayersFromSheets, importHeroMapStrengthFromSheets,
//              importHeroSynergyFromSheets, importTiersFromSheets),
//              session.js (canExportSheets, isAdmin), data/db-load.js (heroes,
//              maps, players, heroMapStrength, heroSynergy, loadAllData)

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

// ── UI панель экспорта (вызывается из вкладки настроек, auth/ui.js) ──
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
    </div>
    ${_sheetsAccessToken ? _renderImportSection() : ''}`;
}

async function _submitExport(){
  const sheetId = document.getElementById('exportSheetId')?.value.trim();
  if(!sheetId){ toast('Укажи Sheet ID', 'err'); return; }
  await saveSheetsConfig(sheetId);
  await exportTeamToSheets();
}

// ════ IMPORT-1d/1e — UI чеклиста + scope-селектора + прогресс/отчёт ════
// Логика чтения/парсинга/записи — в sheets-import.js (importXFromSheets,
// _sheetsBatchGet). Здесь только состояние чекбоксов, сборка списка листов
// под batchGet, последовательный запуск групп и рендер отчёта.

// Группы импорта: какие листы читать и какую функцию вызвать на каждую.
// entityType — для тир-групп, см. importTiersFromSheets(sheetsMap, entityType, scope).
const _IMPORT_GROUPS = [
  { key:'heroes',     label:'Героев',                    sheets:['Heroes'],
    run: sm => importHeroesFromSheets(sm) },
  { key:'maps',       label:'Карты (5 листов)',           sheets:['Maps','MapPreferred','MapBans','Compositions','MapCounters'],
    run: sm => importMapsFromSheets(sm) },
  { key:'players',    label:'Игроков (2 листа)',          sheets:['Players','PlayerHeroes'],
    run: sm => importPlayersFromSheets(sm) },
  { key:'hms',        label:'Силу героев на картах',      sheets:['HeroMapStrength'],
    run: sm => importHeroMapStrengthFromSheets(sm) },
  { key:'synergy',    label:'Синергии',                   sheets:['HeroSynergy'],
    run: sm => importHeroSynergyFromSheets(sm) },
  { key:'tierMaps',   label:'Тир-лист карт',               sheets:['TierMaps'],   isTier:true,
    run: (sm, scope) => importTiersFromSheets(sm, 'map', scope) },
  { key:'tierHeroes', label:'Тир-лист героев',             sheets:['TierHeroes'], isTier:true,
    run: (sm, scope) => importTiersFromSheets(sm, 'hero', scope) },
];

// Состояние чекбоксов/scope живёт между перерисовками панели —
// модульная переменная, не store (чисто UI-состояние формы импорта).
let _importChecked = Object.fromEntries(_IMPORT_GROUPS.map(g => [g.key, true]));
let _importScope = 'team';   // 'team' | 'personal' | 'global'
let _importLastReport = null;   // {imported:[], skipped:[], errors:[]} | null

function _renderImportSection(){
  const hasTierSelected = _importChecked.tierMaps || _importChecked.tierHeroes;
  const adminAllowed = typeof isAdmin === 'function' && isAdmin();

  const checklistHtml = _IMPORT_GROUPS.map(g => `
    <label style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;cursor:pointer">
      <input type="checkbox" ${_importChecked[g.key]?'checked':''} onchange="_toggleImportGroup('${g.key}',this.checked)">
      ${g.label}
    </label>`).join('');

  const scopeHtml = hasTierSelected ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Куда импортировать тир-листы:</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
          <input type="radio" name="importScope" value="team" ${_importScope==='team'?'checked':''} onchange="_setImportScope('team')">
          Команда
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
          <input type="radio" name="importScope" value="personal" ${_importScope==='personal'?'checked':''} onchange="_setImportScope('personal')">
          Личный
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:${adminAllowed?'pointer':'not-allowed'}"
               ${adminAllowed?'':'title="Только для администраторов"'}>
          <input type="radio" name="importScope" value="global" ${_importScope==='global'?'checked':''}
                 ${adminAllowed?'':'disabled'} onchange="_setImportScope('global')">
          Глобальный
        </label>
      </div>
    </div>` : '';

  const reportHtml = _importLastReport ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-family:var(--mono);font-size:11px">
      ${_importLastReport.imported.map(r => `<div style="color:var(--support)">✓ ${r.label}: ${r.count}</div>`).join('')}
      ${_importLastReport.skipped.map(r => `<div style="color:var(--text3)">– ${r.label}: пусто, пропущено</div>`).join('')}
      ${_importLastReport.errors.map(r => `<div style="color:var(--damage)">✗ ${r.label}: ${esc(r.message)}</div>`).join('')}
    </div>` : '';

  return `
    <div class="role-card" style="margin-top:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">Импорт из Google Sheets</div>
      <p style="font-size:11px;color:var(--text3);margin-bottom:10px">
        Старая Sheets-схема (12 вкладок). Запись — UPSERT по имени, существующие
        записи с тем же именем обновятся, не дублируются. Полная перезапись не выполняется.
      </p>
      ${checklistHtml}
      ${scopeHtml}
      <button class="btn btn-primary" style="margin-top:12px" onclick="_submitImport()" id="importRunBtn">
        Импортировать выбранное
      </button>
      ${reportHtml}
    </div>`;
}

function _toggleImportGroup(key, checked){
  _importChecked[key] = checked;
  renderSheetsExportPanel();
}

function _setImportScope(scope){
  _importScope = scope;
  renderSheetsExportPanel();
}

async function _submitImport(){
  if(!_sheetsAccessToken){ toast('Сначала авторизуйся в Google', 'err'); return; }
  const config = await loadSheetsConfig();
  if(!config?.sheet_id){ toast('Укажи Sheet ID', 'err'); return; }

  const selected = _IMPORT_GROUPS.filter(g => _importChecked[g.key]);
  if(!selected.length){ toast('Выбери хотя бы одну группу для импорта', 'err'); return; }

  if(!confirm(
    'Импортировать выбранные данные из Google Sheets?\n\n' +
    'Запись идёт через UPSERT — существующие записи с совпадающим именем ' +
    'будут обновлены текущими значениями из таблицы, не дублированы. ' +
    'Это не отменяется автоматически.'
  )) return;

  const btn = document.getElementById('importRunBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Импорт...'; }

  // Один batchGet на все нужные листы сразу (IMPORT-1a) — экономит вызовы API
  // даже если несколько групп используют один и тот же лист (Maps и т.д. не
  // дублируются благодаря Set).
  const sheetNames = [...new Set(selected.flatMap(g => g.sheets))];

  const report = { imported: [], skipped: [], errors: [] };

  try{
    const sheetsMap = await _sheetsBatchGet(config.sheet_id, sheetNames);

    // Последовательно — не Promise.all: проще показать прогресс и каждая
    // группа независима (одна упавшая не должна прервать остальные).
    for(const g of selected){
      try{
        const result = await g.run(sheetsMap, _importScope);
        if(result.count > 0) report.imported.push({ label:g.label, count:result.count });
        else report.skipped.push({ label:g.label });
      }catch(e){
        report.errors.push({ label:g.label, message:e.message });
      }
    }

    await saveSheetsConfig(config.sheet_id);
  }catch(e){
    // _sheetsBatchGet сам упал (auth/network) — ни одна группа не выполнилась
    toast('Ошибка чтения таблицы: ' + e.message, 'err');
    if(btn){ btn.disabled = false; btn.textContent = 'Импортировать выбранное'; }
    return;
  }

  _importLastReport = report;
  const total = report.imported.reduce((s,r) => s+r.count, 0);
  toast(
    report.errors.length
      ? `Импорт завершён с ошибками: ${total} записей, ${report.errors.length} групп с ошибкой`
      : `Импорт завершён ✓ (${total} записей)`,
    report.errors.length ? 'err' : 'ok'
  );

  // Перечитываем данные команды чтобы UI сразу показал импортированное
  if(typeof loadAllData === 'function') await loadAllData();
  renderSheetsExportPanel();
}
