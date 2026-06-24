// @hash cdca0436 2026-06-24T20:44
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
// • esc()                 — экранирование строк в HTML-атрибутах
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
        <div class="skeleton-line sk-title" style="flex:1"></div>
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
