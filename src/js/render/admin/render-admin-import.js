// @hash 49ba1729 2026-07-18T04:03
// ════ ADMIN IMPORT — CSV импорт данных в Supabase ════
// Зависимости: session.js (currentTeam, currentUser),
//              render-admin-ui.js (_loadAdminTeams)

// ── Главный рендер вкладки ──
function _renderImportTab(el) {
  el.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">Импорт данных из CSV</div>
      <p class="admin-desc">
        CSV должен содержать заголовки. Импорт идемпотентный — повторный запуск обновит данные без дублей.
        Выбери команду и тип данных, затем загрузи файл.
      </p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <select class="form-select" id="adminImportTeam" style="min-width:180px;font-size:12px">
          <option value="">— Выбери команду —</option>
        </select>
        <select class="form-select" id="adminImportType" style="min-width:160px;font-size:12px"
          onchange="_onImportTypeChange()">
          <option value="heroes">Герои (Heroes)</option>
          <option value="maps">Карты (Maps)</option>
          <option value="players">Игроки (Players)</option>
          <option value="hero_map_strength">Сила героев на картах</option>
          <option value="hero_synergy">Синергии героев</option>
          <option value="global_tiers">Глобальный тир-лист</option>
        </select>
      </div>

      <div class="admin-csv-hint" id="adminCsvHint"></div>

      <div class="mb-12">
        <label class="admin-file-label">
          <input type="file" id="adminCsvFile" accept=".csv" onchange="_onCsvFileSelected(this)"
            style="display:none">
          <span class="btn">
            📂 Выбрать CSV файл
          </span>
          <span id="adminCsvFileName" style="font-size:11px;color:var(--text3);margin-left:8px">Файл не выбран</span>
        </label>
      </div>

      <div id="adminCsvPreview" class="mb-12"></div>

      <button class="btn btn-primary" id="adminImportBtn" onclick="_submitCsvImport()"
        style="display:none;font-size:12px">
        ▶ Импортировать
      </button>

      <div id="adminImportLog" class="mt-12"></div>
    </div>`;

  // Заполняем список команд
  _loadAdminTeams().then(teams => {
    const sel = document.getElementById('adminImportTeam');
    if(!sel) return;
    teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      sel.appendChild(opt);
    });
    // Предвыбираем текущую команду
    if(currentTeam()?.id) sel.value = currentTeam().id;
  });

  _onImportTypeChange();
}

// ── Подсказки по формату CSV ──
const _CSV_HINTS = {
  heroes: `Обязательная колонка: <b>name</b> (должно совпадать с именем в каталоге игры)<br>
    Опциональные: priority (1-10), banned (TRUE/FALSE), notes,
    counters (<code>Hero:score,Hero:score</code>)<br>
    <span class="text-3">role/subrole больше не читаются — это факт каталога, не команды</span>`,
  maps: `Обязательная колонка: <b>name</b> (должно совпадать с именем в каталоге игры)<br>
    Опциональные: tier (S/A/B/C/D), priority, atk, def, dif (1-5), notes<br>
    <span class="text-3">type/in_pool больше не читаются — это факт каталога, не команды</span>`,
  players: `Обязательные: <b>name, main_role</b><br>
    Опциональные: btag, off_role, rank_tank, rank_dmg, rank_sup, notes`,
  hero_map_strength: `Обязательные: <b>hero_name, map_name, atk</b> (0-10)<br>
    Опциональные: def (0-10, если нет — равно atk)<br>
    <span class="text-3">имена резолвятся в каталог — опечатка = строка пропущена, не ошибка</span>`,
  hero_synergy: `Обязательные: <b>hero_name, synergy_hero, score</b> (1-10)<br>
    <span class="text-3">имена резолвятся в каталог — опечатка = строка пропущена, не ошибка</span>`,
  global_tiers: `Обязательные: <b>entity_type</b> (map/hero), <b>name, tier</b> (S/A/B/C/D)<br>
    Не требует команды — обновляет глобальный тир-лист`,
};

function _onImportTypeChange() {
  const type = document.getElementById('adminImportType')?.value;
  const hint = document.getElementById('adminCsvHint');
  if(hint && type) hint.innerHTML = `<div class="admin-hint">${_CSV_HINTS[type] || ''}</div>`;
}

// ── Парсинг CSV ──
let _csvParsed = null;

function _onCsvFileSelected(input) {
  const file = input.files[0];
  if(!file) return;
  document.getElementById('adminCsvFileName').textContent = file.name;
  document.getElementById('adminCsvPreview').innerHTML = '';
  document.getElementById('adminImportBtn').style.display = 'none';
  _csvParsed = null;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      _csvParsed = _parseCsv(e.target.result);
      _renderCsvPreview(_csvParsed);
    } catch(err) {
      document.getElementById('adminCsvPreview').innerHTML =
        `<div class="admin-error">Ошибка парсинга: ${escAttr(err.message)}</div>`;
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function _parseCsv(text) {
  text = text.replace(/^\uFEFF/, ''); // убираем BOM
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if(lines.length < 2) throw new Error('CSV пустой или содержит только заголовок');

  const headers = _parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1)
    .map(line => {
      const vals = _parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => obj[h] = (vals[i] ?? '').trim());
      return obj;
    })
    .filter(r => Object.values(r).some(v => v)); // убираем пустые строки

  return { headers, rows };
}

function _parseCsvLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for(let i = 0; i < line.length; i++) {
    const ch = line[i];
    if(ch === '"') { inQ = !inQ; continue; }
    if(ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function _renderCsvPreview(parsed) {
  const { headers, rows } = parsed;
  const preview = rows.slice(0, 5);
  document.getElementById('adminCsvPreview').innerHTML = `
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px">
      Найдено строк: <b>${rows.length}</b> · Колонки: ${headers.map(escAttr).join(', ')}
    </div>
    <div style="overflow-x:auto;max-height:160px;overflow-y:auto">
      <table class="admin-table">
        <thead><tr>${headers.map(h => `<th>${escAttr(h)}</th>`).join('')}</tr></thead>
        <tbody>${preview.map(r =>
          `<tr>${headers.map(h => `<td>${escAttr(r[h] ?? '')}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    </div>
    ${rows.length > 5 ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">... и ещё ${rows.length - 5} строк</div>` : ''}`;
  document.getElementById('adminImportBtn').style.display = '';
}

// ── Submit ──
async function _submitCsvImport() {
  if(!_csvParsed) return;
  const type   = document.getElementById('adminImportType')?.value;
  const teamId = document.getElementById('adminImportTeam')?.value;
  const log    = document.getElementById('adminImportLog');
  const btn    = document.getElementById('adminImportBtn');

  if(type !== 'global_tiers' && !teamId) {
    toast('Выбери команду', 'err'); return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Импорт...';
  log.innerHTML = '';

  try {
    const { imported, skipped, errors } = await _importCsv(type, teamId, _csvParsed.rows);
    log.innerHTML = `
      <div class="admin-log">
        <div class="admin-log-ok">✓ Импортировано: <b>${imported}</b></div>
        ${skipped  ? `<div class="admin-log-warn">⚠ Пропущено: ${skipped}</div>` : ''}
        ${errors.length ? `<div class="admin-log-err">✗ Ошибок: ${errors.length}<br>
          <code style="font-size:var(--fluid-fs-2xs)">${errors.slice(0,5).map(escAttr).join('<br>')}</code></div>` : ''}
      </div>`;
    toast(`Импорт завершён: ${imported} строк`, 'ok');
  } catch(e) {
    log.innerHTML = `<div class="admin-error">Ошибка: ${escAttr(e.message)}</div>`;
    toast('Ошибка импорта', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Импортировать';
  }
}
