// @hash a64e3631 2026-07-15T00:21
// ════════════════════════════════════════════════════════════
// modal-focus.js — стек открытых попапов + клавиатурная навигация
// Выделено из render-utils.js (watch-list, AGENT_TASKS.md) —
// этот кластер не про "рендер разметки", а про то, что происходит
// с фокусом/клавиатурой поверх уже отрисованных модалок.
//
// • modalStack            — стек открытых попапов
// • closeTopModal()       — Escape → закрыть верхний попап
// ════════════════════════════════════════════════════════════

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
