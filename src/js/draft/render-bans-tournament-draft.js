// @hash f836f546 2026-07-14T21:09
// ════════════════════════════════════════════════════════════
// render-bans-tournament-draft.js — турнирный драфт: пул карт + драфт карт
//
// Фаза 1 «pool»     — _renderTournPoolSetup(), setTournFormat(),
//                      toggleTournPoolMap(), startTournMapDraft()
// Фаза 2 «mapDraft» — _renderTournMapDraft(), _renderTournProgressBar(),
//                      _renderTournCurrentStep(), tournDraftAction()
//
// Константы TOURN_MODE_STEPS, TOURN_FORMAT_MODES, ATTACK_DEFENSE_MODES
// объявлены здесь и используются также в render-bans-tournament-herobans.js
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
      return `<div class="tourn-map-chip${sel ? ' sel' : ''}"
                   onclick="toggleTournPoolMap('${esc(mode)}','${esc(m.name)}')">
        ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
        <span>${m.name}</span>
        ${sel ? '<div class="tourn-map-check">✓</div>' : ''}
      </div>`;
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
      <button class="btn btn-primary btn-lg" onclick="startTournMapDraft()">
        Начать драфт карт →
      </button>
      <button class="btn ml-8" onclick="resetTournDraft()">Сбросить</button>
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

// ════════════════════════════════════════════════════════════
// ФАЗА 2 — ДРАФТ КАРТ
// ════════════════════════════════════════════════════════════

function _renderTournMapDraft() {
  const steps = tDraft.mapDraftSteps;
  const si    = tDraft.stepIndex;
  const done  = steps.every(s => s.done);

  if (done) return _renderTournMapDraftDone();

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">
          Драфт карт Bo${tDraft.format} — шаг ${si + 1}/${steps.length}
        </div>
        <button class="btn fs-10" onclick="tDraft.phase='pool';renderBans()">
          ← Пул карт
        </button>
      </div>

      ${_renderTournProgressBar(steps, si)}
      ${_renderTournCurrentStep(steps[si], steps, si)}
    </div>`;
}

// Прогресс-бар шагов
function _renderTournProgressBar(steps, si) {
  const chips = steps.map((s, i) => {
    const col      = s.t === 'ban' ? 'var(--damage)' : s.t === 'pick' ? 'var(--support)' : 'var(--text3)';
    const label    = s.t === 'ban' ? 'БАН' : s.t === 'pick' ? 'ПИК' : 'СТР';
    const valText  = s.done && s.value
      ? formatShortLabel(s.value, 9)
      : '';

    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;
                        min-width:56px;padding:5px 7px;border-radius:6px;
                        background:${s.done ? col + '1a' : 'var(--bg3)'};
                        border:1px solid ${i === si ? col : 'var(--border)'};
                        opacity:${i > si ? 0.45 : 1}">
      <span style="font-family:var(--mono);font-size:7px;text-transform:uppercase;
                   letter-spacing:.06em;color:${s.done ? col : 'var(--text3)'};font-weight:700">
        ${label}
      </span>
      <span style="font-family:var(--mono);font-size:8px;color:var(--text3)">
        ${s.team} · ${s.mode.slice(0, 3)}
      </span>
      ${valText
        ? `<span style="font-size:8px;font-weight:700;color:${col};text-align:center;
                        line-height:1.2;max-width:54px;overflow:hidden;
                        white-space:nowrap;text-overflow:ellipsis">${valText}</span>`
        : ''}
    </div>`;
  }).join('');

  return `<div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">${chips}</div>`;
}

// Блок текущего шага (бан / пик / сторона)
function _renderTournCurrentStep(step, steps, si) {
  const teamColor     = step.team === 'A' ? 'var(--tank)' : 'var(--damage)';
  const stepLabel     = step.t === 'ban'
    ? `🚫 Команда <span style="color:${teamColor}">${step.team}</span> банит карту`
    : step.t === 'pick'
      ? `✅ Команда <span style="color:${teamColor}">${step.team}</span> выбирает карту`
      : `🔄 Команда <span style="color:${teamColor}">${step.team}</span> выбирает сторону`;

  // Исключаем карты, которые уже были забанены/выбраны
  const usedNames     = steps.slice(0, si).filter(s => s.done && s.value).map(s => s.value);
  const remainingPool = (step.pool || []).filter(n => !usedNames.includes(n));

  const actionArea = step.t === 'side'
    ? `<div style="display:flex;gap:8px;margin-top:8px">
         ${_getTournSideOptions(step.mode)
           .map(opt => `<button class="btn" onclick="tournDraftAction('${esc(opt.value)}')">${opt.label}</button>`)
           .join('')}
       </div>`
    : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
         ${remainingPool.map(n => {
           const src = mapImg(n);
           return `<div class="tourn-map-chip" onclick="tournDraftAction('${esc(n)}')">
             ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
             <span>${n}</span>
           </div>`;
         }).join('')}
       </div>`;

  return `
    <div style="background:var(--bg2);border:1px solid var(--border2);
                border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">
        ${stepLabel}
        <span style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:8px">
          ${mapTypeIcon(step.mode, 12)} ${step.mode}
        </span>
      </div>
      ${actionArea}
    </div>`;
}

// Экран «карты выбраны»
function _renderTournMapDraftDone() {
  const mapRows = tDraft.pickedMaps.map((pm, i) => {
    const m   = maps.find(x => x.name === pm.name);
    const src = mapImg(pm.name);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                        border-radius:8px;background:var(--bg2);border:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:11px;color:var(--text3);width:16px">${i + 1}</span>
      ${src
        ? `<img src="${src}" style="width:48px;height:30px;object-fit:cover;border-radius:5px"
                onerror="this.style.display='none'">`
        : ''}
      <span style="font-weight:700;flex:1">${pm.name}</span>
      ${mapTypeIcon(pm.mode || m?.type || '', 13)}
      <span class="mono-hint">
        ${pm.sideTeam ? `Сторона: команда ${pm.sideTeam}` : ''}
      </span>
    </div>`;
  }).join('');

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Карты выбраны</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${mapRows}</div>
      <button class="btn btn-primary btn-lg" onclick="startTournHeroBans()">
        Перейти к банам героев →
      </button>
      <button class="btn ml-8" onclick="tDraft.phase='pool';renderBans()">
        ← Пул карт
      </button>
      <button class="btn" onclick="resetTournDraft()" style="margin-left:6px">Сбросить</button>
    </div>`;
}

// ── Хелперы шагов ────────────────────────────────────────────

function _getTournModeSteps(mode, mapNo) {
  // Bo7 переопределяет шаги для карт 6 и 7
  if (mapNo === 6 && mode === 'Control') return [{ t:'ban', team:'A' }, { t:'pick', team:'B' }, { t:'side', team:'A' }];
  if (mapNo === 7 && mode === 'Escort')  return [{ t:'ban', team:'B' }, { t:'pick', team:'A' }, { t:'side', team:'B' }];
  return TOURN_MODE_STEPS[mode] || TOURN_MODE_STEPS.Control;
}

function _getTournSideOptions(mode) {
  return ATTACK_DEFENSE_MODES.includes(mode)
    ? [{ value: 'Атака', label: '⚔ Атака' }, { value: 'Защита', label: '🛡 Защита' }]
    : [{ value: 'Сторона 1 / левый спавн', label: '⬅ Сторона 1' }, { value: 'Сторона 2 / правый спавн', label: '➡ Сторона 2' }];
}

function tournDraftAction(value) {
  const steps = tDraft.mapDraftSteps;
  const si    = tDraft.stepIndex;
  const step  = steps[si];

  step.done  = true;
  step.value = value;

  if (step.t === 'pick') {
    tDraft.pickedMaps.push({ name: value, mode: step.mode, mapNo: step.mapNo, sideTeam: null });
  }
  if (step.t === 'side' && tDraft.pickedMaps.length) {
    tDraft.pickedMaps[tDraft.pickedMaps.length - 1].sideTeam = `${step.team} → ${value}`;
  }

  // Убираем выбранную/забаненную карту из пулов следующих шагов того же режима
  if (step.t === 'ban' || step.t === 'pick') {
    steps.forEach((s, i) => {
      if (i > si && s.mode === step.mode) s.pool = (s.pool || []).filter(n => n !== value);
    });
  }

  tDraft.stepIndex = si + 1;
  renderBans();
}
