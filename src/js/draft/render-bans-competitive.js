// ════════════════════════════════════════════════════════════
// render-bans-competitive.js — соревновательный режим банов
//
// Отвечает за:
//   • _renderCompetitiveMode()  — точка входа, вызывается из core
//   • Попап выбора карты матча  — openCompMapPopup / closeCompMapPopup
//   • Грид голосования за баны — _renderCompBanGrid / toggleCompBan
//   • Расчёт и рендер рекомендаций — _computeCompRecs / _renderCompBanResult
//   • Сброс состояния           — resetCompBans
//
// Правила режима:
//   4 бана итого (2 от каждой команды)
//   Каждый игрок выбирает до 3 приоритетов (P1=7 / P2=5 / P3=3 очков)
//   Максимум 2 бана одной роли на команду
//
// Зависимости: render-bans-core.js (renderBans, _renderBanRecs, _buildHeroChips)
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
// ПОПАП ВЫБОРА КАРТЫ МАТЧА
// ════════════════════════════════════════════════════════════

function openCompMapPopup() {
  const types    = ['Control', 'Hybrid', 'Push', 'Escort', 'Flashpoint'];
  const groupHtml = types.map(t => {
    const ms = maps.filter(m => m.type === t);
    if (!ms.length) return '';

    const chips = ms.map(m => {
      const src = mapImg(m.name);
      const sel = compBanMap === m.name;
      return `<div
          onclick="compBanMap='${esc(m.name)}';closeCompMapPopup();renderBans();"
          style="cursor:pointer;border-radius:8px;overflow:hidden;
                 border:2px solid ${sel ? 'var(--support)' : 'var(--border)'};
                 background:${sel ? 'rgba(43,189,142,.08)' : 'var(--bg3)'};
                 transition:all .1s;width:100px">
        ${src
          ? `<img src="${src}" style="width:100%;height:56px;object-fit:cover;display:block"
                  onerror="this.style.display='none'">`
          : `<div style="width:100%;height:56px;background:var(--bg4);display:flex;
                         align-items:center;justify-content:center;
                         font-size:11px;font-weight:700;color:var(--text3)">
               ${m.name[0]}
             </div>`}
        <div style="padding:4px 6px;font-size:10px;font-weight:600;text-align:center;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${m.name}
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:14px">
      <div style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
                  letter-spacing:.08em;color:var(--text3);margin-bottom:6px;
                  display:flex;align-items:center;gap:4px">
        ${mapTypeIcon(t, 12)} ${t}
      </div>
      <div class="chip-row-lg">${chips}</div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'compMapPopup';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.75);
    backdrop-filter:blur(4px);display:flex;align-items:center;
    justify-content:center;z-index:3000;padding:1rem`;
  overlay.onclick = e => { if (e.target === overlay) closeCompMapPopup(); };
  overlay.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:14px;
                width:100%;max-width:620px;max-height:84vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <span style="font-size:15px;font-weight:700">Выбрать карту матча</span>
        <button style="background:none;border:none;color:var(--text3);font-size:18px;
                       cursor:pointer;padding:2px 6px"
                onclick="closeCompMapPopup()">×</button>
      </div>
      <div style="overflow-y:auto;padding:1.25rem">${groupHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeCompMapPopup() {
  const el = document.getElementById('compMapPopup');
  if (el) el.remove();
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
        <div class="ban-map-picker-btn" onclick="openCompMapPopup()"
             style="display:flex;align-items:center;gap:8px;background:var(--bg3);
                    border:1px solid var(--border2);border-radius:8px;padding:7px 12px;
                    cursor:pointer;min-height:38px;transition:border-color .15s"
             onmouseover="this.style.borderColor='var(--border3)'"
             onmouseout="this.style.borderColor='var(--border2)'">
          ${mapBtn}
          <span style="color:var(--text3);font-size:12px;margin-left:auto">▾</span>
        </div>
      </div>
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Наши герои</div>
        <div class="ban-hero-selector" onclick="openPicker('banHeroes',5)">
          ${_buildHeroChips()}
          <span class="ban-hero-edit">✎</span>
        </div>
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

      return `<div class="comp-ban-chip ${priority ? 'active' : ''}"
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
      </div>`;
    }).join('');

    return `<div>
      <div style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
                  letter-spacing:.08em;color:${rc[role]};margin-bottom:6px;
                  display:flex;align-items:center;gap:4px">
        ${roleIcon(role, 11)} ${role}
      </div>
      <div class="chip-row">${chips}</div>
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

// ════════════════════════════════════════════════════════════
// РЕКОМЕНДАЦИИ К БАНУ
// ════════════════════════════════════════════════════════════

function _renderCompBanResult() {
  if (!Object.keys(compBanVotes).length && !banDraftHeroes.length && !compBanMap) return '';

  const selectedMap = maps.find(m => m.name === compBanMap);
  const recs        = _computeCompRecs(selectedMap);

  return `
    <div class="ban-recs-header" style="margin-top:4px">
      <span class="ban-recs-title">Рекомендации к бану</span>
      <span class="ban-recs-algo-hint">по контрпикам и силе на карте</span>
    </div>
    ${_renderBanRecs(recs)}`;
}

/**
 * Считает итоговый скор каждого небаненного героя
 * из голосов команды + контрпиков + силы на карте.
 * @param {object|undefined} selectedMap
 * @returns {Array<{hero, score, reasons}>}
 */
function _computeCompRecs(selectedMap) {
  const VOTE_WEIGHTS = { 1: 7, 2: 5, 3: 3 };

  return heroes
    .filter(h => !h.banned)
    .map(h => {
      let score = 0;
      const reasons = [];

      // Голос команды
      const p = compBanVotes[h.name];
      if (p) {
        score += (VOTE_WEIGHTS[p] || 0) * 1.5;
        reasons.push({ type: 'meta', text: `Приоритет P${p}` });
      }

      // Контрпики наших героев
      let counterWeight = 0;
      const paired = [];
      banDraftHeroes.forEach(hn => {
        const our = heroMap[hn]; if (!our) return;
        const c = (our.counters || []).find(x => x.name === h.name);
        if (c) { counterWeight += c.score; paired.push({ hero: hn, score: c.score }); }
      });
      if (counterWeight > 0) {
        score += counterWeight * 2;
        const top = paired.sort((a, b) => b.score - a.score).slice(0, 2);
        reasons.push({ type: 'counter', text: 'Контрит: ' + top.map(p => p.hero).join(', ') });
      }

      // Сила на карте матча
      if (selectedMap) {
        if ((h.strongMaps || []).includes(selectedMap.name)) {
          score += 5;
          reasons.push({ type: 'mapStrong', text: `Силён: ${selectedMap.name}` });
        }
        if ((selectedMap.counters || []).includes(h.name)) {
          score += 2;
          reasons.push({ type: 'mapBan', text: 'Бан-лист карты' });
        }
      }

      // Мета-вес героя
      score += h.priority * 0.4;

      return { hero: h, score: Math.round(score), reasons };
    })
    .filter(r => r.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
