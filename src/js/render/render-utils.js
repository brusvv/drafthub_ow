// @hash 31ca4906 2026-07-15T00:23
// ════════════════════════════════════════════════════════════
// render-utils.js — общие визуальные хелперы рендера
// AUDIT-A4/watch-list (14.07): файл разбит на 4 — этот файл
// оставлен под чисто визуальные хелперы без побочных подписок на
// document/window. Остальное переехало в:
//   modal-focus.js      — modalStack/closeTopModal, Escape/Tab, focus-trap
//   notifications.js    — toast/showError/handleError
//   skeleton-loaders.js — showLoading/_skeletonItem
//
// • renderCurrentView()   — перерисовать активную вкладку
// • dots5()               — 5-точечный индикатор рейтинга
// • pluralRu()            — русское склонение числительных
// • heroesCountLabel()    — «3 героя», «7 героев»
// • renderEmptyState()    — общий пустой блок (нет данных)
// • renderScoreDots()     — 10-точечный интерактивный рейтинг
// • esc()                 — экранирование ' для inline onclick="..."
// • escAttr()             — экранирование &/" для data-* HTML-атрибутов
// • computePopupAnchorPosition() — позиция popup рядом с anchor-элементом
//                           (viewport fixed ИЛИ absolute внутри скролл-контейнера)
// ════════════════════════════════════════════════════════════

// ── Точка перерисовки активной вкладки ──────────────────────
function renderCurrentView() {
  const a = document.querySelector('.view.active'); if (!a) return;
  const id = a.id;
  if (id === 'view-maps')     renderMaps();
  if (id === 'view-heroes')   renderHeroes();
  if (id === 'view-tiers')    renderTiers();
  if (id === 'view-bans')     renderBans();
  if (id === 'view-players')  renderPlayers();
  if (id === 'view-roster')   renderRoster();
  if (id === 'view-settings') renderTeamSettings();
  if (id === 'view-admin')    renderAdminPanel();
}

// ── Визуальные хелперы ───────────────────────────────────────
function dots5(val, type, max = 5) {
  let h = '<div class="dots">';
  for (let i = 1; i <= max; i++) h += `<div class="dot ${i <= val ? type : ''}"></div>`;
  return h + '</div>';
}

const ruPluralRules = new Intl.PluralRules('ru-RU');
function pluralRu(count, forms) {
  const category = ruPluralRules.select(Math.abs(count));
  return forms[category] || forms.other;
}
function heroesCountLabel(count) {
  return `${count} ${pluralRu(count, { one: 'герой', few: 'героя', many: 'героев', other: 'героя' })}`;
}

function renderEmptyState({ icon = '∅', title = 'Нет данных', desc = '', action = '', compact = false } = {}) {
  const descHtml = desc ? `
    <div class="empty-desc">${desc}</div>` : '';
  const actionHtml = action ? `
    ${action}` : '';
  return `<div class="empty-state${compact ? ' empty-state-compact' : ''}">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>${descHtml}${actionHtml}
  </div>`;
}

function renderScoreDots({ value = 0, onValue, high = 'var(--damage)', size = 15 } = {}) {
  return Array.from({ length: 10 }, (_, k) => {
    const v = k + 1;
    const filled = v <= value;
    const color = scoreColor(v, { high });
    const click = typeof onValue === 'function' ? onValue(v) : '';
    return `<span onclick="${click}" style="cursor:pointer;font-size:${size}px;color:${filled ? color : 'var(--border2)'};line-height:1">◆</span>`;
  }).join('');
}

// Экранирование одинарных кавычек для inline-обработчиков onclick="..."
function esc(s) { return (s || '').replace(/'/g, "\\'"); }

// Экранирование для значений data-* атрибутов (в отличие от esc() выше —
// та экранирует ' под JS-строку внутри onclick, эта — под HTML-атрибут,
// чтобы dataset.xxx при чтении возвращал исходную строку без искажений).
function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

// ════════════════════════════════════════════════════════════
// AUDIT-A4 — общий расчёт позиции popup рядом с anchor-элементом.
// Раньше modal-hero-chips.js и modal-hero-strength.js независимо считали
// одно и то же (viewport bounds / anchor rect), см. CHANGELOG.md.
//
// Два режима:
//  - 'fixed'    — popup лежит в document.body, position:fixed, координаты
//                 относительно viewport (modal-hero-chips.js: попап поверх
//                 модалки, без внутреннего скролла контейнера)
//  - 'absolute' — popup внутри containerEl (у которого уже стоит
//                 position:relative), position:absolute, координаты
//                 относительно containerEl + поправка на скролл во
//                 вложенном scrollEl (modal-hero-strength.js: popup внутри
//                 .picker-box, которая скроллится через .picker-grid-wrap)
//
// Возвращает { position, top, left } — caller собирает cssText сам
// (ширина/фон/тень и т.п. у каждого popup свои).
// ════════════════════════════════════════════════════════════
function computePopupAnchorPosition({ anchorEl, popupW, popupH, mode = 'fixed', containerEl = null, scrollEl = null }) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();

  if (mode === 'fixed') {
    const left = rect.right + popupW > window.innerWidth
      ? Math.max(8, rect.right - popupW)
      : rect.left;
    const spaceBelow = window.innerHeight - (rect.bottom + 8);
    const top = spaceBelow < popupH
      ? Math.max(8, rect.top - popupH - 6)
      : rect.bottom + 6;
    return { position: 'fixed', top, left };
  }

  // mode === 'absolute'
  if (!containerEl) return null;
  const boxRect = containerEl.getBoundingClientRect();
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;

  let left = rect.left - boxRect.left;
  left = Math.min(Math.max(8, left), boxRect.width - popupW - 8);

  const scrollBottom = scrollEl
    ? Math.min(scrollEl.getBoundingClientRect().bottom, window.innerHeight)
    : window.innerHeight;
  const spaceBelow = scrollBottom - rect.bottom - 8;

  const absBottom = rect.bottom - boxRect.top + scrollTop;
  const absTop    = rect.top    - boxRect.top + scrollTop;

  const top = spaceBelow >= popupH
    ? absBottom + 6
    : absTop - popupH - 6;

  return { position: 'absolute', top: Math.max(8, top), left };
}
