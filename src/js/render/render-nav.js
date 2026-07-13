// ════ NAV ════
// toast(), esc(), showError(), handleError() — в render-utils.js
// toastT proxy — тоже в render-utils.js (нужен там для toast)

// ── Роутинг вкладок ──────────────────────────────────────────
// Даёт вкладкам реальные bookmark-able/shareable URL (/maps, /heroes и
// т.п.) через History API. Не меняет сам факт что это SPA — просто
// синхронизирует адресную строку с активной вкладкой.
//
// Deep-link на hard-reload (например открыли https://.../drafthub_ow/heroes
// не кликом внутри приложения, а напрямую) идёт через уже существующий
// GitHub Pages 404.html → sessionStorage → history.replaceState трюк
// (см. session.js initSession) — он восстанавливает location.pathname
// ДО того как эта логика вообще успевает посмотреть на него, так что
// отдельно обрабатывать hard-reload здесь не нужно, достаточно один раз
// прочитать pathname при старте (см. session.js switchTeam → _viewFromPath).
const VIEW_PATHS = {
  maps: '/maps', heroes: '/heroes', tiers: '/tiers', bans: '/draft',
  players: '/players', roster: '/roster', settings: '/settings', admin: '/admin',
  // ⚠️ Внутренний ключ 'bans' и view-bans/renderBans() остаются как есть —
  // это просто внутреннее имя, не URL. Меняем только публичный путь: кнопка
  // в nav уже называется "Драфт" (main-app.html), теперь и адресная строка
  // соответствует (/draft вместо /bans).
};

// pathname → ключ вкладки, или null если путь ни на что не похож
// (тогда вызывающий код сам решает дефолт — обычно 'maps').
function _viewFromPath(pathname){
  const rel = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  const entry = Object.entries(VIEW_PATHS).find(([, p]) => p === rel);
  return entry ? entry[0] : null;
}

// opts.pushState (default true) — false при восстановлении из URL
// (popstate/начальная загрузка), чтобы не плодить лишние записи в history
// и не зациклить popstate-обработчик сам на себя.
function showView(v, btn, opts = {}) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v)?.classList.add('active');
  if (btn) {
    btn.classList.add('active');
  } else {
    // btn не передан (роутинг/popstate) — находим кнопку сами по onclick,
    // чтобы подсветка активной вкладки в nav не расходилась с URL.
    document.querySelector(`.nav-btn[onclick*="showView('${v}'"]`)?.classList.add('active');
  }

  if (opts.pushState !== false && VIEW_PATHS[v]) {
    const path = appPath(VIEW_PATHS[v]);
    if (window.location.pathname !== path) history.pushState({ view: v }, '', path);
  }

  renderCurrentView();
}

// Back/Forward между вкладками — обычное ожидание пользователя раз URL
// теперь меняется при навигации.
window.addEventListener('popstate', () => {
  const v = _viewFromPath(window.location.pathname);
  if (v) showView(v, null, { pushState: false });
});

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
  // switchTierMode() сама перерисовывает renderTiers()/renderHeroes() —
  // этого достаточно, Maps/Bans/Players/Roster не зависят от tierViewMode.
  // Раньше здесь был принудительный showView('tiers',...) — прыгал на
  // Tier List даже если пользователь сменил режим находясь на другой
  // вкладке. Убрано по просьбе пользователя: смена режима не должна
  // менять активную вкладку.
  switchTierMode(mode);
}

// Закрытие попапа кликом снаружи
document.addEventListener('click', (e) => {
  const popup = document.getElementById('appModePopup');
  if (popup && !popup.classList.contains('hidden') && !e.target.closest('.mode-switcher')) {
    popup.classList.add('hidden');
  }
});

// ── Счётчики в навигации ─────────────────────────────────────
// Вызывается из loadAllData() после загрузки данных.
// Обновляет span.nav-count рядом с кнопками навигации.
function updateNavCounts() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val > 0 ? val : '';
  };

  // heroes/maps/players — из глобальных массивов
  set('navCountHeroes',  (typeof heroes  !== 'undefined') ? heroes.length  : 0);
  set('navCountMaps',    (typeof maps    !== 'undefined') ? maps.filter(m => m.inPool !== false).length : 0);
  set('navCountPlayers', (typeof players !== 'undefined') ? players.length : 0);

  // Roster — количество игроков в текущем составе
  const roster = (typeof rosterPlayers !== 'undefined') ? rosterPlayers : [];
  set('navCountRoster', roster.length);
}
