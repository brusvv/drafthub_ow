// @hash 34c4a234 2026-07-12T04:59
// ════ GOOGLE SHEETS — SHELL ПАНЕЛИ В НАСТРОЙКАХ (SETTINGS-1) ════
// Вкладка Настройки → «Google Sheets» (auth/ui.js, _renderSettingsTabContent,
// ключ 'sheets') показывает один контейнер #sheetsExportPanel, который
// заполняет renderGoogleSheetsPanel() — точка входа этого файла.
//
// Раньше было: одна общая Sheet ID-строка визуально привязанная только к
// экспорту (хотя нужна и импорту), плюс две отдельные карточки одна под
// другой. Теперь — один блок: заголовок + общее поле Sheet ID (рендерится
// здесь один раз) + под-переключатель пилюлями [Импорт]/[Экспорт]
// (тот же `.f-btn`, что и в `_renderSettingsTabContent`) + тело конкретного
// под-таба, которое отдают sheets-export.js/sheets-import-ui.js — этот файл
// сам бизнес-логику экспорта/импорта не трогает, только компонует разметку.
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, loadSheetsConfig,
//              connectGoogleForSheets, disconnectGoogleSheets),
//              sheets-export.js (_renderExportSubTab),
//              sheets-import-ui.js (_renderImportSection),
//              session.js (canExportSheets)

// Под-таб живёт между перерисовками — чисто UI-состояние, не store
// (как и _importChecked/_importScope в sheets-import-ui.js).
let _sheetsSubTab = 'import'; // 'import' | 'export'

async function renderGoogleSheetsPanel(){
  const el = document.getElementById('sheetsExportPanel'); if(!el) return;
  if(!canExportSheets()){
    el.innerHTML = '<div class="empty">Нет прав на работу с Google Sheets</div>'; return;
  }

  const config = await loadSheetsConfig();

  // Не авторизован в Google — только кнопка подключения, без под-табов и без
  // Sheet ID (вводить таблицу до подключения аккаунта бессмысленно).
  if(!_sheetsAccessToken){
    el.innerHTML = `
      <div class="role-card">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">Google Sheets</div>
        <p style="font-size:11px;color:var(--text3);margin-bottom:12px">
          Подключи Google-аккаунт чтобы экспортировать данные команды в таблицу
          или импортировать их обратно из старой Sheets-схемы.
        </p>
        <button class="btn btn-primary" onclick="connectGoogleForSheets()">Подключить Google</button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="role-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Google Sheets</div>
        <button class="btn fs-10" onclick="disconnectGoogleSheets()">Отключить Google</button>
      </div>

      <div class="form-group mb-12">
        <label class="form-label">Google Sheet ID</label>
        <input class="form-input" id="sheetsConfigId" placeholder="1aBcD..." value="${config?.sheet_id||''}"
               onchange="_saveSheetsConfigId(this.value)">
      </div>

      <div class="filters" style="margin-bottom:14px">
        <button class="f-btn${_sheetsSubTab==='import'?' active':''}" onclick="_switchSheetsSubTab('import')">Импорт</button>
        <button class="f-btn${_sheetsSubTab==='export'?' active':''}" onclick="_switchSheetsSubTab('export')">Экспорт</button>
      </div>

      <div id="sheetsSubTabBody">
        ${_sheetsSubTab==='import' ? _renderImportSection() : _renderExportSubTab(config)}
      </div>
    </div>`;
}

function _switchSheetsSubTab(tab){
  _sheetsSubTab = tab;
  renderGoogleSheetsPanel();
}

// ════ FIX (SETTINGS-1 regression): #sheetsConfigId раньше не имел onchange —
// набранный Sheet ID никуда не сохранялся. _submitImport()/exportTeamToSheets()
// читают sheet_id через loadSheetsConfig() из БД, поэтому без сохранения тут
// импорт/экспорт всегда видели пустой sheet_id и падали на "Укажи Sheet ID"
// даже когда поле визуально было заполнено.
// Сохраняем сразу на blur/onchange, без перерисовки всей панели (чтобы не
// сбрасывать фокус) — следующий клик на "Импортировать"/"Экспортировать"
// увидит уже сохранённое значение через loadSheetsConfig().
async function _saveSheetsConfigId(value){
  const id = (value||'').trim();
  if(!id) return;
  await saveSheetsConfig(id);
}
