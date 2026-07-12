// @hash 8ecb9fac 2026-07-12T07:02
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
