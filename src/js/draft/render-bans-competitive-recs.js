// @hash 231e9778 2026-07-15T23:42
// ════════════════════════════════════════════════════════════
// render-bans-competitive-recs.js — рекомендации к бану
// (соревновательный режим банов)
//
// Вынесено из render-bans-competitive.js (FILESPLIT, 15.07, было 318
// строк) — расчёт скора чисто читает module-level состояние
// (compBanVotes/compBanMap/banDraftHeroes, core/store.js) и глобальные
// справочники (heroes/heroMap/maps), не пишет ничего сама. Единственная
// точка входа снаружи — _renderCompBanResult(), вызывается из
// _renderCompetitiveMode() в render-bans-competitive.js.
//
// Зависимости: heroes/heroMap (core/config.js), _renderBanRecs()
// (render-bans-core.js), compBanVotes/compBanMap/banDraftHeroes (core/store.js).
// ════════════════════════════════════════════════════════════

function _renderCompBanResult() {
  if (!Object.keys(compBanVotes).length && !banDraftHeroes.length && !compBanMap) return '';

  const selectedMap = maps.find(m => m.name === compBanMap);
  const recs        = _computeCompRecs(selectedMap);

  return `
    <div class="ban-recs-header" style="margin-top:4px">
      <span class="ban-recs-title">Рекомендации к бану</span>
      <span class="ban-recs-algo-hint">по контрпикам и силе на карте</span>
    </div>
    ${_renderBanRecs(recs)}`;
}

/**
 * Считает итоговый скор каждого небаненного героя
 * из голосов команды + контрпиков + силы на карте.
 * @param {object|undefined} selectedMap
 * @returns {Array<{hero, score, reasons}>}
 */
function _computeCompRecs(selectedMap) {
  const VOTE_WEIGHTS = { 1: 7, 2: 5, 3: 3 };

  return heroes
    .filter(h => !h.banned)
    .map(h => {
      let score = 0;
      const reasons = [];

      // Голос команды
      const p = compBanVotes[h.name];
      if (p) {
        score += (VOTE_WEIGHTS[p] || 0) * 1.5;
        reasons.push({ type: 'meta', text: `Приоритет P${p}` });
      }

      // Контрпики наших героев
      let counterWeight = 0;
      const paired = [];
      banDraftHeroes.forEach(hn => {
        const our = heroMap[hn]; if (!our) return;
        const c = (our.counters || []).find(x => x.name === h.name);
        if (c) { counterWeight += c.score; paired.push({ hero: hn, score: c.score }); }
      });
      if (counterWeight > 0) {
        score += counterWeight * 2;
        const top = paired.sort((a, b) => b.score - a.score).slice(0, 2);
        reasons.push({ type: 'counter', text: 'Контрит: ' + top.map(p => p.hero).join(', ') });
      }

      // Сила на карте матча
      if (selectedMap) {
        if ((h.strongMaps || []).includes(selectedMap.name)) {
          score += 5;
          reasons.push({ type: 'mapStrong', text: `Силён: ${selectedMap.name}` });
        }
        if ((selectedMap.counters || []).includes(h.name)) {
          score += 2;
          reasons.push({ type: 'mapBan', text: 'Бан-лист карты' });
        }
      }

      // Мета-вес героя
      score += h.priority * 0.4;

      return { hero: h, score: Math.round(score), reasons };
    })
    .filter(r => r.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
