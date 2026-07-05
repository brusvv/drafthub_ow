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

      <div style="margin-bottom:12px">
        <label class="admin-file-label">
          <input type="file" id="adminCsvFile" accept=".csv" onchange="_onCsvFileSelected(this)"
            style="display:none">
          <span class="btn">
            📂 Выбрать CSV файл
          </span>
          <span id="adminCsvFileName" style="font-size:11px;color:var(--text3);margin-left:8px">Файл не выбран</span>
        </label>
      </div>

      <div id="adminCsvPreview" style="margin-bottom:12px"></div>

      <button class="btn btn-primary" id="adminImportBtn" onclick="_submitCsvImport()"
        style="display:none;font-size:12px">
        ▶ Импортировать
      </button>

      <div id="adminImportLog" style="margin-top:12px"></div>
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
  heroes: `Обязательные колонки: <b>name, role</b> (Tank/Damage/Support)<br>
    Опциональные: subrole, priority (1-10), banned (TRUE/FALSE), notes,
    counters (<code>Hero:score,Hero:score</code>)`,
  maps: `Обязательные: <b>name, type</b> (Hybrid/Escort/Control/Push/Flashpoint/Clash)<br>
    Опциональные: tier (S/A/B/C/D), priority, atk, def, dif (1-5), notes, in_pool (TRUE/FALSE)`,
  players: `Обязательные: <b>name, main_role</b><br>
    Опциональные: btag, off_role, rank_tank, rank_dmg, rank_sup, notes`,
  hero_map_strength: `Обязательные: <b>hero_name, map_name, atk</b> (0-10)<br>
    Опциональные: def (0-10, если нет — равно atk)`,
  hero_synergy: `Обязательные: <b>hero_name, synergy_hero, score</b> (1-10)`,
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
        `<div class="admin-error">Ошибка парсинга: ${err.message}</div>`;
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
      Найдено строк: <b>${rows.length}</b> · Колонки: ${headers.join(', ')}
    </div>
    <div style="overflow-x:auto;max-height:160px;overflow-y:auto">
      <table class="admin-table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${preview.map(r =>
          `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`
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
          <code style="font-size:9px">${errors.slice(0,5).join('<br>')}</code></div>` : ''}
      </div>`;
    toast(`Импорт завершён: ${imported} строк`, 'ok');
  } catch(e) {
    log.innerHTML = `<div class="admin-error">Ошибка: ${e.message}</div>`;
    toast('Ошибка импорта', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Импортировать';
  }
}

// ── Диспетчер по типам ──
async function _importCsv(type, teamId, rows) {
  if(type === 'heroes')            return _importHeroes(teamId, rows);
  if(type === 'maps')              return _importMaps(teamId, rows);
  if(type === 'players')           return _importPlayers(teamId, rows);
  if(type === 'hero_map_strength') return _importHeroMapStrength(teamId, rows);
  if(type === 'hero_synergy')      return _importHeroSynergy(teamId, rows);
  if(type === 'global_tiers')      return _importGlobalTiers(rows);
  throw new Error('Неизвестный тип: ' + type);
}

// ── Батч-хелпер ──
async function _batchUpsert(table, rows, conflict, chunkSize = 100) {
  let imported = 0; const errors = [];
  for(let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await _sb.from(table).upsert(chunk, { onConflict: conflict });
    if(error) errors.push(`[${i}-${i+chunk.length}]: ${error.message}`);
    else imported += chunk.length;
  }
  return { imported, skipped: 0, errors };
}

// ── Импорт героев ──
async function _importHeroes(teamId, rows) {
  const mapped = rows
    .filter(r => r.name && r.role)
    .map(r => ({
      team_id:  teamId,
      name:     r.name,
      role:     r.role,
      subrole:  r.subrole || '',
      priority: parseInt(r.priority) || 5,
      banned:   (r.banned || '').toUpperCase() === 'TRUE',
      notes:    r.notes || '',
      counters: _parseCountersCsv(r.counters || ''),
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('heroes', mapped, 'team_id,name');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт карт ──
async function _importMaps(teamId, rows) {
  const validTypes = ['Hybrid','Escort','Control','Push','Flashpoint','Clash'];
  const mapped = rows
    .filter(r => r.name && r.type && validTypes.includes(r.type))
    .map(r => ({
      team_id:  teamId,
      name:     r.name,
      type:     r.type,
      tier:     ['S','A','B','C','D'].includes(r.tier) ? r.tier : 'B',
      priority: parseInt(r.priority) || 5,
      atk:      Math.min(5, Math.max(1, parseInt(r.atk) || 3)),
      def:      Math.min(5, Math.max(1, parseInt(r.def) || 3)),
      dif:      Math.min(5, Math.max(1, parseInt(r.dif) || 3)),
      notes:    r.notes || '',
      in_pool:  (r.in_pool || 'TRUE').toUpperCase() !== 'FALSE',
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('maps', mapped, 'team_id,name');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт игроков ──
async function _importPlayers(teamId, rows) {
  const mapped = rows
    .filter(r => r.name && r.main_role)
    .map(r => ({
      team_id:   teamId,
      name:      r.name,
      btag:      r.btag || '',
      main_role: r.main_role,
      off_role:  r.off_role || '',
      rank_tank: r.rank_tank || '',
      rank_dmg:  r.rank_dmg || '',
      rank_sup:  r.rank_sup || '',
      notes:     r.notes || '',
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('players', mapped, 'team_id,name');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт силы героев на картах ──
async function _importHeroMapStrength(teamId, rows) {
  const mapped = rows
    .filter(r => r.hero_name && r.map_name && r.atk)
    .map(r => ({
      team_id:   teamId,
      hero_name: r.hero_name,
      map_name:  r.map_name,
      atk: Math.min(10, Math.max(0, parseInt(r.atk) || 0)),
      def: Math.min(10, Math.max(0, parseInt(r.def) || parseInt(r.atk) || 0)),
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('hero_map_strength', mapped, 'team_id,hero_name,map_name');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт синергий ──
async function _importHeroSynergy(teamId, rows) {
  const mapped = rows
    .filter(r => r.hero_name && r.synergy_hero && r.score)
    .map(r => ({
      team_id:      teamId,
      hero_name:    r.hero_name,
      synergy_hero: r.synergy_hero,
      score: Math.min(10, Math.max(1, parseInt(r.score) || 5)),
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('hero_synergy', mapped, 'team_id,hero_name,synergy_hero');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт глобального тир-листа ──
// BUG-FIX: раньше писал в global_tier_data (текстовые entity_type/name) —
// таблица удалена в MIGR-1, переехала в tier_lists/tier_entries (hero_id/
// map_id FK на каталог). Не через generic _batchUpsert — idx_tier_entries_
// hero/_map частичные unique-индексы, чистый UPSERT с ON CONFLICT под них
// не работает (та же причина что в sheets-import.js importTiersFromSheets),
// нужен delete-then-insert. Резолв имён → id берём готовый из
// _resolveHeroId/_resolveMapId (sheets-import-resolve.js, MIGR-6) — не
// пишем вторую версию резолвера.
async function _importGlobalTiers(rows) {
  if(!isSuperAdmin()){
    return { imported: 0, skipped: 0, errors: ['Глобальный тир-лист может импортировать только суперадминистратор'] };
  }

  const posCounters = { hero: {}, map: {} };
  const unresolved = [];
  const entries = rows
    .filter(r => r.entity_type && r.name && ['S','A','B','C','D'].includes(r.tier))
    .map(r => {
      const entityType = r.entity_type === 'map' ? 'map' : 'hero';
      const id = entityType === 'map' ? _resolveMapId(r.name) : _resolveHeroId(r.name);
      if(!id){ unresolved.push(r.name); return null; }
      const bucket = posCounters[entityType];
      if(!(r.tier in bucket)) bucket[r.tier] = 0;
      const position = bucket[r.tier]++;
      return {
        entity_type: entityType,
        hero_id: entityType === 'hero' ? id : null,
        map_id:  entityType === 'map'  ? id : null,
        tier: r.tier, position,
      };
    })
    .filter(Boolean);

  const skipped = rows.length - entries.length;
  if(!entries.length) return { imported: 0, skipped, errors: [] };

  const tierListId = await _resolveTierListId('global', {});
  if(!tierListId) return { imported: 0, skipped, errors: ['Не удалось определить глобальный тир-лист'] };

  const entryRows = entries.map(e => ({ ...e, tier_list_id: tierListId }));

  // Полный ре-импорт заменяет ВЕСЬ глобальный список по каждому затронутому
  // entity_type — так же ведёт себя import из Sheets (importTiersFromSheets),
  // не точечный upsert по строкам.
  const touchedTypes = [...new Set(entryRows.map(e => e.entity_type))];
  for(const t of touchedTypes){
    const { error: delErr } = await _sb.from('tier_entries').delete()
      .eq('tier_list_id', tierListId).eq('entity_type', t);
    if(delErr) return { imported: 0, skipped, errors: [delErr.message] };
  }

  const { error: insErr } = await _sb.from('tier_entries').insert(entryRows);
  if(insErr) return { imported: 0, skipped, errors: [insErr.message] };

  if(unresolved.length) console.warn(`[admin CSV] GlobalTiers: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  return { imported: entryRows.length, skipped, errors: [] };
}

// ── Хелпер парсинга контрпиков из CSV ──
function _parseCountersCsv(str) {
  if(!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const sep = s.lastIndexOf(':');
    if(sep < 0) return { name: s, score: 5 };
    const score = parseInt(s.slice(sep+1));
    return { name: s.slice(0, sep).trim(), score: isFinite(score) ? score : 5 };
  });
}
