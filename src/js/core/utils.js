// ════ CORE UTILS ════
// Чистые хелперы без состояния. Держим здесь повторяемые функции, которые
// не относятся к store/config и должны быть доступны всем модулям после core.

/**
 * Возвращает цвет оценки по единой шкале low/mid/high.
 * По умолчанию: 8+ — high, 5+ — mid, иначе low.
 */
function scoreColor(value, {
  high = 'var(--damage)',
  mid = 'var(--accent)',
  low = 'var(--text3)',
  highAt = 8,
  midAt = 5
} = {}){
  return value >= highAt ? high : value >= midAt ? mid : low;
}

function appPath(path = ''){
  const suffix = String(path || '');
  if(!suffix || suffix === '/') return BASE_PATH + '/';
  return BASE_PATH + (suffix.startsWith('/') ? suffix : '/' + suffix);
}

function buildAppUrl(path = ''){
  return window.location.origin + appPath(path);
}

function formatShortLabel(value, max = 9){
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function clampInt(value, min, max, fallback = min){
  const parsed = parseInt(value, 10);
  const n = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, n));
}
