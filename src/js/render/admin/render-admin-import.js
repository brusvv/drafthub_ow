// @hash 9aef0827 2026-07-12T05:04
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
          <code style="font-size:var(--fluid-fs-2xs)">${errors.slice(0,5).join('<br>')}</code></div>` : ''}
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
// AUD-5 (11.07): было — писал name/role/subrole прямо в heroes (эти
// колонки убраны в MIGR-1, ушли в hero_catalog). Теперь: name резолвится
// в hero_id через _resolveHeroId (sheets-import-resolve.js, тот же global
// scope что и Sheets-импорт — не пишем вторую версию резолвера). role/
// subrole больше не читаем — это факт каталога, не команды, CSV не может
// их менять (тот же принцип что и в sheets-import.js importHeroesFromSheets).
// counters — отдельная таблица hero_counters (scope='team'), не heroes.counters.
async function _importHeroes(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.name)
    .map(r => {
      const heroId = _resolveHeroId(r.name);
      if(!heroId){ unresolved.push(r.name); return null; }
      return {
        team_id:  teamId,
        hero_id:  heroId,
        priority: parseInt(r.priority) || 5,
        banned:   (r.banned || '').toUpperCase() === 'TRUE',
        notes:    r.notes || '',
        _counters: _parseCountersCsv(r.counters || ''), // снимается перед upsert, см. ниже
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] Heroes: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };

  const upsertRows = mapped.map(({ _counters, ...r }) => r);
  const result = await _batchUpsert('heroes', upsertRows, 'team_id,hero_id');

  // Контрпики — отдельно, после успешной записи героев (тот же принцип что
  // _importTeamHeroCounters в sheets-import.js: delete по затронутым hero_id
  // + bulk insert, не трогаем контрпики героев не из этого импорта).
  const withCounters = mapped.filter(m => m._counters.length);
  if(withCounters.length){
    const heroIds = withCounters.map(m => m.hero_id);
    await _sb.from('hero_counters').delete()
      .eq('scope', 'team').eq('team_id', teamId).in('hero_id', heroIds);
    const counterUnresolved = [];
    const counterRows = [];
    withCounters.forEach(m => {
      m._counters.forEach(c => {
        const counterId = _resolveHeroId(c.name);
        if(!counterId){ counterUnresolved.push(c.name); return; }
        if(counterId === m.hero_id) return; // CHECK(hero_id<>counter_hero_id)
        counterRows.push({ scope: 'team', team_id: teamId, hero_id: m.hero_id, counter_hero_id: counterId, score: c.score });
      });
    });
    if(counterUnresolved.length) console.warn(`[admin CSV] Heroes → counters: не найдены — ${[...new Set(counterUnresolved)].join(', ')}`);
    if(counterRows.length){
      const { error } = await _sb.from('hero_counters').insert(counterRows);
      if(error) result.errors.push('counters: ' + error.message);
    }
  }

  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт карт ──
// AUD-5 (11.07): было — писал name/type/in_pool прямо в maps (эти колонки
// ушли в map_catalog в MIGR-1). name резолвится в map_id через _resolveMapId.
// type/in_pool больше не читаем — факт каталога, не команды.
async function _importMaps(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.name)
    .map(r => {
      const mapId = _resolveMapId(r.name);
      if(!mapId){ unresolved.push(r.name); return null; }
      return {
        team_id:  teamId,
        map_id:   mapId,
        tier:     ['S','A','B','C','D'].includes(r.tier) ? r.tier : 'B',
        priority: parseInt(r.priority) || 5,
        atk:      Math.min(5, Math.max(1, parseInt(r.atk) || 3)),
        def:      Math.min(5, Math.max(1, parseInt(r.def) || 3)),
        dif:      Math.min(5, Math.max(1, parseInt(r.dif) || 3)),
        notes:    r.notes || '',
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] Maps: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('maps', mapped, 'team_id,map_id');
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
// AUD-5 (11.07): было hero_name/map_name text — теперь резолвим в
// hero_id/map_id. PK (team_id,hero_id,map_id) полный (не partial) —
// обычный _batchUpsert с новым onConflict, обвязку не меняем.
async function _importHeroMapStrength(teamId, rows) {
  const unresolvedHeroes = [], unresolvedMaps = [];
  const mapped = rows
    .filter(r => r.hero_name && r.map_name && r.atk)
    .map(r => {
      const heroId = _resolveHeroId(r.hero_name);
      const mapId  = _resolveMapId(r.map_name);
      if(!heroId) unresolvedHeroes.push(r.hero_name);
      if(!mapId)  unresolvedMaps.push(r.map_name);
      if(!heroId || !mapId) return null;
      return {
        team_id: teamId, hero_id: heroId, map_id: mapId,
        atk: Math.min(10, Math.max(0, parseInt(r.atk) || 0)),
        def: Math.min(10, Math.max(0, parseInt(r.def) || parseInt(r.atk) || 0)),
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolvedHeroes.length) console.warn(`[admin CSV] HeroMapStrength → герои: не найдены — ${[...new Set(unresolvedHeroes)].join(', ')}`);
  if(unresolvedMaps.length) console.warn(`[admin CSV] HeroMapStrength → карты: не найдены — ${[...new Set(unresolvedMaps)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('hero_map_strength', mapped, 'team_id,hero_id,map_id');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт синергий ──
// AUD-5 (11.07): было hero_name/synergy_hero text — теперь резолвим в
// hero_id/synergy_hero_id. PK (team_id,hero_id,synergy_hero_id) полный.
async function _importHeroSynergy(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.hero_name && r.synergy_hero && r.score)
    .map(r => {
      const heroId    = _resolveHeroId(r.hero_name);
      const synergyId = _resolveHeroId(r.synergy_hero);
      if(!heroId)    unresolved.push(r.hero_name);
      if(!synergyId) unresolved.push(r.synergy_hero);
      if(!heroId || !synergyId) return null;
      if(heroId === synergyId) return null; // CHECK(hero_id<>synergy_hero_id)
      return {
        team_id: teamId, hero_id: heroId, synergy_hero_id: synergyId,
        score: Math.min(10, Math.max(1, parseInt(r.score) || 5)),
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] HeroSynergy: не найдены — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('hero_synergy', mapped, 'team_id,hero_id,synergy_hero_id');
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
