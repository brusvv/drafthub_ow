// @hash 14289c81 2026-07-03T20:00
// ════ SHEETS IMPORT — ПАРСЕРЫ (IMPORT-1b) ════
// Вынесено из sheets-import.js (FILESPLIT-1, 03.07 — файл разросся до
// 478 строк после MIGR-6). Чистые функции, без сети — принимают rows
// (string[][], rows[0]=заголовок) и собирают объекты в формате готовом
// для UPSERT. Логика резолва id — sheets-import-resolve.js, запись —
// sheets-import.js.

// "Ana:8,Baptiste:7" → [{name:'Ana',score:8},{name:'Baptiste',score:7}]
// Пустая строка/мусор в одном элементе не валит весь парсинг — просто
// пропускается (toString().trim() защищает от undefined ячеек).
function _parseCounters(str){
  if(!str) return [];
  return String(str).split(',')
    .map(s => s.trim()).filter(Boolean)
    .map(pair => {
      const [name, scoreRaw] = pair.split(':').map(x => x?.trim());
      const score = parseInt(scoreRaw, 10);
      // Без числового score после ':' запись считаем мусором/опечаткой,
      // не угадываем дефолт — реальные данные всегда "Name:score"
      return (name && Number.isFinite(score)) ? { name, score } : null;
    })
    .filter(Boolean);
}

// 'TRUE'/'true'/'1' → true, всё остальное (включая пусто) → false
function _parseBoolTrue(str){
  const s = String(str || '').trim().toLowerCase();
  return s === 'true' || s === '1';
}

// "Tracer;Genji;Ana" → ['Tracer','Genji','Ana']  (для PlayerHeroes, если
// где-то понадобится строка вместо отдельных строк-листа — сейчас не
// используется т.к. PlayerHeroes хранит по одной паре player/hero на строку,
// но оставляю как общий хелпер для согласованности с экспортным форматом)
function _parseSemicolonList(str){
  if(!str) return [];
  return String(str).split(';').map(s => s.trim()).filter(Boolean);
}

// rows (string[][], rows[0]=header) → [{col1:val1,col2:val2,...}, ...]
// Header матчится по позиции по ожидаемому списку колонок (case-insensitive,
// trim) — НЕ полагаемся на точный порядок колонок в реальном листе, мапим
// по имени, если порядок в боевой таблице вдруг отличается от REQUIRED_SHEETS.
function _rowsToObjects(rows, expectedCols){
  if(!rows || rows.length < 2) return [];
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const colIdx = {};
  expectedCols.forEach(col => {
    const idx = header.indexOf(col.toLowerCase());
    colIdx[col] = idx;   // -1 если колонки нет в листе — поле останется undefined
  });
  return rows.slice(1)
    .filter(r => r.some(cell => String(cell || '').trim()))   // пропускаем полностью пустые строки
    .map(r => {
      const obj = {};
      expectedCols.forEach(col => { obj[col] = colIdx[col] >= 0 ? r[colIdx[col]] : undefined; });
      return obj;
    });
}
