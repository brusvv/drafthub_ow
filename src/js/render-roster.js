let rosterRoles={};  // { playerName: 'Tank'|'Damage'|'Support'|null }
let rosterRoleOpen={}; // { playerName: true/false } — whether picker is open

function getRosterRole(name){
  return rosterRoles[name]||null;
}
function toggleRosterRolePicker(name){
  if(rosterRoleOpen[name]){
    // clicking active icon → reopen all
    rosterRoleOpen[name]=true;
  } else {
    rosterRoleOpen[name]=!rosterRoleOpen[name];
  }
  renderRoster();
}
function setRosterRole(pname,role){
  rosterRoles[pname]=role;
  rosterRoleOpen[pname]=false;
  renderRoster();
}
function clearRosterRole(pname){
  delete rosterRoles[pname];
  rosterRoleOpen[pname]=true;
  renderRoster();
}
let rosterPlayers=[];
let openBanDetail=null;

// Кто из наших героев уязвим к данному бан-герою
function getBanVictims(banName){
  const victims=[];
  rosterPlayers.forEach(p=>{
    const allH=[...new Set([...p.mainHeroes,...p.poolHeroes])];
    allH.forEach(hn=>{
      const h=heroMap[hn];if(!h)return;
      const c=(h.counters||[]).find(x=>x.name===banName);
      if(c)victims.push({player:p.name,hero:hn,score:c.score,isMain:p.mainHeroes.includes(hn)});
    });
  });
  return victims.sort((a,b)=>b.score-a.score);
}
function toggleBanDetail(name){openBanDetail=openBanDetail===name?null:name;renderRoster();}
function renderRoster(){
  const el=document.getElementById('rosterContent');if(!el)return;
  if(!rosterPlayers.length){el.innerHTML='<div class="empty">Добавь игроков для анализа состава.</div>';return;}
  const recs=computeRosterRecs();

  // ── Player rows ──
  const playerCards=rosterPlayers.map(p=>{
    const mainH=p.mainHeroes.slice(0,5);
    const isFlex=p.mainRole==='Flex';const hasOff=p.offRole&&p.offRole!==p.mainRole;
    let roleBlock='';
    if(isFlex)roleBlock=roleIcon('Flex',22);
    else if(p.mainRole)roleBlock=roleIcon(p.mainRole,18)+(hasOff?`<span style="margin-left:1px">${roleIcon(p.offRole,13)}</span>`:'');
    const selRole=getRosterRole(p.name);
    const isOpen=rosterRoleOpen[p.name]||false;
    const availRoles=['Tank','Damage','Support'].filter(r=>{
      const pool=[...new Set([...p.mainHeroes,...p.poolHeroes])];
      return pool.some(hn=>{const h=heroMap[hn];return h&&h.role===r;});
    });
    let rolePickerHtml='';
    if(selRole&&!isOpen){
      // show selected role icon — click to reopen
      rolePickerHtml=`<div style="display:flex;align-items:center;gap:3px;cursor:pointer;padding:3px 7px;border-radius:6px;background:var(--bg4);border:1px solid var(--border2)" onclick="clearRosterRole('${esc(p.name)}')" title="Сменить роль">${roleIcon(selRole,18)}<span style="font-family:var(--mono);font-size:9px;color:${rc[selRole]||'var(--text)'};margin-left:2px">${selRole}</span></div>`;
    } else {
      // show all available roles
      rolePickerHtml=`<div style="display:flex;gap:4px">${availRoles.map(r=>`<div style="cursor:pointer;padding:3px 6px;border-radius:6px;background:${selRole===r?'var(--bg4)':'transparent'};border:1px solid ${selRole===r?'var(--border2)':'transparent'};opacity:${!selRole||selRole===r?1:0.45}" onclick="setRosterRole('${esc(p.name)}','${r}')" title="${r}">${roleIcon(r,18)}</div>`).join('')}</div>`;
    }
    return`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px">
      <div style="display:flex;align-items:center;gap:10px;min-width:150px">
        ${rolePickerHtml}
        <span style="font-weight:700;font-size:16px">${p.name}</span>
      </div>
      <div style="display:flex;gap:5px;flex:1;justify-content:center">${mainH.map(n=>{const src=portrait(n);return src
        ?`<img src="${src}" title="${n}" style="width:38px;height:38px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'">`
        :`<div style="width:38px;height:38px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${n[0]}</div>`;
      }).join('')}</div>
      <button class="btn btn-danger" style="padding:4px 10px;font-size:11px;flex-shrink:0" onclick="removeRosterPlayer('${esc(p.name)}')">✕</button>
    </div>`;
  }).join('');

  // ── Ban rows with expandable detail ──
  const banHtml=recs.bans.length?recs.bans.map(b=>{
    const src=portrait(b.name);const h=heroMap[b.name]||{};
    const isOpen=openBanDetail===b.name;
    const high=b.avg>=8;const color=high?'var(--damage)':'var(--accent)';
    const borderColor=high?'rgba(224,85,85,.35)':'rgba(240,160,48,.25)';

    // Detail panel — which of our heroes this hero counters
    let detailHtml='';
    if(isOpen){
      const victims=getBanVictims(b.name);
      if(victims.length){
        // Group by player
        const byPlayer={};
        victims.forEach(v=>{if(!byPlayer[v.player])byPlayer[v.player]=[];byPlayer[v.player].push(v);});
        const rows=Object.entries(byPlayer).map(([pname,vics])=>{
          const chips=vics.map(v=>{
            const vsrc=portrait(v.hero);
            const sc=v.score;const sc_color=sc>=8?'var(--damage)':sc>=5?'var(--accent)':'var(--text3)';
            return`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">
              ${vsrc?`<img src="${vsrc}" style="width:32px;height:32px;border-radius:5px;object-fit:cover;border:2px solid ${v.isMain?'var(--accent)':'var(--border)'}" onerror="this.style.display='none'">`:`<div style="width:32px;height:32px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border:2px solid ${v.isMain?'var(--accent)':'var(--border)'}">${v.hero[0]}</div>`}
              <span style="font-family:var(--mono);font-size:9px;font-weight:700;color:${sc_color}">${sc}</span>
            </div>`;
          }).join('');
          return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0">
            <span style="font-size:11px;font-weight:600;color:var(--text2);min-width:60px">${pname}</span>
            <div style="display:flex;gap:5px;flex-wrap:wrap">${chips}</div>
          </div>`;
        }).join('');
        detailHtml=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Контрит ваших героев</div>
          ${rows}
        </div>`;
      }else{
        detailHtml=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text3)">Нет пересечений с пулом</div>`;
      }
    }

    return`<div style="border-radius:8px;background:var(--bg3);border:1px solid ${isOpen?borderColor.replace('.25','.5').replace('.35','.6'):borderColor};transition:border-color .15s">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer" onclick="toggleBanDetail('${esc(b.name)}')">
        ${src?`<img src="${src}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`:`<div style="width:40px;height:40px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800">${b.name[0]}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">${b.name}</div>
          ${h.role?`<div style="display:flex;align-items:center;gap:4px;margin-top:2px">${roleIcon(h.role,12)}<span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${h.subrole||h.role}</span></div>`:''}
        </div>
        <span style="font-family:var(--mono);font-size:10px;color:${color};flex-shrink:0">${heroesCountLabel(b.count)}</span>
        <span style="font-size:12px;color:var(--text3);flex-shrink:0;transition:transform .15s;transform:rotate(${isOpen?'90':'0'}deg)">›</span>
      </div>
      ${isOpen?`<div style="padding:0 10px 10px">${detailHtml}</div>`:''}
    </div>`;
  }).join(''):'<div class="empty">Нет данных</div>';

  // ── Map rows ──
  const mapHtml=recs.maps.length?recs.maps.map(m=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--bg3);border:1px solid rgba(43,189,142,.2)">
      <div style="width:7px;height:7px;border-radius:50%;background:var(--support);flex-shrink:0"></div>
      <span style="font-size:15px;font-weight:700;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${m.type}</span>
      <div class="tier-badge tier-${m.tier}" style="font-size:9px;padding:1px 5px">${m.tier}</div>
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--support)">+${m.score}</span>
    </div>`).join(''):'<div class="empty">Добавь героев игрокам</div>';
  const avoidHtml=recs.avoid.length?recs.avoid.map(m=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--bg3)">
      <div style="width:7px;height:7px;border-radius:50%;background:var(--damage);flex-shrink:0"></div>
      <span style="font-size:14px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--damage)">−${Math.abs(m.score)}</span>
    </div>`).join(''):'';

  el.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:1.5rem">${playerCards}</div>
    <div class="detail-grid">
      <div class="d-card">
        <div class="d-card-title">🔴 Рекомендованные баны</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:10px">Контрпики нескольких игроков — нажми чтобы раскрыть</div>
        <div style="display:flex;flex-direction:column;gap:5px">${banHtml}</div>
      </div>
      <div class="d-card">
        <div class="d-card-title">✅ Предпочтительные карты</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:10px">По сильным картам всех игроков</div>
        <div style="display:flex;flex-direction:column;gap:5px">${mapHtml}</div>
        ${avoidHtml?`<div class="d-card-title" style="margin-top:14px;border:none;padding:0 0 8px">⚠ Избегать</div><div style="display:flex;flex-direction:column;gap:5px">${avoidHtml}</div>`:''}
      </div>
    </div>`;
}
function getHeroesForRoster(p){
  // filter by selected role if set, otherwise all heroes
  const sel=getRosterRole(p.name);
  const allH=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  if(!sel)return allH;
  return allH.filter(hn=>{const h=heroMap[hn];return h&&h.role===sel;});
}
function computeRosterRecs(){
  const banMap={};
  rosterPlayers.forEach(p=>{
    const allH=getHeroesForRoster(p);
    allH.forEach(hn=>{const h=heroMap[hn];if(!h)return;(h.counters||[]).forEach(c=>{if(!banMap[c.name])banMap[c.name]={name:c.name,totalScore:0,count:0};banMap[c.name].totalScore+=c.score;banMap[c.name].count++;});});
  });
  const bans=Object.values(banMap).map(b=>({...b,avg:Math.round(b.totalScore/b.count)})).filter(b=>b.avg>=6&&b.count>=1).sort((a,b)=>b.count-a.count||b.avg-a.avg).slice(0,8);
  const mapScores={};
  rosterPlayers.forEach(p=>{
    const allH=getHeroesForRoster(p);
    allH.forEach(hn=>{const h=heroMap[hn];if(!h)return;(h.strongMaps||[]).forEach(mn=>{const m=maps.find(x=>x.name===mn);if(!m)return;if(!mapScores[mn])mapScores[mn]={name:mn,score:0,type:m.type,tier:m.tier};mapScores[mn].score+=p.mainHeroes.includes(hn)?2:1;});(h.weakMaps||[]).forEach(mn=>{if(!mapScores[mn]){const m=maps.find(x=>x.name===mn);if(!m)return;mapScores[mn]={name:mn,score:0,type:m.type,tier:m.tier};}mapScores[mn].score-=p.mainHeroes.includes(hn)?2:1;});});
  });
  const mapArr=Object.values(mapScores);
  return{bans,maps:sortMaps(mapArr.filter(m=>m.score>0)).slice(0,8),avoid:mapArr.filter(m=>m.score<0).sort((a,b)=>a.score-b.score).slice(0,4)};
}
function openRosterPlayerPicker(){
  const avail=players.filter(p=>!rosterPlayers.find(r=>r.name===p.name));
  if(!avail.length){toast('Все игроки уже добавлены','err');return}
  const html=`<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center" id="rosterPickerBg" onclick="if(event.target.id==='rosterPickerBg')document.getElementById('rosterPickerBg').remove()">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;max-width:400px;width:100%;max-height:80vh;overflow-y:auto">
      <div style="font-size:15px;font-weight:800;margin-bottom:12px">Выбери игрока</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${avail.map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);cursor:pointer" onclick="addRosterPlayer('${esc(p.name)}')">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800">${p.name[0].toUpperCase()}</div>
          <span style="font-weight:600;font-size:13px;flex:1">${p.name}</span>
          ${p.mainRole?`<span class="role-tag ${p.mainRole}">${p.mainRole}</span>`:''}
        </div>`).join('')}
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function addRosterPlayer(name){
  const bg=document.getElementById('rosterPickerBg');if(bg)bg.remove();
  const p=players.find(x=>x.name===name);if(!p||rosterPlayers.find(r=>r.name===name))return;
  // Проверяем ограничение ролей: 1 Tank, 2 Damage, 2 Support
  const roleLimits={Tank:1,Damage:2,Support:2};
  const getPlayerActiveRoles=(pl)=>{
    const sel=getRosterRole(pl.name);
    if(sel)return[sel];
    // если роль не выбрана — берём основную + офф
    const roles=[];
    if(pl.mainRole&&pl.mainRole!=='Flex')roles.push(pl.mainRole);
    if(pl.offRole&&pl.offRole!==pl.mainRole)roles.push(pl.offRole);
    if(!roles.length&&pl.mainRole==='Flex')roles.push('Tank','Damage','Support');
    return roles;
  };
  // Count current roles
  const roleCounts={Tank:0,Damage:0,Support:0};
  rosterPlayers.forEach(pl=>{
    getPlayerActiveRoles(pl).forEach(r=>{if(roleCounts[r]!==undefined)roleCounts[r]++;});
  });
  // Check new player's possible roles
  const newRoles=getPlayerActiveRoles(p);
  const canAdd=newRoles.some(r=>!roleLimits[r]||roleCounts[r]<roleLimits[r]);
  if(!canAdd){
    const taken=newRoles.map(r=>`${r}: ${roleCounts[r]}/${roleLimits[r]||'∞'}`).join(', ');
    toast(`Нельзя добавить — лимиты ролей заполнены (${taken})`,'err');
    return;
  }
  rosterPlayers.push(p);renderRoster();
}
function removeRosterPlayer(name){rosterPlayers=rosterPlayers.filter(p=>p.name!==name);renderRoster()}
