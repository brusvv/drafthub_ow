// @hash e406a819 2026-07-16T02:25
// ════════════════════════════════════════════════════════════
// render-bans-tournament-mapdraft.js — турнирный драфт: фаза 2 (драфт карт)
//
// FILESPLIT-3 (16.07, попутно с AUDIT-D3): вынесено из
// render-bans-tournament-draft.js (313 строк, порог 270) — тот файл
// оставляет себе точку входа + фазу 1 «pool», эта фаза 2 «mapDraft»
// целиком: _renderTournMapDraft(), _renderTournProgressBar(),
// _renderTournCurrentStep(), _renderTournMapDraftDone(),
// _getTournModeSteps(), _getTournSideOptions(), tournDraftAction().
// Чистое перемещение — логика не менялась.
//
// Зависимости:
//   render-bans-tournament-state.js  (TOURN_MODE_STEPS, ATTACK_DEFENSE_MODES)
//   render-bans-tournament-draft.js  (tDraft, startTournHeroBans — фаза 3)
//   render-bans-core.js              (renderBans)
// ════════════════════════════════════════════════════════════

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

    return `<div class="tourn-step-chip" style="background:${s.done ? col + '1a' : 'var(--bg3)'};
                border-color:${i === si ? col : 'var(--border)'};opacity:${i > si ? 0.45 : 1}">
      <span class="tourn-step-chip-label" style="color:${s.done ? col : 'var(--text3)'}">${label}</span>
      <span class="tourn-step-chip-sub">${s.team} · ${s.mode.slice(0, 3)}</span>
      ${valText ? `<span class="tourn-step-chip-value" style="color:${col}">${valText}</span>` : ''}
    </div>`;
  }).join('');

  return `<div class="draft-chip-row">${chips}</div>`;
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
           return `<button type="button" class="tourn-map-chip btn-reset" onclick="tournDraftAction('${esc(n)}')">
             ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
             <span>${n}</span>
           </button>`;
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
    // Формат pm.sideTeam — "${team} → ${value}" (см. tournDraftAction ниже) —
    // раскладываем, чтобы подсветить букву команды тем же цветом, что и на
    // шаге выбора стороны (_renderTournCurrentStep выше).
    let sideHtml = '';
    if (pm.sideTeam) {
      const [sideTeamLetter, sideValue] = pm.sideTeam.split(' → ');
      const sideCol = sideTeamLetter === 'A' ? 'var(--tank)' : 'var(--damage)';
      sideHtml = `Сторона: команда <b style="color:${sideCol}">${sideTeamLetter}</b> → ${sideValue}`;
    }
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                        border-radius:8px;background:var(--bg2);border:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:11px;color:var(--text3);width:16px">${i + 1}</span>
      ${src
        ? `<img src="${src}" style="width:48px;height:30px;object-fit:cover;border-radius:5px"
                onerror="this.style.display='none'">`
        : ''}
      <span style="font-weight:700;flex:1">${pm.name}</span>
      ${mapTypeIcon(pm.mode || m?.type || '', 13)}
      <span class="tourn-picked-map-side">${sideHtml}</span>
    </div>`;
  }).join('');

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Карты выбраны</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${mapRows}</div>
      <button class="btn btn-primary" onclick="startTournHeroBans()" style="padding:8px 20px">
        Перейти к банам героев →
      </button>
      <button class="btn" onclick="tDraft.phase='pool';renderBans()" style="margin-left:8px">
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
