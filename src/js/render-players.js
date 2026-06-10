// ════ HELPERS ════

const TIER_WEIGHT={S:5,A:4,B:3,C:2,D:1};
function sortMaps(arr){
  return arr.slice().sort((a,b)=>{
    if(b.score!==a.score)return b.score-a.score;
    return (TIER_WEIGHT[b.tier]||0)-(TIER_WEIGHT[a.tier]||0);
  });
}
function computePlayerRecs(p){
  const allHeroes=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  const banScores={};
  allHeroes.forEach(hn=>{
    const h=heroMap[hn];if(!h)return;
    (h.counters||[]).forEach(c=>{
      if(!banScores[c.name])banScores[c.name]={name:c.name,score:0,count:0};
      banScores[c.name].score+=c.score;banScores[c.name].count++;
    });
  });
  const recBans=Object.values(banScores).filter(b=>b.score/b.count>=6).sort((a,b)=>b.score-a.score).slice(0,6);
  const mapScores={};
  maps.forEach(m=>{
    let score=0;
    allHeroes.forEach(hn=>{
      const h=heroMap[hn];if(!h)return;
      if((h.strongMaps||[]).includes(m.name))score+=p.mainHeroes.includes(hn)?2:1;
      if((h.weakMaps||[]).includes(m.name))score-=1;
    });
    if(score>0)mapScores[m.name]={name:m.name,score,type:m.type,tier:m.tier};
  });
  const recMaps=sortMaps(Object.values(mapScores)).slice(0,6);
  const avoidScores={};
  maps.forEach(m=>{
    let score=0;
    allHeroes.forEach(hn=>{
      const h=heroMap[hn];if(!h)return;
      if((h.weakMaps||[]).includes(m.name))score+=p.mainHeroes.includes(hn)?2:1;
    });
    if(score>0)avoidScores[m.name]={name:m.name,score,type:m.type,tier:m.tier};
  });
  const avoidMaps=Object.values(avoidScores).sort((a,b)=>b.score-a.score).slice(0,4);
  return{recBans,recMaps:sortMaps(Object.values(mapScores)),avoidMaps};
}
 
// ── Парсинг и сравнение рангов ──
const RANK_ORDER=['Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Champion'];
const DIV_ORDER=[5,4,3,2,1]; // 5 — низший, 1 — высший

function parseRank(str){
  if(!str)return -1;
  const parts=str.trim().split(/\s+/);
  const tier=RANK_ORDER.indexOf(parts[0]);
  if(tier<0)return -1;
  const div=parseInt(parts[1]);
  const divScore=Number.isFinite(div)?DIV_ORDER.indexOf(div):0;
  return tier*10+(divScore>=0?divScore:0);
}

// Для Flex-игрока выбирает топ-5 по формуле 2+2+1
// Первые 2 — роль с наибольшим рангом, следующие 2 — вторая роль, 1 — третья
// Если ранги равны — берём по тир-листу героев
function flexTop5(p){
  const roles=['Tank','Damage','Support'];
  const rankScores={
    Tank: parseRank(p.rankTank),
    Damage: parseRank(p.rankDmg),
    Support: parseRank(p.rankSup),
  };

  // Сортируем роли по рангу (убывание), при равенстве — порядок не меняем
  const sorted=[...roles].sort((a,b)=>rankScores[b]-rankScores[a]);

  // Пул героев игрока по ролям, отсортированных по тиру
  function heroesForRole(role){
    const pool=[...new Set([...p.mainHeroes,...p.poolHeroes])];
    return pool
      .filter(n=>{const h=heroMap[n];return h&&h.role===role;})
      .sort((a,b)=>{
        // S>A>B>C>D по tierOrderHeroes
        const tierVal={S:5,A:4,B:3,C:2,D:1};
        const tierOf=name=>{
          for(const [t,ns] of Object.entries(tierOrderHeroes)){if(ns.includes(name))return tierVal[t]||0;}
          return 0;
        };
        return tierOf(b)-tierOf(a);
      });
  }

  const quotas=[2,2,1];
  const result=[];
  sorted.forEach((role,i)=>{
    const need=quotas[i]||0;
    const candidates=heroesForRole(role);
    result.push(...candidates.slice(0,need));
  });
  return result.slice(0,5);
}

function renderPlayers(){
  const grid=document.getElementById('playerGrid');
  if(!grid)return;
  const detail=document.getElementById('playerDetail');
  detail.classList.remove('show');detail.innerHTML='';
  if(!players.length){grid.innerHTML='<div class="empty">Нет игроков. Нажми "+ Игрок".</div>';return}
  grid.innerHTML=players.map(p=>{
    const isFlex=p.mainRole==='Flex';
    const mainH=isFlex ? flexTop5(p) : p.mainHeroes.slice(0,5);
    const hasOff=p.offRole&&p.offRole!==p.mainRole;
    let roleBlock='';
    if(isFlex)roleBlock=`<div class="player-role-icon flex">${roleIcon(p.mainRole,48)}</div>`;
    else if(hasOff)roleBlock=`<div class="player-role-icon two">${roleIcon(p.mainRole,28)}${roleIcon(p.offRole,22)}</div>`;
    else if(p.mainRole)roleBlock=`<div class="player-role-icon one">${roleIcon(p.mainRole,36)}</div>`;
    return`<div class="player-card" onclick="showPlayerDetail('${esc(p.name)}')">
      <div class="player-card-top">
        <div class="player-av">${p.name[0].toUpperCase()}</div>
        <div><div class="player-name">${p.name}</div><div class="player-btag">${p.btag||'—'}</div></div>
        ${roleBlock}
      </div>
      <div class="player-card-heroes">
        ${mainH.map(n=>{const src=portrait(n);return src?`<img src="${src}" class="mini-av" title="${n}" onerror="this.outerHTML='<div class=mini-av-ph>${n[0]}</div>'">`:`<div class="mini-av-ph">${n[0]}</div>`;}).join('')}
        ${!mainH.length?'<span style="font-size:11px;color:var(--text3)">Герои не указаны</span>':''}
      </div>
    </div>`;
  }).join('');
}
 
function showPlayerDetail(name){
  const p=players.find(x=>x.name===name);if(!p)return;
  document.getElementById('playerGrid').innerHTML='';
  const detail=document.getElementById('playerDetail');
  detail.classList.add('show');
  const ranks=[];
  if(p.rankTank)ranks.push({role:'Tank',val:p.rankTank});
  if(p.rankDmg)ranks.push({role:'Damage',val:p.rankDmg});
  if(p.rankSup)ranks.push({role:'Support',val:p.rankSup});
  const isFlex=p.mainRole==='Flex';
  const hasOff=p.offRole&&p.offRole!==p.mainRole;
  const pool=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  const byRole={Tank:[],Damage:[],Support:[]};
  pool.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push({name:n,isMain:!isFlex&&p.mainHeroes.includes(n)})});
  let roleIconHtml='';
  if(isFlex)roleIconHtml=`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${roleIcon('Flex',56)}<span style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:var(--accent)">Flex</span></div>`;
  else if(hasOff)roleIconHtml=`<div style="display:flex;flex-direction:column;align-items:center;gap:3px">${roleIcon(p.mainRole,40)}${roleIcon(p.offRole,28)}</div>`;
  else if(p.mainRole)roleIconHtml=`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${roleIcon(p.mainRole,44)}<span style="font-family:var(--mono);font-size:9px;text-transform:uppercase;color:${rc[p.mainRole]||'var(--accent)'}"> ${p.mainRole}</span></div>`;
  const poolHtml=['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div style="margin-bottom:.75rem">
      <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:${rc[r]};margin-bottom:5px">${r}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${byRole[r].map(({name:n,isMain})=>{
        const src=portrait(n);const border=isMain?'var(--accent)':'var(--border)';
        return`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          ${src?`<img src="${src}" title="${n}" style="width:44px;height:44px;border-radius:7px;object-fit:cover;border:2px solid ${border}" onerror="this.outerHTML='<div style=width:44px;height:44px;border-radius:7px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;border:2px solid ${border}>${n[0]}</div>'">`:`<div style="width:44px;height:44px;border-radius:7px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--text3);border:2px solid ${border}">${n[0]}</div>`}
          <div style="width:5px;height:5px;border-radius:50%;background:${isMain?'var(--accent)':'transparent'}"></div>
        </div>`;
      }).join('')}</div>
    </div>`).join('')||'<div class="empty">Герои не указаны</div>';
  const recs=computePlayerRecs(p);
  const recBansHtml=recs.recBans.length?recs.recBans.map(b=>{
    const src=portrait(b.name);const h=heroMap[b.name]||{};
    const avg=Math.round(b.score/b.count);const color=avg>=8?'var(--damage)':avg>=6?'var(--accent)':'var(--text3)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--bg3);border:1px solid ${avg>=8?'rgba(224,85,85,.3)':'var(--border)'}">
      ${src?`<img src="${src}" style="width:36px;height:36px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:36px;height:36px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">${b.name[0]}</div>`}
      <span style="font-size:13px;font-weight:700;flex:1">${b.name}</span>
      ${h.role?`<div style="display:flex;align-items:center;gap:4px">${roleIcon(h.role,16)}${subroleIcon(h.role,h.subrole,16)}<span style="font-family:var(--mono);font-size:10px;color:var(--text2)">${h.subrole||''}</span></div>`:''}
    </div>`;
  }).join(''):'<div class="empty">Нет данных</div>';
  const recMapsHtml=recs.recMaps.length?recs.recMaps.map(m=>`
    <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3);border:1px solid rgba(43,189,142,.25)">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--support);flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${m.type}</span>
      <div class="tier-badge tier-${m.tier}" style="font-size:9px;padding:1px 5px">${m.tier}</div>
    </div>`).join(''):'<div class="empty">Нет данных о картах героев</div>';
  const avoidMapsHtml=recs.avoidMaps.length?recs.avoidMaps.map(m=>`
    <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3);border:1px solid rgba(224,85,85,.2)">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--damage);flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${m.type}</span>
      <span style="font-family:var(--mono);font-size:9px;font-weight:700;color:var(--damage)">−${Math.abs(m.score)}</span>
    </div>`).join(''):'';
  detail.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem 1.75rem">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:60px;height:60px;border-radius:50%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:var(--text2);border:2px solid var(--border2)">${p.name[0].toUpperCase()}</div>
          <div>
            <div style="font-size:22px;font-weight:800;margin-bottom:4px">${p.name}</div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${p.btag||'Battle.net tag не указан'}</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              ${p.mainRole?`<span class="role-tag ${p.mainRole}">Основная: ${p.mainRole}</span>`:''}
              ${p.offRole?`<span class="role-tag ${p.offRole}">Офф: ${p.offRole}</span>`:''}
            </div>
          </div>
          <div style="margin-left:12px">${roleIconHtml}</div>
        </div>
        <button class="btn" onclick="openPlayerModal(players.find(x=>x.name==='${esc(p.name)}'))">✎ Редактировать</button>
      </div>
      ${ranks.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">${ranks.map(r=>`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center"><div style="font-family:var(--mono);font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:3px">${r.role}</div><div style="font-family:var(--mono);font-size:13px;font-weight:700;color:${rc[r.role]}">${r.val}</div></div>`).join('')}</div>`:''}
    </div>
    <div class="detail-grid" style="margin-top:10px">
      <div class="d-card full">
        <div class="d-card-title">Пул героев <span style="color:var(--accent);font-size:8px;margin-left:6px">● Основные</span></div>
        ${poolHtml}
      </div>
      <div class="d-card">
        <div class="d-card-title">🔴 Рекомендованные баны</div>
        <div style="display:flex;flex-direction:column;gap:4px">${recBansHtml}</div>
      </div>
      <div class="d-card">
        <div class="d-card-title">✅ Предпочтительные карты</div>
        <div style="display:flex;flex-direction:column;gap:4px">${recMapsHtml}</div>
        ${avoidMapsHtml?`<div class="d-card-title" style="margin-top:12px;border:none;padding:0 0 8px">⚠ Сложные карты</div><div style="display:flex;flex-direction:column;gap:4px">${avoidMapsHtml}</div>`:''}
      </div>
      ${p.notes?`<div class="d-card full"><div class="d-card-title">Заметки</div><div class="notes-text">${p.notes}</div></div>`:''}
    </div>
    <button class="back-btn" onclick="backToPlayers()" style="margin-top:10px">← Назад к игрокам</button>`;
}
function backToPlayers(){document.getElementById('playerDetail').classList.remove('show');document.getElementById('playerDetail').innerHTML='';renderPlayers()}
