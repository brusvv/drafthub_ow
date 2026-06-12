// ════ SCORING — BANS ════

const BAN_THRESHOLD=5;
const BAN_THRESHOLD_HARD=8;

/**
 * Подсчёт скора контрпиков.
 * @param {string[]} heroNames — наш пул
 * @param {string[]} mainHeroes — подмножество основных
 * @returns {Array<{name,score,count,avg,role}>}
 */
function scoreBans(heroNames, mainHeroes=[]){
  const acc={};
  heroNames.forEach(hn=>{
    const h=heroMap[hn];if(!h)return;
    const w=mainHeroes.includes(hn)?2:1;
    (h.counters||[]).forEach(c=>{
      if(!acc[c.name])acc[c.name]={name:c.name,score:0,count:0};
      acc[c.name].score+=c.score*w;
      acc[c.name].count++;
    });
  });
  return Object.values(acc).map(b=>({
    ...b,
    avg:b.count?Math.round(b.score/b.count):0,
    role:(heroMap[b.name]||{}).role||''
  }));
}

/**
 * Герои нашего пула которых контрит конкретный противник.
 */
function scoreBanVictims(banName, heroNames, mainHeroes=[]){
  const victims=[];
  heroNames.forEach(hn=>{
    const h=heroMap[hn];if(!h)return;
    const c=(h.counters||[]).find(x=>x.name===banName);
    if(c)victims.push({hero:hn,score:c.score,isMain:mainHeroes.includes(hn)});
  });
  return victims.sort((a,b)=>b.score-a.score);
}

/**
 * Рекомендации банов одного игрока.
 */
function _scorePlayerBans(player){
  const all=[...new Set([...player.mainHeroes,...player.poolHeroes])];
  return scoreBans(all,player.mainHeroes)
    .filter(b=>b.avg>=BAN_THRESHOLD)
    .sort((a,b)=>b.score-a.score)
    .slice(0,6);
}

/**
 * Рекомендации банов для состава (несколько игроков).
 * @param {object[]} rosterPlayers
 * @param {Function} getHeroListFn  — (player) => string[]
 */
function scoreRosterBans(rosterPlayers, getHeroListFn){
  const acc={};
  rosterPlayers.forEach(p=>{
    const hs=getHeroListFn(p);
    scoreBans(hs,p.mainHeroes).forEach(b=>{
      if(!acc[b.name])acc[b.name]={name:b.name,totalScore:0,count:0,players:0,role:b.role};
      acc[b.name].totalScore+=b.score;
      acc[b.name].count+=b.count;
      acc[b.name].players++;
    });
  });
  return Object.values(acc)
    .map(b=>({...b,avg:Math.round(b.totalScore/b.count)}))
    .filter(b=>b.avg>=BAN_THRESHOLD)
    .sort((a,b)=>b.players-a.players||b.avg-a.avg)
    .slice(0,8);
}

/**
 * Полные рекомендации для одного игрока (баны + карты).
 */
function scorePlayerRecs(player, side='avg'){
  const all=[...new Set([...player.mainHeroes,...player.poolHeroes])];
  const main=player.mainHeroes;
  const recBans=_scorePlayerBans(player);
  const mapScores=scoreMaps(all,main,maps,side);
  const recMaps=sortMapsByScore(mapScores.filter(m=>m.score>0)).slice(0,12);
  const avoidMaps=mapScores.filter(m=>m.score<0).sort((a,b)=>a.score-b.score).slice(0,4);
  return{recBans,recMaps,avoidMaps};
}

/**
 * Полные рекомендации для состава.
 */
function scoreRosterRecs(rosterPlayers, getHeroListFn, side='avg'){
  const bans=scoreRosterBans(rosterPlayers,getHeroListFn);
  const mapAcc={};
  rosterPlayers.forEach(p=>{
    const hs=getHeroListFn(p);
    scoreMaps(hs,p.mainHeroes,maps,side).forEach(m=>{
      if(!mapAcc[m.name])mapAcc[m.name]={name:m.name,score:0,type:m.type,tier:m.tier};
      mapAcc[m.name].score+=m.score;
    });
  });
  const mapArr=Object.values(mapAcc);
  return{
    bans,
    maps:sortMapsByScore(mapArr.filter(m=>m.score>0)).slice(0,8),
    avoid:mapArr.filter(m=>m.score<0).sort((a,b)=>a.score-b.score).slice(0,4)
  };
}
