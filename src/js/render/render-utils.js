// ════════════════════════════════════════════════════════════
// render-utils.js — общие утилиты рендера
//
// • renderCurrentView()   — перерисовать активную вкладку
// • dots5()               — 5-точечный индикатор рейтинга
// • pluralRu()            — русское склонение числительных
// • heroesCountLabel()    — «3 героя», «7 героев»
// • Escape → closeTopModal() — единый обработчик закрытия попапов
// • skeletonGrid()        — skeleton-loader для загрузки данных
// ════════════════════════════════════════════════════════════

// ── Точка перерисовки активной вкладки ──────────────────────
function renderCurrentView() {
  const a = document.querySelector('.view.active'); if (!a) return;
  const id = a.id;
  if (id === 'view-maps')    renderMaps();
  if (id === 'view-heroes')  renderHeroes();
  if (id === 'view-tiers')   renderTiers();
  if (id === 'view-bans')    renderBans();
  if (id === 'view-players') renderPlayers();
  if (id === 'view-roster')  renderRoster();
  if (id === 'view-settings') renderTeamSettings();
  if (id === 'view-admin')    renderAdmin();
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
  // Fallback: если стек пустой, пробуем известные попапы по id
  if (modalStack.size > 0) {
    const top = modalStack.pop();
    if (top && typeof top.close === 'function') { top.close(); return; }
  }

  // Известные оверлеи по убыванию приоритета
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
      // Пытаемся закрыть через known close-функции
      if (id === 'compMapPopup')        { el.remove(); return; }
      if (id === 'rosterPickerBg')      { el.remove(); return; }
      if (id === 'mapStrPickerOverlay')  { if (typeof closeMapStrPicker === 'function') { closeMapStrPicker(); return; } }
      if (id === 'pickerOverlay')       { if (typeof closePicker === 'function') { closePicker(); return; } }
      if (id === 'tierPreviewOverlay')  { if (typeof closeTierPreview === 'function') { closeTierPreview(); return; } }
      if (id === 'counterPickerOverlay'){ if (typeof closeCounterPicker === 'function') { closeCounterPicker(); return; } }
      // Generic modals: скрываем
      el.classList.add('hidden');
      return;
    }
  }
}

// Единый слушатель — вешается один раз
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTopModal();
  }
});

// ════════════════════════════════════════════════════════════
// SKELETON LOADERS
// Показываются пока данные не загружены.
// Используй showLoading(containerId, 'player'|'card'|'row', count)
// ════════════════════════════════════════════════════════════

/**
 * Вставляет skeleton-заглушки в контейнер.
 * @param {string} containerId  — id DOM-элемента
 * @param {'player'|'card'|'row'|'hero'} type — форм-фактор
 * @param {number} count        — количество заглушек
 */
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
