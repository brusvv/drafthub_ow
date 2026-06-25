// @hash 102d5d30 2026-06-25T10:08
// ════ NAV ════
// toast(), esc(), showError(), handleError() — в render-utils.js
// toastT proxy — тоже в render-utils.js (нужен там для toast)

function showView(v, btn) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  if (btn) btn.classList.add('active');
  renderCurrentView();
}

// ════ ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА (хедер) ════
// Постоянно видимый в хедере дубликат _renderTierModeSwitcher()
// (render-tiers.js) — оба читают/пишут общий tierViewMode/switchTierMode
// (data/db-load.js), так что переключение одного синхронно с другим.
// Вызывается из auth/ui.js (_renderHeader), auth/session.js (_renderPublicHeader)
// и render-tiers.js (renderTiers) — везде где надо обновить хедер.
const _APP_MODES = [
  { key:'global',   label:'Глобальный', icon:'🌐', color:'var(--tank)' },
  { key:'team',     label:'Командный',  icon:'👥', color:'var(--support)' },
  { key:'personal', label:'Личный',     icon:'👤', color:'#9B7FE0' },
];

function renderAppModeSwitcher() {
  const el = document.getElementById('appModeSwitcher'); if (!el) return;

  // Анонимный посетитель (фаза 3) — только индикатор, без переключения
  if (typeof isPublicMode === 'function' && isPublicMode()) {
    el.innerHTML = `<div class="mode-pill" style="background:${_APP_MODES[0].color}"
      title="Глобальный тир-лист">${_APP_MODES[0].icon}</div>`;
    return;
  }

  const current = _APP_MODES.find(m => m.key === tierViewMode) || _APP_MODES[1];
  el.innerHTML = `
    <div class="mode-switcher" style="position:relative">
      <button class="mode-pill" style="background:${current.color}"
        onclick="event.stopPropagation();_toggleAppModePopup()"
        title="Режим: ${current.label} (клик — переключить)">${current.icon}</button>
      <div id="appModePopup" class="mode-popup hidden">
        ${_APP_MODES.map(m => `
          <div class="mode-popup-item${m.key === tierViewMode ? ' active' : ''}" onclick="_pickAppMode('${m.key}')">
            <span class="mode-pill" style="background:${m.color};width:22px;height:22px;font-size:11px">${m.icon}</span>
            <span>${m.label}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function _toggleAppModePopup() {
  document.getElementById('appModePopup')?.classList.toggle('hidden');
}

function _pickAppMode(mode) {
  document.getElementById('appModePopup')?.classList.add('hidden');
  switchTierMode(mode);
  if (!document.getElementById('view-tiers')?.classList.contains('active')) {
    showView('tiers', document.getElementById('navTiersBtn'));
  }
}

// Закрытие дропдаунов кликом снаружи
document.addEventListener('click', (e) => {
  // appModePopup — закрыть если клик вне .mode-switcher
  const modePopup = document.getElementById('appModePopup');
  if (modePopup && !modePopup.classList.contains('hidden') && !e.target.closest('.mode-switcher')) {
    modePopup.classList.add('hidden');
  }
  // teamSwitcherPopup — закрыть если клик вне .team-chip
  const teamPopup = document.getElementById('teamSwitcherPopup');
  if (teamPopup && !teamPopup.classList.contains('hidden') && !e.target.closest('.team-chip')) {
    teamPopup.classList.add('hidden');
  }
});
