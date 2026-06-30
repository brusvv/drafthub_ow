// @hash 9ba9373d 2026-06-30T05:37
// ════ SHEETS IMPORT UI — чеклист + scope-селектор + прогресс/отчёт ════
// Выделено из sheets-export.js (был 279 строк, две разные ответственности:
// экспорт и импорт-UI). Логика чтения/парсинга/записи — в sheets-import.js
// (importXFromSheets, _sheetsBatchGet). Здесь только состояние чекбоксов,
// сборка списка листов под batchGet, последовательный запуск групп и рендер
// отчёта. Вызывается из renderSheetsExportPanel() (sheets-export.js).
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, loadSheetsConfig,
//              saveSheetsConfig, _sheetsBatchGet),
//              sheets-import.js (importHeroesFromSheets, importMapsFromSheets,
//              importPlayersFromSheets, importHeroMapStrengthFromSheets,
//              importHeroSynergyFromSheets, importTiersFromSheets),
//              sheets-export.js (renderSheetsExportPanel — для перерисовки
//              после toggle/submit), session.js (isAdmin),
//              data/db-load.js (loadAllData)

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
