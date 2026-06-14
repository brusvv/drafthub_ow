// @hash d404ca23 2026-06-14T08:30
// ════ SCORING — MAPS ════
// Скоринг карт на основе HeroMapStrength

const TIER_WEIGHT={S:5,A:4,B:3,C:2,D:1};

/**
 * Сила героя на карте с учётом стороны.
 * @param {string} heroName
 * @param {object} map   — объект карты
 * @param {string} side  — 'atk'|'def'|'avg'
 * @returns {number} 0–10
 */
function heroStrengthOnMap(heroName, map, side='avg'){
  const entry=(heroMapStrength[heroName]||{})[map.name];
  if(!entry)return 0;
  if(side==='atk')return entry.atk||0;
  if(side==='def')return entry.def||0;
  return entry.avg||0;
}

/**
 * Скор карты для набора героев.
 * @param {string[]} heroNames
 * @param {string[]} mainHeroes — вес ×2
 * @param {object[]} mapsData
 * @param {string}   side — 'atk'|'def'|'avg'
 * @returns {Array<{name,score,type,tier,atk,def}>}
 */
function scoreMaps(heroNames, mainHeroes, mapsData, side='avg'){
  return mapsData.map(m=>{
    let score=0;
    heroNames.forEach(hn=>{
      const str=heroStrengthOnMap(hn,m,side);
      if(!str)return;
      const w=mainHeroes.includes(hn)?2:1;
      score+=str*w;
    });
    return{name:m.name,score:Math.round(score),type:m.type,tier:m.tier,
      atk:m.atk,def:m.def,dif:m.dif};
  }).filter(m=>m.score>0);
}

/**
 * Топ-N героев для карты по стороне.
 * Используется для авто-preferred в карточке карты.
 * @param {object} map
 * @param {string} side  — 'atk'|'def'|'avg'
 * @param {number} limit
 * @returns {Array<{name,score,role}>}
 */
function topHeroesForMap(map, side='avg', limit=3){
  return heroes
    .filter(h=>!h.banned)
    .map(h=>({
      name:h.name,
      role:h.role,
      score:heroStrengthOnMap(h.name,map,side)
    }))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

/**
 * Сортировка карт: score desc, потом tier desc.
 */
function sortMapsByScore(arr){
  return arr.slice().sort((a,b)=>{
    if(b.score!==a.score)return b.score-a.score;
    return(TIER_WEIGHT[b.tier]||0)-(TIER_WEIGHT[a.tier]||0);
  });
}
