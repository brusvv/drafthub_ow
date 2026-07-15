// @hash 4b02d393 2026-07-14T20:41
// ════════════════════════════════════════════════════════════
// render-utils.js — общие утилиты рендера
//
// • renderCurrentView()   — перерисовать активную вкладку
// • dots5()               — 5-точечный индикатор рейтинга
// • pluralRu()            — русское склонение числительных
// • heroesCountLabel()    — «3 героя», «7 героев»
// • modalStack            — стек открытых попапов
// • closeTopModal()       — Escape → закрыть верхний попап
// • showLoading()         — skeleton-loader для загрузки данных
// • toast()               — всплывающее уведомление
// • showError()           — ошибка в контейнере
// • esc()                 — экранирование ' для inline onclick="..."
// • escAttr()             — экранирование &/" для data-* HTML-атрибутов
// • computePopupAnchorPosition() — позиция popup рядом с anchor-элементом
//                           (viewport fixed ИЛИ absolute внутри скролл-контейнера)
// • handleError()         — единый обработчик ошибок Supabase
// ════════════════════════════════════════════════════════════

// ── Store proxy для toast-таймера ───────────────────────────
// toastT живёт здесь, а не в render-nav, потому что toast() тоже здесь.
Object.defineProperties(window, {
  toastT: { get(){ return store.get('toastT'); }, set(v){ store.set('toastT',v); }, configurable:true },
});

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

// ════════════════════════════════════════════════════════════
// ESCAPE → закрывает самый верхний открытый попап
// Попапы регистрируются через modalStack.push/pop.
// Любой код, открывающий оверлей, должен вызвать
//   modalStack.push({ close: fn })
// и убрать его при закрытии через modalStack.pop() или
// modalStack.remove(ref).
// ════════════════════════════════════════════════════════════
const modalStack = (() => {
  const stack = [];
  return {
    push(entry)  { stack.push(entry); },
    pop()        { return stack.pop(); },
    peek()       { return stack[stack.length - 1]; },
    remove(entry){ const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1); },
    get size()   { return stack.length; },
  };
})();

function closeTopModal() {
  if (modalStack.size > 0) {
    const top = modalStack.pop();
    if (top && typeof top.close === 'function') { top.close(); return; }
  }

  // Лёгкие дропдауны — проверяем первыми (открываются поверх всего)
  const dropdowns = ['appModePopup', 'teamSwitcherPopup'];
  for (const id of dropdowns) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
      return;
    }
  }

  const knownIds = [
    'compMapPopup',
    'rosterPickerBg',
    'mapStrPickerOverlay',
    'pickerOverlay',
    'counterPickerOverlay',
    'mapModal',
    'playerModal',
    'heroModal',
    'tierPreviewOverlay',
  ];
  for (const id of knownIds) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
      if (id === 'compMapPopup')         { el.remove(); return; }
      if (id === 'rosterPickerBg')       { el.remove(); return; }
      if (id === 'mapStrPickerOverlay')   { if (typeof closeMapStrPicker  === 'function') { closeMapStrPicker();  return; } }
      if (id === 'pickerOverlay')        { if (typeof closePicker         === 'function') { closePicker();        return; } }
      if (id === 'tierPreviewOverlay')   { if (typeof closeTierPreview    === 'function') { closeTierPreview();   return; } }
      if (id === 'counterPickerOverlay') { if (typeof closeCounterPicker  === 'function') { closeCounterPicker(); return; } }
      el.classList.add('hidden');
      return;
    }
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeTopModal(); }
});

// ════ ФОКУС-МЕНЕДЖМЕНТ МОДАЛОК (Design Audit #1, пункт 6) ════
// До этого фикса: ни одна модалка не ловила Tab — клавиатурный пользователь
// уводился фокусом в фон под открытой модалкой. Централизовано здесь (не
// в каждом open*Modal() по отдельности — их много и разбросаны по файлам,
// единой точки открытия нет) через MutationObserver на класс .hidden у
// .modal-overlay/.picker-overlay — работает для любой такой модалки без
// правок в остальных файлах.
// ⚠️ Не покрывает compMapPopup/rosterPickerBg (см. knownIds выше) — они
// создаются через insertAdjacentHTML и удаляются через .remove(), не
// toggle класса .hidden, другой паттерн. Отдельная задача, не в этом фиксе.
function _focusableIn(container){
  return Array.from(container.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

let _focusBeforeModal = null;

document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const modal = document.querySelector('.modal-overlay:not(.hidden), .picker-overlay:not(.hidden)');
  if (!modal) return;
  const list = _focusableIn(modal);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

new MutationObserver(muts => {
  muts.forEach(m => {
    const el = m.target;
    if (!el.classList || !(el.classList.contains('modal-overlay') || el.classList.contains('picker-overlay'))) return;
    if (!el.classList.contains('hidden')) {
      // Модалка только что открылась — запоминаем откуда пришли, фокусируем первое поле
      _focusBeforeModal = document.activeElement;
      const list = _focusableIn(el);
      if (list.length) list[0].focus();
    } else if (_focusBeforeModal) {
      // Закрылась — возвращаем фокус туда, откуда открыли (кнопка "+ Герой" и т.д.)
      _focusBeforeModal.focus();
      _focusBeforeModal = null;
    }
  });
}).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

// ════════════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ И ОШИБКИ
// ════════════════════════════════════════════════════════════

// Всплывающее уведомление (type: 'ok' | 'err')
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3000);
}

// Ошибка внутри контейнера (заменяет его содержимое)
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="error-state">⚠ ${msg}</div>`;
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

// Единый обработчик ошибок Supabase/JS.
// Supabase иногда кладёт сообщение в разные места — проверяем все.
// Использование: catch(e){ handleError(e); return; }
// С кастомным префиксом:  handleError(e, 'Не удалось сохранить карту')
function handleError(e, context = '') {
  const msg = e?.message
    || e?.result?.error?.message
    || e?.error?.message
    || e?.details
    || 'Неизвестная ошибка';
  const label = context ? `${context}: ${msg}` : `Ошибка: ${msg}`;
  toast(label, 'err');
  console.error(context || 'handleError', e);
  return msg;
}

// ════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ════════════════════════════════════════════════════════════

function showLoading(containerId, type = 'card', count = 6) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({ length: count }, () => _skeletonItem(type)).join('');
}

function _skeletonItem(type) {
  switch (type) {
    case 'player':
      return `<div class="skeleton-player">
        <div class="skeleton-line sk-avatar"></div>
        <div class="skeleton-body">
          <div class="skeleton-line sk-title"></div>
          <div class="skeleton-line sk-sub"></div>
          <div class="sk-heroes">
            ${Array.from({ length: 4 }, () => '<div class="skeleton-line sk-hero-icon"></div>').join('')}
          </div>
        </div>
      </div>`;

    case 'hero':
      return `<div class="skeleton-hero-card">
        <div class="skeleton-line sk-hero-portrait"></div>
        <div class="skeleton-line sk-title" style="margin-top:8px"></div>
        <div class="skeleton-line sk-sub" style="margin-top:4px"></div>
      </div>`;

    case 'row':
      return `<div class="skeleton-row">
        <div class="skeleton-line sk-avatar-sm"></div>
        <div class="skeleton-line sk-title flex-1"></div>
        <div class="skeleton-line sk-badge"></div>
      </div>`;

    case 'card':
    default:
      return `<div class="skeleton-card">
        <div class="skeleton-line sk-banner"></div>
        <div class="skeleton-line sk-title" style="margin-top:10px"></div>
        <div class="skeleton-line sk-sub" style="margin-top:6px"></div>
      </div>`;
  }
}
