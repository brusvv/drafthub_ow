// @hash 454f7b12 2026-07-19T00:26
// ════════════════════════════════════════════════════════════
// notifications.js — уведомления и обработка ошибок
// Выделено из render-utils.js (watch-list, AGENT_TASKS.md).
//
// • toast()               — всплывающее уведомление
// • showError()            — ошибка в контейнере
// • handleError()          — единый обработчик ошибок Supabase
// ════════════════════════════════════════════════════════════

// ── Store proxy для toast-таймера ───────────────────────────
// toastT живёт здесь, а не в render-nav, потому что toast() тоже здесь.
Object.defineProperties(window, {
  toastT: { get(){ return store.get('toastT'); }, set(v){ store.set('toastT',v); }, configurable:true },
});

// Всплывающее уведомление (type: 'ok' | 'err')
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3000);
}

// Ошибка внутри контейнера (заменяет его содержимое). msg экранируется —
// это функция для отображения ТЕКСТА ошибки, не для доверенного HTML
// (внешний аудит, 18.07: раньше без экранирования вообще — сейчас
// единственный видимый мне call site передаёт статичную строку, но
// функция не должна полагаться на то, что так будет всегда).
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="error-state">⚠ ${escAttr(msg)}</div>`;
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
