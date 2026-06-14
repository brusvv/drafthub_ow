// @hash f27b3d92 2026-06-14T08:30
// ════ SCORING — COMPOSITION RECOMMENDATIONS ════
// Рекомендации пика: топ-3 композиции для карты с учётом банов и синергий

/**
 * Синергия между двумя героями (из HeroSynergy).
 */
function heroSynergyScore(a, b){
  const fromA=(heroSynergy[a]||[]).find(x=>x.name===b);
  const fromB=(heroSynergy[b]||[]).find(x=>x.name===a);
  return Math.max(fromA?fromA.score:0, fromB?fromB.score:0);
}

/**
 * Суммарная синергия набора героев.
 */
function compSynergyTotal(heroNames){
  let total=0;
  for(let i=0;i<heroNames.length;i++){
    for(let j=i+1;j<heroNames.length;j++){
      total+=heroSynergyScore(heroNames[i],heroNames[j]);
    }
  }
  return total;
}

/**
 * Скор одной композиции (1 Tank + 2 Damage + 2 Support) для карты.
 * Учитывает: силу на карте, синергии, контрпики к врагам, приоритет.
 * @param {string[]} comp      — 5 имён [tank, dmg1, dmg2, sup1, sup2]
 * @param {object}   mapObj    — объект карты (может быть null)
 * @param {string}   side      — 'atk'|'def'|'avg'
 * @param {string[]} bans      — забаненные герои (исключены)
 * @param {string[]} enemyHeroes — вражеские герои (для контрпиков)
 * @returns {number}
 */
function scoreComposition(comp, mapObj, side='avg', bans=[], enemyHeroes=[]){
  if(comp.some(n=>bans.includes(n)))return -999;
  let score=0;
  comp.forEach(name=>{
    const h=heroMap[name];if(!h)return;
    // Сила на карте
    if(mapObj)score+=heroStrengthOnMap(name,mapObj,side)*1.5;
    // Приоритет (мета)
    score+=h.priority*0.5;
    // Контрпики к врагам
    enemyHeroes.forEach(en=>{
      const c=(h.counters||[]).find(x=>x.name===en);
      if(c)score+=c.score*0.8;
    });
  });
  // Синергии внутри состава
  score+=compSynergyTotal(comp)*0.7;
  return Math.round(score);
}

/**
 * Генерирует топ-N рекомендаций состава из пула игроков.
 * @param {object[]} rosterPlayers
 * @param {Function} getHeroListFn  — (player) => string[]
 * @param {object}   mapObj
 * @param {string}   side
 * @param {string[]} bans
 * @param {string[]} enemyHeroes
 * @param {number}   limit
 */
function recommendCompositions(rosterPlayers, getHeroListFn, mapObj, side='avg', bans=[], enemyHeroes=[], limit=3){
  // Собираем пулы по ролям
  const byRole={Tank:[],Damage:[],Support:[]};
  rosterPlayers.forEach(p=>{
    getHeroListFn(p).forEach(name=>{
      const h=heroMap[name];if(!h||bans.includes(name))return;
      if(byRole[h.role])byRole[h.role].push(name);
    });
  });
  // Убираем дубли, сортируем по силе на карте + приоритет
  const rank=(name)=>{
    const h=heroMap[name]||{};
    return(mapObj?heroStrengthOnMap(name,mapObj,side):0)*2+(h.priority||5);
  };
  ['Tank','Damage','Support'].forEach(r=>{
    byRole[r]=[...new Set(byRole[r])].sort((a,b)=>rank(b)-rank(a));
  });

  // Берём топ кандидатов для перебора (не больше 4 на роль → max 4×4×4 = 64 комбо)
  const tanks =byRole.Tank.slice(0,4);
  const dmgs  =byRole.Damage.slice(0,4);
  const sups  =byRole.Support.slice(0,4);

  const results=[];
  tanks.forEach(t=>{
    for(let di=0;di<dmgs.length;di++){
      for(let dj=di+1;dj<dmgs.length;dj++){
        for(let si=0;si<sups.length;si++){
          for(let sj=si+1;sj<sups.length;sj++){
            const comp=[t,dmgs[di],dmgs[dj],sups[si],sups[sj]];
            const sc=scoreComposition(comp,mapObj,side,bans,enemyHeroes);
            if(sc>0)results.push({comp,score:sc});
          }
        }
      }
    }
  });

  return results.sort((a,b)=>b.score-a.score).slice(0,limit);
}

/**
 * Рекомендации героев по ролям для пика (без генерации полных пятёрок).
 * Полезно когда пул маленький.
 */
function recommendPicksByRole(rosterPlayers, getHeroListFn, mapObj, side, bans, limit=3){
  const byRole={Tank:[],Damage:[],Support:[]};
  rosterPlayers.forEach(p=>{
    getHeroListFn(p).forEach(name=>{
      const h=heroMap[name];if(!h||bans.includes(name))return;
      if(byRole[h.role])byRole[h.role].push(name);
    });
  });
  const result={};
  ['Tank','Damage','Support'].forEach(role=>{
    result[role]=[...new Set(byRole[role])]
      .map(name=>{
        const h=heroMap[name]||{};
        const mapStr=mapObj?heroStrengthOnMap(name,mapObj,side):0;
        const syn=compSynergyTotal([name]);
        return{name,mapStr,priority:h.priority||5,score:mapStr*2+(h.priority||5)};
      })
      .sort((a,b)=>b.score-a.score)
      .slice(0,limit);
  });
  return result;
}
