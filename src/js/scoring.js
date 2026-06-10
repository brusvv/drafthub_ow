// ════════════════════════════════════════════════════════════
// scoring.js — вся логика скоринга карт и банов
//
// Принципы:
//   • Чистые функции — не читают глобальные переменные напрямую
//   • Принимают данные аргументами, возвращают результат
//   • Один scoreHeroVsMap(hero, map, isMain) → number
//   • Одна scoreBans(heroList, heroMap) → BanScore[]
//   • computePlayerRecs и computeRosterRecs — тонкие обёртки над ними
// ════════════════════════════════════════════════════════════

const TIER_WEIGHT = { S:5, A:4, B:3, C:2, D:1 };
const BAN_THRESHOLD  = 6;   // средний скор контрпика для попадания в рекомендации
const BAN_THRESHOLD_HARD = 8; // «точно банить»

// ── Базовые примитивы ────────────────────────────────────────

/**
 * Скор героя относительно карты.
 * @param {object} hero     — объект героя из heroMap
 * @param {object} map      — объект карты
 * @param {boolean} isMain  — основной герой (вес ×2)
 * @returns {number} положительный = сильная карта, отрицательный = слабая
 */
function scoreHeroVsMap(hero, map, isMain) {
  const w = isMain ? 2 : 1;
  const strong = (hero.strongMaps || []).includes(map.name);
  const weak   = (hero.weakMaps   || []).includes(map.name);
  if (strong) return  w;
  if (weak)   return -w;
  return 0;
}

/**
 * Скор одного героя как контрпика (по полю counters).
 * @param {string}   targetName — имя героя-контрпика
 * @param {object}   hero       — герой из нашего пула
 * @returns {number|null} скор или null если не контрит
 */
function scoreHeroCounter(targetName, hero) {
  const entry = (hero.counters || []).find(c => c.name === targetName);
  return entry ? entry.score : null;
}

/**
 * Сортировка карт: сначала по score, потом по tier.
 */
function sortMapsByScore(arr) {
  return arr.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (TIER_WEIGHT[b.tier] || 0) - (TIER_WEIGHT[a.tier] || 0);
  });
}

// ── Агрегаторы ───────────────────────────────────────────────

/**
 * Подсчёт банов по списку героев (имена).
 * @param {string[]} heroNames — герои из пула игрока/состава
 * @param {object}   heroMapData — { name -> heroObj }
 * @param {string[]} mainHeroes — подмножество основных (влияет на вес)
 * @returns {Array<{name, score, count, avg}>}
 */
function scoreBans(heroNames, heroMapData, mainHeroes = []) {
  const acc = {};
  heroNames.forEach(hn => {
    const h = heroMapData[hn]; if (!h) return;
    const w = mainHeroes.includes(hn) ? 2 : 1;
    (h.counters || []).forEach(c => {
      if (!acc[c.name]) acc[c.name] = { name: c.name, score: 0, count: 0 };
      acc[c.name].score += c.score * w;
      acc[c.name].count++;
    });
  });
  return Object.values(acc).map(b => ({
    ...b,
    avg: b.count ? Math.round(b.score / b.count) : 0,
  }));
}

/**
 * Подсчёт скора карт по списку героев.
 * @param {string[]} heroNames
 * @param {string[]} mainHeroes
 * @param {object[]} mapsData
 * @param {object}   heroMapData
 * @returns {Array<{name, score, type, tier}>}
 */
function scoreMaps(heroNames, mainHeroes, mapsData, heroMapData) {
  const acc = {};
  mapsData.forEach(m => {
    let score = 0;
    heroNames.forEach(hn => {
      const h = heroMapData[hn]; if (!h) return;
      score += scoreHeroVsMap(h, m, mainHeroes.includes(hn));
    });
    if (score !== 0) acc[m.name] = { name: m.name, score, type: m.type, tier: m.tier };
  });
  return Object.values(acc);
}

// ── Высокоуровневые рекомендации ─────────────────────────────

/**
 * Рекомендации для одного игрока.
 * Заменяет computePlayerRecs() в render-players.js.
 */
function _scorePlayerRecs(player, mapsData, heroMapData) {
  const allHeroes = [...new Set([...player.mainHeroes, ...player.poolHeroes])];
  const main      = player.mainHeroes;

  const bans    = scoreBans(allHeroes, heroMapData, main);
  const recBans = bans
    .filter(b => b.avg >= BAN_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const mapScores  = scoreMaps(allHeroes, main, mapsData, heroMapData);
  const recMaps    = sortMapsByScore(mapScores.filter(m => m.score > 0)).slice(0, 12);
  const avoidMaps  = mapScores.filter(m => m.score < 0).sort((a, b) => a.score - b.score).slice(0, 4);

  return { recBans, recMaps, avoidMaps };
}

/**
 * Рекомендации для состава (несколько игроков).
 * Заменяет computeRosterRecs() в render-roster.js.
 *
 * @param {object[]} rosterPlayers
 * @param {Function} getHeroListFn  — (player) => string[] — учитывает выбранную роль
 * @param {object[]} mapsData
 * @param {object}   heroMapData
 */
function _scoreRosterRecs(rosterPlayers, getHeroListFn, mapsData, heroMapData) {
  const banAcc = {};

  rosterPlayers.forEach(p => {
    const heroes = getHeroListFn(p);
    const bans   = scoreBans(heroes, heroMapData, p.mainHeroes);
    bans.forEach(b => {
      if (!banAcc[b.name]) banAcc[b.name] = { name: b.name, totalScore: 0, count: 0, players: 0 };
      banAcc[b.name].totalScore += b.score;
      banAcc[b.name].count      += b.count;
      banAcc[b.name].players++;
    });
  });

  const bans = Object.values(banAcc)
    .map(b => ({ ...b, avg: Math.round(b.totalScore / b.count) }))
    .filter(b => b.avg >= BAN_THRESHOLD)
    .sort((a, b) => b.players - a.players || b.avg - a.avg)
    .slice(0, 8);

  const mapAcc = {};
  rosterPlayers.forEach(p => {
    const heroes     = getHeroListFn(p);
    const mapScores  = scoreMaps(heroes, p.mainHeroes, mapsData, heroMapData);
    mapScores.forEach(m => {
      if (!mapAcc[m.name]) mapAcc[m.name] = { name: m.name, score: 0, type: m.type, tier: m.tier };
      mapAcc[m.name].score += m.score;
    });
  });

  const mapArr = Object.values(mapAcc);
  return {
    bans,
    maps:  sortMapsByScore(mapArr.filter(m => m.score > 0)).slice(0, 8),
    avoid: mapArr.filter(m => m.score < 0).sort((a, b) => a.score - b.score).slice(0, 4),
  };
}

/**
 * Жертвы бана — какие герои наших игроков контрит конкретный противник.
 * Заменяет getBanVictims() в render-roster.js.
 */
function _scoreBanVictims(banName, rosterPlayers, getHeroListFn, heroMapData) {
  const victims = [];
  rosterPlayers.forEach(p => {
    getHeroListFn(p).forEach(hn => {
      const h = heroMapData[hn]; if (!h) return;
      const c = (h.counters || []).find(x => x.name === banName);
      if (c) victims.push({ player: p.name, hero: hn, score: c.score, isMain: p.mainHeroes.includes(hn) });
    });
  });
  return victims.sort((a, b) => b.score - a.score);
}

// ── Алиасы для вызовов из render-файлов ─────────────────────
// render-файлы вызывают _scoring-версии чтобы не конфликтовать
// с оригинальными именами функций во время переходного периода
const computePlayerRecs_scoring  = _scorePlayerRecs;
const computeRosterRecs_scoring  = _scoreRosterRecs;
const getBanVictims_scoring      = _scoreBanVictims;
