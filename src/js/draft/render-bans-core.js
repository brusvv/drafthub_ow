// @hash 9f6b7440 2026-06-25T22:21
// ════════════════════════════════════════════════════════════
// render-bans-core.js — ядро вкладки «Текущие баны»
//
// Отвечает за:
//   • Store-прокси для всех bans-переменных
//   • Переключатель режимов (competitive / tournament)
//   • renderBans() — точка входа для перерисовки
//   • Активные баны (герои с h.banned === true)
//   • Общие render-хелперы: _buildCurrentBanGroups, _buildHeroChips,
//     _renderBanRecs — используются обоими режимами
//
// Зависимости (должны быть загружены раньше):
//   store.js, render-bans-competitive.js, render-bans-tournament.js
// ════════════════════════════════════════════════════════════

// ── Store proxies ────────────────────────────────────────────
// Перенаправляют чтение/запись глобальных переменных в store,
// сохраняя обратную совместимость с остальным кодом.
Object.defineProperties(window, {
  compBanVotes:   { get(){ return store.get('compBanVotes'); },   set(v){ store.set('compBanVotes', v); },   configurable: true },
  compBanMap:     { get(){ return store.get('compBanMap'); },     set(v){ store.set('compBanMap', v); },     configurable: true },
  banDraftMap:    { get(){ return store.get('banDraftMap'); },    set(v){ store.set('banDraftMap', v); },    configurable: true },
  banDraftHeroes: { get(){ return store.get('banDraftHeroes'); }, set(v){ store.set('banDraftHeroes', v); }, configurable: true },
  tDraft:         { get(){ return store.get('tDraft'); },         set(v){ store.set('tDraft', v); },         configurable: true },
});

// ── Режим вкладки ────────────────────────────────────────────
// 'competitive' | 'tournament'
let banMode = 'competitive';

// Сброс при switchTeam
function resetBanMode() { banMode = 'competitive'; }

// ── Перехват confirmPicker для bans-специфичных режимов ──────
const _confirmPickerPreBans = window.confirmPicker || (()=>{});
window.confirmPicker = function() {
  if (pickerMode === 'banHeroes') {
    banDraftHeroes = [...(pickerSelected.banHeroes || [])];
    closePicker();
    renderBans();
  } else if (pickerMode === 'tournMapPool') {
    tournMapPool = (pickerSelected.tournMapPool || []).map(n => {
      const m = maps.find(x => x.name === n);
      return m ? { name: m.name, type: m.type } : { name: n, type: '' };
    });
    closePicker();
    renderBans();
  } else {
    _confirmPickerPreBans();
  }
};

// ════════════════════════════════════════════════════════════
// ТОЧКА ВХОДА
// ════════════════════════════════════════════════════════════

function renderBans() {
  const bg = document.getElementById('bansGrid');
  if (!bg) return;

  const activeBansHtml = _buildActiveBansSection();
  const modeSwitcher   = _buildModeSwitcher();
  const modeContent    = banMode === 'competitive'
    ? _renderCompetitiveMode()
    : _renderTournamentMode();

  bg.innerHTML = activeBansHtml + modeSwitcher + modeContent;
}

function setBanMode(mode) {
  banMode = mode;
  renderBans();
}

// ════════════════════════════════════════════════════════════
// АКТИВНЫЕ БАНЫ (глобальные — h.banned === true)
// ════════════════════════════════════════════════════════════

function _buildActiveBansSection() {
  const currentBanned = heroes.filter(h => h.banned);
  if (!currentBanned.length) return '';
  return `
    <div style="margin-bottom:1.75rem">
      <div class="section-lbl" style="margin-bottom:.75rem">Активные баны</div>
      ${_buildCurrentBanGroups(currentBanned)}
    </div>`;
}

// ── Переключатель режимов ────────────────────────────────────
function _buildModeSwitcher() {
  return `
    <div class="ban-mode-switcher">
      <button class="ban-mode-btn${banMode === 'competitive' ? ' active' : ''}" onclick="setBanMode('competitive')">
        Соревновательный
      </button>
      <button class="ban-mode-btn${banMode === 'tournament' ? ' active' : ''}" onclick="setBanMode('tournament')">
        Турнирный драфт
      </button>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ОБЩИЕ ХЕЛПЕРЫ — используются competitive и tournament
// ════════════════════════════════════════════════════════════

/**
 * Карточки забаненных героев, сгруппированные по ролям.
 * @param {object[]} banned — массив объектов героев
 */
function _buildCurrentBanGroups(banned) {
  const byRole = { Tank: [], Damage: [], Support: [] };
  banned.forEach(h => { if (byRole[h.role]) byRole[h.role].push(h); });

  return ['Tank', 'Damage', 'Support']
    .filter(r => byRole[r].length)
    .map(r => `
      <div class="ban-role-group">
        <div class="ban-role-header">
          ${roleIcon(r, 14)}
          <span class="ban-role-title" style="color:${rc[r]}">${r}</span>
        </div>
        <div class="ban-role-heroes">
          ${byRole[r].map(h => {
            const src = portrait(h.name);
            return `<div class="ban-chip">
              ${src
                ? `<img src="${src}" onerror="this.style.display='none'">`
                : `<div class="ban-chip-ph">${h.name[0]}</div>`}
              <span class="ban-chip-name">${h.name}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`)
    .join('');
}

/**
 * Чипы выбранных героев в строке «Наши герои» (competitive).
 */
function _buildHeroChips() {
  if (!banDraftHeroes.length) {
    return '<span class="ban-hero-placeholder">Нажми чтобы выбрать...</span>';
  }
  return banDraftHeroes.map(n => {
    const src = portrait(n);
    return `<div class="ban-draft-chip" title="${n}">
      ${src
        ? `<img src="${src}" onerror="this.style.display='none'">`
        : `<div class="ban-draft-chip-ph">${n[0]}</div>`}
      <span>${n}</span>
      <span class="ban-draft-chip-remove"
            onclick="event.stopPropagation();removeBanDraftHero('${esc(n)}')">×</span>
    </div>`;
  }).join('');
}

function removeBanDraftHero(name) {
  banDraftHeroes = banDraftHeroes.filter(n => n !== name);
  pickerSelected.banHeroes = [...banDraftHeroes];
  renderBans();
}

/**
 * Грид рекомендаций к бану.
 * Используется и в competitive, и в tournament (hero bans).
 * @param {Array<{hero, score, reasons}>} recs
 */
function _renderBanRecs(recs) {
  if (!recs || !recs.length) {
    return '<div class="ban-recs-empty">Нет кандидатов на бан</div>';
  }

  const maxScore = recs[0].score;

  const TAG_STYLES = {
    counter:   'background:rgba(224,85,85,.12);border-color:rgba(224,85,85,.35);color:var(--damage)',
    mapStrong: 'background:rgba(74,158,224,.1);border-color:rgba(74,158,224,.3);color:var(--tank)',
    mapBan:    'background:rgba(240,160,48,.1);border-color:rgba(240,160,48,.3);color:var(--accent)',
    meta:      'background:rgba(43,189,142,.1);border-color:rgba(43,189,142,.25);color:var(--support)',
  };

  return `<div class="ban-recs-grid">
    ${recs.map((r, i) => {
      const pct      = Math.min(100, Math.round((r.score / maxScore) * 100));
      const barColor = pct > 70 ? 'var(--damage)' : pct > 40 ? 'var(--accent)' : 'var(--text3)';
      const urgTag   = pct > 70 ? ['HIGH', 'var(--damage)'] : pct > 40 ? ['MED', 'var(--accent)'] : ['LOW', 'var(--text3)'];
      const src      = portrait(r.hero.name);
      const tags     = r.reasons
        .map(rs => `<span class="ban-rec-tag" style="${TAG_STYLES[rs.type] || TAG_STYLES.meta}">${rs.text}</span>`)
        .join('');

      return `<div class="ban-rec-card${pct > 70 ? ' ban-rec-high' : ''}">
        <div class="ban-rec-rank">${i + 1}</div>
        <div class="ban-rec-portrait">
          ${imgH(src,'ban-rec-portrait-img',r.hero.name[0])}
        </div>
        <div class="ban-rec-body">
          <div class="ban-rec-name">${r.hero.name}</div>
          <div class="ban-rec-sub">
            ${roleIcon(r.hero.role, 11)}
            <span>${r.hero.subrole || r.hero.role}</span>
          </div>
          <div class="ban-rec-bar-wrap">
            <div class="ban-rec-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
          ${tags ? `<div class="ban-rec-tags">${tags}</div>` : ''}
        </div>
        <div class="ban-rec-urgency" style="color:${urgTag[1]}">${urgTag[0]}</div>
      </div>`;
    }).join('')}
  </div>`;
}
