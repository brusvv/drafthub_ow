// ════ RENDER ════
function renderCurrentView(){
  const a=document.querySelector('.view.active');if(!a)return;
  const id=a.id;
  if(id==='view-maps')renderMaps();
  if(id==='view-heroes')renderHeroes();
  if(id==='view-tiers')renderTiers();
  if(id==='view-bans')renderBans();
  if(id==='view-players')renderPlayers();
}

function dots5(val,type,max=5){
  let h='<div class="dots">';
  for(let i=1;i<=max;i++)h+=`<div class="dot ${i<=val?type:''}"></div>`;
  return h+'</div>';
}

// MAPS
function renderMaps(){
  const grid=document.getElementById('mapGrid');
  const detail=document.getElementById('mapDetail');
  detail.classList.remove('show');detail.innerHTML='';
  const filtered=maps.filter(m=>mapFilter==='all'||m.type===mapFilter);
  if(!filtered.length){grid.innerHTML='<div class="empty">Нет карт. Нажми "+ Карта" или Seed.</div>';return}
  grid.innerHTML=filtered.map(m=>{
    const src=mapImg(m.name);
    const noAD=NO_ATKDEF.includes(m.type);
    return`<div class="map-card" onclick="showMapDetail('${esc(m.name)}')">
      ${src?`<img src="${src}" class="map-card-img" alt="${m.name}" onerror="this.outerHTML='<div class=map-card-img-ph>${m.type}</div>'">`:`<div class="map-card-img-ph">${m.type}</div>`}
      <div class="map-card-body">
        <div class="map-card-name">${m.name}</div>
        <div class="map-card-meta">
          <div class="tier-badge tier-${m.tier}">${m.tier}</div>
          <div class="ratings">
            ${noAD
              ?`<div class="r-row">${ICON_DIF}${dots5(m.dif,'dif')}</div>`
              :`<div class="r-row">${ICON_ATK}${dots5(m.atk,'atk')}</div>
                <div class="r-row">${ICON_DEF}${dots5(m.def,'def')}</div>`
            }
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showMapDetail(name){
  const m=maps.find(x=>x.name===name);if(!m)return;
  document.getElementById('mapGrid').innerHTML='';
  const detail=document.getElementById('mapDetail');
  detail.classList.add('show');
  const noAD=NO_ATKDEF.includes(m.type);
  const src=mapImg(m.name);

  const byRole={Tank:[],Damage:[],Support:[]};
  m.preferredHeroes.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push(h)});
  const heroRows=['Tank','Damage','Support'].flatMap(role=>
    byRole[role].map(h=>{const ps=portrait(h.name);return`<div class="hero-row">
      <div class="role-dot" style="background:${rc[h.role]}"></div>
      ${ps?`<img src="${ps}" class="hero-row-av" onerror="this.outerHTML='<div class=hero-row-av-ph>${h.name[0]}</div>'">`:`<div class="hero-row-av-ph">${h.name[0]}</div>`}
      <div class="hero-row-info"><div class="hero-row-name">${h.name}</div><div class="hero-row-sub">${h.subrole}</div></div>
    </div>`})
  ).join('')||'<div class="empty">Не указаны</div>';

  const banItems=m.bans.map(n=>{const ps=portrait(n);return`<div class="ban-item">
    ${ps?`<img src="${ps}" class="ban-item-av" onerror="this.outerHTML='<div class=ban-item-av-ph>${n[0]}</div>'">`:`<div class="ban-item-av-ph">${n[0]}</div>`}
    <span class="ban-item-name">${n}</span>
  </div>`}).join('')||'<div class="empty">Не указаны</div>';

  const compItems=m.comp.map(c=>{const ps=portrait(c.hero);return`<div class="comp-card ${c.role}">
    ${ps?`<img src="${ps}" class="comp-av" onerror="this.outerHTML='<div class=comp-av-ph>${c.hero[0]}</div>'">`:`<div class="comp-av-ph">${c.hero[0]}</div>`}
    <div class="comp-name">${c.hero}</div>
  </div>`}).join('')||'<div class="empty">Не указан</div>';

  const notesHtml=m.notes
    ?m.notes.split(/[.\n]/).filter(s=>s.trim()).map(s=>`<span class="note-line">${s.trim()}</span>`).join('')
    :'<div class="empty">Нет заметок</div>';

  const counterItems=(m.counters||[]).map(n=>{
    const h=heroMap[n]||{};const ps=portrait(n);
    const hd=heroMap[n];const score=hd?Math.max(0,...(hd.counters||[]).map(c=>c.score)):0;
    const banRec=score>=8?`<span style="font-family:var(--mono);font-size:8px;text-transform:uppercase;background:rgba(224,85,85,.15);color:var(--damage);border:1px solid rgba(224,85,85,.3);border-radius:4px;padding:1px 5px;margin-left:auto">БАН</span>`:'';
    return`<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;background:var(--bg3)">
      ${ps?`<img src="${ps}" style="width:24px;height:24px;border-radius:5px;object-fit:cover" onerror="this.outerHTML='<div style=width:24px;height:24px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800>${n[0]}</div>'">`:`<div style="width:24px;height:24px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px">${n[0]}</div>`}
      <span style="font-size:12px;font-weight:600;flex:1">${n}</span>
      ${h.role?`<div class="role-dot" style="background:${rc[h.role]||'var(--text3)'}"></div>`:''}
      ${banRec}
    </div>`;
  }).join('')||'<div class="empty">Не указаны</div>';

  detail.innerHTML=`
    <div class="detail-header">
      ${src?`<img src="${src}" class="detail-banner" alt="${m.name}" onerror="this.outerHTML='<div class=detail-banner-ph><div class=detail-banner-ph-inner>${m.name}</div></div>'">`:`<div class="detail-banner-ph"><div class="detail-banner-ph-inner">${m.name}</div></div>`}
      <div class="detail-header-body">
        <div class="detail-top">
          <div>
            <button class="back-btn" onclick="backToMaps()">← Назад</button>
            <div class="detail-name">${m.name}</div>
          </div>
          <button class="btn" style="margin-top:2.5rem" onclick="openMapModal(maps.find(x=>x.name==='${esc(m.name)}'))">✎ Редактировать</button>
        </div>
        <div class="detail-meta">
          <div class="m-item"><span>Tier</span><span class="tier-badge tier-${m.tier}" style="margin-left:4px">${m.tier}</span></div>
          <div class="m-item"><span>Тип:</span><span class="m-val">${m.type}</span></div>
          <div class="m-item"><span>Приоритет:</span><span class="m-val">#${m.priority}</span></div>
          ${noAD
            ?`<div class="m-item">${ICON_DIF}<span style="margin-left:4px">Сложность</span>${dots5(m.dif,'dif')}</div>`
            :`<div class="m-item">${ICON_ATK}<span style="margin-left:4px">ATK</span>${dots5(m.atk,'atk')}</div>
              <div class="m-item">${ICON_DEF}<span style="margin-left:4px">DEF</span>${dots5(m.def,'def')}</div>`
          }
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="d-card">
        <div class="d-card-title">Предпочтительные герои</div>
        <div class="hero-list">${heroRows}</div>
      </div>
      <div class="d-card">
        <div class="d-card-title">Цели для банов</div>
        <div class="ban-grid">${banItems}</div>
        <div style="margin-top:1rem">
          <div class="d-card-title" style="border:none;padding:0;margin-bottom:8px">Предпочтительный состав</div>
          <div class="comp-row">${compItems}</div>
        </div>
      </div>
      <div class="d-card">
        <div class="d-card-title">Контрпики на этой карте</div>
        <div style="display:flex;flex-direction:column;gap:4px">${counterItems}</div>
      </div>
      <div class="d-card full">
        <div class="d-card-title">Заметки о подготовке</div>
        <div class="notes-text">${notesHtml}</div>
      </div>
    </div>`;
}

function backToMaps(){document.getElementById('mapDetail').classList.remove('show');document.getElementById('mapDetail').innerHTML='';renderMaps()}
function filterMaps(type,btn){mapFilter=type;document.querySelectorAll('#mapFilters .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');backToMaps()}

// HEROES
function renderHeroes(){
  const pool=document.getElementById('heroPool');
  const roles=heroFilter==='all'?['Tank','Damage','Support']:[heroFilter];
  pool.innerHTML=roles.map(role=>{
    const h=heroes.filter(x=>x.role===role).sort((a,b)=>b.priority-a.priority);
    if(!h.length)return'';
    return`<div class="role-section">
      <div class="role-header">
        <div class="role-dot" style="background:${rc[role]};width:8px;height:8px"></div>
        <span class="role-title">${role}</span>
        <span class="role-cnt">${h.length} героев</span>
      </div>
      <div class="hero-grid">${h.map(hero=>{
        const src=portrait(hero.name);
        return`<div class="h-card ${hero.banned?'banned':''}" onclick="openHeroModal(heroes.find(x=>x.name==='${esc(hero.name)}'))">
          <div class="h-card-accent" style="background:${rc[hero.role]}"></div>
          ${src?`<img src="${src}" class="h-card-img" alt="${hero.name}" onerror="this.outerHTML='<div class=h-card-img-ph>${hero.name[0]}</div>'">`:`<div class="h-card-img-ph">${hero.name[0]}</div>`}
          ${hero.banned?'<div class="banned-tag">БАН</div>':''}
          ${hero.counters.some(c=>c.score>=8)?'<div class="banned-tag" style="background:var(--accent);top:auto;bottom:5px;font-size:8px">⚠ Контр</div>':''}
          <div class="h-card-body">
            <div class="h-card-name">${hero.name}</div>
            <div class="h-card-sub">${hero.subrole}</div>
            <div class="h-card-prio">Приоритет: ${hero.priority}/10</div>
            ${hero.counters.length?`<div class="h-card-prio" style="color:var(--damage);font-size:9px">▲ ${hero.counters.slice().sort((a,b)=>b.score-a.score).slice(0,2).map(c=>c.name).join(', ')}</div>`:''}
          </div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('')||'<div class="empty">Нет героев.</div>';
}

function filterHeroes(role,btn){heroFilter=role;document.querySelectorAll('#heroFilters .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderHeroes()}

// TIERS
function renderTiers(){
  const tl=document.getElementById('tierList');
  const byT={};maps.forEach(m=>{if(!byT[m.tier])byT[m.tier]=[];byT[m.tier].push(m)});
  tl.innerHTML=['S','A','B','C','D'].filter(t=>byT[t]).map(t=>`
    <div class="tier-row">
      <div class="tier-lbl" style="background:${ts[t].bg};color:${ts[t].c}">${t}</div>
      <div class="tier-maps">${byT[t].map(m=>`<div class="tier-pill" onclick="goToMap('${esc(m.name)}')">${m.name}</div>`).join('')}</div>
    </div>`).join('')||'<div class="empty">Нет данных</div>';
}

function goToMap(name){showView('maps',document.querySelectorAll('.nav-btn')[0]);mapFilter='all';document.querySelectorAll('#mapFilters .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));renderMaps();setTimeout(()=>showMapDetail(name),30)}

// BANS
function renderBans(){
  const bg=document.getElementById('bansGrid');
  const banned=heroes.filter(h=>h.banned);
  const highCounters=heroes.filter(h=>!h.banned&&h.counters.some(c=>c.score>=8));
  let html='';
  if(banned.length){
    html+=banned.map(h=>{
      const src=portrait(h.name);
      return`<div class="ban-card">
        ${src?`<img src="${src}" class="ban-card-img" alt="${h.name}" onerror="this.outerHTML='<div class=ban-card-img-ph>${h.name[0]}</div>'">`:`<div class="ban-card-img-ph">${h.name[0]}</div>`}
        <div class="ban-card-body"><div class="ban-card-name">${h.name}</div><div class="ban-card-role">${h.role} · ${h.subrole}</div></div>
      </div>`;
    }).join('');
  }
  if(highCounters.length){
    html+=`<div class="section-lbl" style="grid-column:1/-1;margin-top:${banned.length?'1.5rem':'0'};margin-bottom:.25rem">Рекомендуется к бану (контрпики ≥8)</div>`;
    html+=highCounters.map(h=>{
      const src=portrait(h.name);
      const topC=h.counters.filter(c=>c.score>=8).sort((a,b)=>b.score-a.score);
      return`<div class="ban-card" style="border-color:rgba(240,160,48,.3)">
        ${src?`<img src="${src}" class="ban-card-img" alt="${h.name}" onerror="this.outerHTML='<div class=ban-card-img-ph>${h.name[0]}</div>'">`:`<div class="ban-card-img-ph">${h.name[0]}</div>`}
        <div class="ban-card-body">
          <div class="ban-card-name" style="color:var(--accent)">${h.name}</div>
          <div class="ban-card-role">${topC.map(c=>`${c.name}(${c.score})`).join(', ')}</div>
        </div>
      </div>`;
    }).join('');
  }
  bg.innerHTML=html||'<div class="empty">Нет активных банов и контрпиков</div>';
}

// NAV
function showView(v,btn){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  if(btn)btn.classList.add('active');
  renderCurrentView();
}

function showLoading(id){const el=document.getElementById(id);if(el)el.innerHTML='<div class="loading-state"><div class="spinner"></div><br>Загрузка...</div>'}
function showError(id,msg){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="error-state">⚠ ${msg}</div>`}
let toastT;
function toast(msg,type='ok'){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3000)}
function esc(s){return(s||'').replace(/'/g,"\\'")}

if(!getClientId())document.getElementById('authConfigBanner').style.display='block';

// PLAYERS
function renderPlayers(){
  const grid=document.getElementById('playerGrid');
  if(!grid)return;
  const detail=document.getElementById('playerDetail');
  detail.classList.remove('show');detail.innerHTML='';
  if(!players.length){grid.innerHTML='<div class="empty">Нет игроков. Нажми "+ Игрок".</div>';return}
  grid.innerHTML=players.map(p=>{
    const mainH=p.mainHeroes.slice(0,5);
    return`<div class="player-card" onclick="showPlayerDetail('${esc(p.name)}')">
      <div class="player-card-top">
        <div class="player-av">${p.name[0].toUpperCase()}</div>
        <div>
          <div class="player-name">${p.name}</div>
          <div class="player-btag">${p.btag||'—'}</div>
        </div>
      </div>
      <div class="player-card-roles">
        ${p.mainRole?`<span class="role-tag ${p.mainRole}">${p.mainRole}</span>`:''}
        ${p.offRole?`<span class="role-tag ${p.offRole}" style="opacity:.7">+${p.offRole}</span>`:''}
        ${p.rankTank&&p.mainRole==='Tank'?`<span class="rank-badge">${p.rankTank}</span>`:''}
        ${p.rankDmg&&p.mainRole==='Damage'?`<span class="rank-badge">${p.rankDmg}</span>`:''}
        ${p.rankSup&&p.mainRole==='Support'?`<span class="rank-badge">${p.rankSup}</span>`:''}
        ${p.mainRole==='Flex'?[p.rankTank,p.rankDmg,p.rankSup].filter(Boolean).map(r=>`<span class="rank-badge">${r}</span>`).join(''):''}
      </div>
      <div class="player-card-heroes">
        ${mainH.map(n=>{const src=portrait(n);return src
          ?`<img src="${src}" class="mini-av" title="${n}" onerror="this.outerHTML='<div class=mini-av-ph>${n[0]}</div>'">`
          :`<div class="mini-av-ph">${n[0]}</div>`}).join('')}
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
  const pool=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  const byRole={Tank:[],Damage:[],Support:[]};
  pool.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push({name:n,isMain:p.mainHeroes.includes(n)})});
  const poolHtml=['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div style="margin-bottom:.75rem">
      <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:${rc[r]};margin-bottom:5px">${r}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${byRole[r].map(({name:n,isMain})=>{
        const src=portrait(n);const border=isMain?'var(--accent)':'var(--border)';
        return`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          ${src?`<img src="${src}" title="${n}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:2px solid ${border}" onerror="this.outerHTML='<div style=width:36px;height:36px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;border:2px solid ${border}>${n[0]}</div>'">`:`<div style="width:36px;height:36px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--text3);border:2px solid ${border}">${n[0]}</div>`}
          <div style="width:5px;height:5px;border-radius:50%;background:${isMain?'var(--accent)':'transparent'}"></div>
        </div>`;
      }).join('')}</div>
    </div>`).join('')||'<div class="empty">Герои не указаны</div>';
  detail.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem 1.5rem">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:var(--text2);border:2px solid var(--border2)">${p.name[0].toUpperCase()}</div>
          <div>
            <div style="font-size:20px;font-weight:800;margin-bottom:3px">${p.name}</div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${p.btag||'Battle.net tag не указан'}</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              ${p.mainRole?`<span class="role-tag ${p.mainRole}">Основная: ${p.mainRole}</span>`:''}
              ${p.offRole?`<span class="role-tag ${p.offRole}">Офф: ${p.offRole}</span>`:''}
            </div>
          </div>
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
      ${p.notes?`<div class="d-card full"><div class="d-card-title">Заметки</div><div class="notes-text">${p.notes}</div></div>`:''}
    </div>
    <button class="back-btn" onclick="backToPlayers()" style="margin-top:10px">← Назад к игрокам</button>`;
}

function backToPlayers(){document.getElementById('playerDetail').classList.remove('show');document.getElementById('playerDetail').innerHTML='';renderPlayers()}
