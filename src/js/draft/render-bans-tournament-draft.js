// @hash 6ec61263 2026-07-16T01:56
// ════════════════════════════════════════════════════════════
// render-bans-tournament-draft.js — турнирный драфт: точка входа + пул карт
//
// Точка входа  — _renderTournamentMode(), resetTournDraft()
// Фаза 1 «pool» — _renderTournPoolSetup(), setTournFormat(),
//                 toggleTournPoolMap(), startTournMapDraft()
//
// FILESPLIT-3 (16.07): фаза 2 «mapDraft» вынесена в
// render-bans-tournament-mapdraft.js (файл перевалил за 270 строк) —
// _renderTournMapDraft() и всё что она вызывает теперь там.
//
// Константы TOURN_MODE_STEPS/TOURN_FORMAT_MODES/ATTACK_DEFENSE_MODES —
// в render-bans-tournament-state.js (несмотря на старый комментарий здесь,
// который указывал на этот файл — устарел, поправлено 16.07).
//
// Зависимости: render-bans-core.js (renderBans)
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// ТОЧКА ВХОДА — вызывается из render-bans-core
// ════════════════════════════════════════════════════════════

function _renderTournamentMode() {
  if (tDraft.phase === 'pool')      return _renderTournPoolSetup();
  if (tDraft.phase === 'mapDraft')  return _renderTournMapDraft();
  if (tDraft.phase === 'heroBans')  return _renderTournHeroBans();
  return '';
}

function resetTournDraft() {
  tDraft = {
    phase: 'pool', mapPool: {}, mapDraftSteps: [], stepIndex: 0,
    pickedMaps: [], currentMapIdx: 0, heroBans: [], format: 5,
  };
  renderBans();
}

// ════════════════════════════════════════════════════════════
// ФАЗА 1 — НАСТРОЙКА ПУЛА КАРТ
// ════════════════════════════════════════════════════════════

function _renderTournPoolSetup() {
  const modes = ['Control', 'Hybrid', 'Push', 'Flashpoint', 'Escort'];

  const modeBlocks = modes.map(mode => {
    const avail    = maps.filter(m => m.type === mode);
    if (!avail.length) return '';
    const selected = tDraft.mapPool[mode] || [];

    const chips = avail.map(m => {
      const sel = selected.includes(m.name);
      const src = mapImg(m.name);
      return `<button type="button" class="tourn-map-chip btn-reset${sel ? ' sel' : ''}"
                   onclick="toggleTournPoolMap('${esc(mode)}','${esc(m.name)}')">
        ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
        <span>${m.name}</span>
        ${sel ? '<div class="tourn-map-check">✓</div>' : ''}
      </button>`;
    }).join('');

    return `<div>
      <div style="font-family:var(--mono);font-size:11px;font-weight:700;
                  text-transform:uppercase;letter-spacing:.08em;color:var(--text2);
                  margin-bottom:8px;display:flex;align-items:center;gap:5px">
        ${mapTypeIcon(mode, 14)} ${mode}
      </div>
      <div class="chip-row-lg">${chips}</div>
    </div>`;
  }).join('');

  const formatBtns = [1, 2, 3, 5, 7]
    .map(fmt => `<button class="tourn-format-btn${tDraft.format === fmt ? ' active' : ''}"
                          onclick="setTournFormat(${fmt})">Bo${fmt}</button>`)
    .join('');

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Турнирный драфт — Пул карт</div>
        <div class="ban-panel-hint">
          Выбери формат встречи и доступные карты для каждого режима.
          Bo5: Control → Hybrid → Push → Flashpoint → Escort;
          Bo7 добавляет Control и Escort.
        </div>
      </div>
      <div class="tourn-format-block">
        <div class="ban-draft-lbl">Формат встречи</div>
        <div class="tourn-format-picker">${formatBtns}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px">
        ${modeBlocks}
      </div>
      <button class="btn btn-primary" onclick="startTournMapDraft()" style="padding:8px 20px">
        Начать драфт карт →
      </button>
      <button class="btn" onclick="resetTournDraft()" style="margin-left:8px">Сбросить</button>
    </div>`;
}

function setTournFormat(format) {
  tDraft.format = format;
  renderBans();
}

function toggleTournPoolMap(mode, name) {
  if (!tDraft.mapPool[mode]) tDraft.mapPool[mode] = [];
  const arr = tDraft.mapPool[mode];
  const idx = arr.indexOf(name);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(name);
  renderBans();
}

function startTournMapDraft() {
  const modeOrder    = TOURN_FORMAT_MODES[tDraft.format] || TOURN_FORMAT_MODES[5];
  const requiredModes = [...new Set(modeOrder)];
  const missing      = requiredModes.filter(m => !(tDraft.mapPool[m] || []).length);

  if (missing.length) {
    toast(`Для Bo${tDraft.format} добавь карты: ${missing.join(', ')}`, 'err');
    return;
  }

  const steps = [];
  modeOrder.forEach((mode, idx) => {
    const pool = tDraft.mapPool[mode] || [];
    if (!pool.length) return;
    const scheme = _getTournModeSteps(mode, idx + 1);
    scheme.forEach(s => steps.push({ ...s, mode, mapNo: idx + 1, done: false, value: null, pool: [...pool] }));
  });

  if (!steps.length) { toast('Для выбранного формата нет карт в пуле', 'err'); return; }

  tDraft.mapDraftSteps = steps;
  tDraft.stepIndex     = 0;
  tDraft.pickedMaps    = [];
  tDraft.phase         = 'mapDraft';
  renderBans();
}
