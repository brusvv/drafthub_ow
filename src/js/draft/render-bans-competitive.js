// @hash 1af080ec 2026-07-19T10:03
// ════════════════════════════════════════════════════════════
// render-bans-competitive.js — соревновательный режим банов
//
// Отвечает за:
//   • _renderCompetitiveMode()  — точка входа, вызывается из core
//   • Контролы (карта/наши герои) — _renderCompControls
//   • Грид голосования за баны — _renderCompBanGrid / toggleCompBan
//   • Сброс состояния           — resetCompBans
//
// Правила режима:
//   4 бана итого (2 от каждой команды)
//   Каждый игрок выбирает до 3 приоритетов (P1=7 / P2=5 / P3=3 очков)
//   Максимум 2 бана одной роли на команду
//
// FILESPLIT (15.07, было 318 строк) — вынесено в соседние файлы:
//   • render-bans-competitive-mappopup.js — openCompMapPopup/closeCompMapPopup
//   • render-bans-competitive-recs.js     — _renderCompBanResult/_computeCompRecs
//
// Зависимости: render-bans-core.js (renderBans, _renderBanRecs, _buildHeroChips),
// render-bans-competitive-mappopup.js (openCompMapPopup),
// render-bans-competitive-recs.js (_renderCompBanResult).
// ════════════════════════════════════════════════════════════

// ── Сброс ────────────────────────────────────────────────────

function resetCompBans() {
  compBanVotes  = {};
  compBanMap    = '';
  banDraftHeroes = [];
  if (pickerSelected) pickerSelected.banHeroes = [];
  renderBans();
}

// ════════════════════════════════════════════════════════════
// РЕНДЕР РЕЖИМА
// ════════════════════════════════════════════════════════════

function _renderCompetitiveMode() {
  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div class="ban-panel-title">Соревновательные баны</div>
          <button class="btn" style="font-size:10px;padding:4px 12px"
                  onclick="resetCompBans()">↺ Сбросить</button>
        </div>
        <div class="ban-panel-hint">
          Система голосования: 2 бана на команду, макс 2 героя одной роли.
          Каждый игрок выбирает 3 приоритета (7/5/3 очка)
        </div>
      </div>

      ${_renderCompControls()}
      ${_renderCompBanGrid()}
      ${_renderCompBanResult()}
    </div>`;
}

// ── Карта матча + выбор наших героев ────────────────────────
function _renderCompControls() {
  const mapBtn = compBanMap
    ? (() => {
        const m   = maps.find(x => x.name === compBanMap);
        const src = m ? mapImg(m.name) : null;
        return `
          ${src ? `<img src="${src}" style="width:48px;height:28px;object-fit:cover;border-radius:4px"
                        onerror="this.style.display='none'">` : ''}
          <span style="font-size:13px;font-weight:600;flex:1">${compBanMap}</span>
          ${m ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${m.type}</span>` : ''}`;
      })()
    : '<span style="font-size:12px;color:var(--text3)">Нажми чтобы выбрать карту...</span>';

  return `
    <div class="ban-draft-controls mb-12">
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Карта матча</div>
        <button type="button" class="ban-map-picker-btn btn-reset" onclick="openCompMapPopup()"
             style="display:flex;align-items:center;gap:8px;background:var(--bg3);
                    border:1px solid var(--border2);border-radius:8px;padding:7px 12px;
                    cursor:pointer;min-height:38px;transition:border-color .15s;width:100%"
             onmouseover="this.style.borderColor='var(--border3)'"
             onmouseout="this.style.borderColor='var(--border2)'">
          ${mapBtn}
          <span style="color:var(--text3);font-size:12px;margin-left:auto">▾</span>
        </button>
      </div>
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Наши герои</div>
        <button type="button" class="ban-hero-selector btn-reset" onclick="openPicker('banHeroes',5)">
          ${_buildHeroChips()}
          <span class="ban-hero-edit">✎</span>
        </button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ГРИД ГОЛОСОВАНИЯ
// ════════════════════════════════════════════════════════════

function _renderCompBanGrid() {
  const byRole = { Tank: [], Damage: [], Support: [] };
  heroes.filter(h => !h.banned).forEach(h => {
    if (byRole[h.role]) byRole[h.role].push(h);
  });

  const roleBlocks = ['Tank', 'Damage', 'Support'].map(role => {
    const hs = byRole[role];
    if (!hs.length) return '';

    const chips = hs.map(h => {
      const priority    = _getCompPriority(h.name);
      const src         = portrait(h.name);
      const prioColors  = { 1: 'var(--damage)', 2: 'var(--accent)', 3: 'var(--text2)' };
      const activeStyle = priority
        ? `border-color:${prioColors[priority] || 'var(--border)'};background:var(--bg3)`
        : '';

      return `<button type="button" class="comp-ban-chip btn-reset ${priority ? 'active' : ''}"
                   style="${activeStyle}"
                   data-name="${h.name}"
                   onclick="toggleCompBan(this.dataset.name)"
                   title="${h.name}">
        ${src
          ? `<img src="${src}" onerror="this.style.display='none'">`
          : `<div class="comp-ban-chip-ph">${h.name[0]}</div>`}
        ${priority
          ? `<div class="comp-ban-priority"
                  style="background:${prioColors[priority] || 'var(--text3)'}">P${priority}</div>`
          : ''}
      </button>`;
    }).join('');

    return `<div>
      <div class="meta-label" style="
                  letter-spacing:.08em;color:${rc[role]};margin-bottom:6px;
                  display:flex;align-items:center;gap:4px">
        ${roleIcon(role, 11)} ${role}
      </div>
      <div class="comp-ban-role-grid">${chips}</div>
    </div>`;
  }).join('');

  return `
    <div class="ban-draft-lbl" style="margin-bottom:8px">
      Наши приоритеты бана
      <span style="opacity:.5;font-size:var(--fluid-fs-2xs)">
        (выбери до 3 героев — 1-й приоритет самый важный)
      </span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      ${roleBlocks}
    </div>`;
}

// ── Текущий приоритет героя (1/2/3 или 0) ───────────────────
function _getCompPriority(name) {
  return compBanVotes[name] || 0;
}

function toggleCompBan(name) {
  const existing = compBanVotes[name];
  if (existing) {
    delete compBanVotes[name];
    // Пересчитываем порядковые номера после удаления
    const reordered = Object.entries(compBanVotes).sort((a, b) => a[1] - b[1]);
    compBanVotes = {};
    reordered.forEach(([n, p], i) => { compBanVotes[n] = i + 1; });
  } else {
    const count = Object.keys(compBanVotes).length;
    if (count >= 3) { toast('Максимум 3 приоритета', 'err'); return; }
    compBanVotes[name] = count + 1;
  }
  renderBans();
}
