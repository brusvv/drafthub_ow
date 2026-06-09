// ════ RENDER ════
function renderCurrentView(){
  const a=document.querySelector('.view.active');if(!a)return;
  const id=a.id;
  if(id==='view-maps')renderMaps();
  if(id==='view-heroes')renderHeroes();
  if(id==='view-tiers')renderTiers();
  if(id==='view-bans')renderBans();
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
              ?`<div class="r-row"><span class="r-lbl">DIF</span>${dots5(m.dif,'dif')}</div>`
              :`<div class="r-row"><span class="r-lbl">ATK</span>${dots5(m.atk,'atk')}</div>
                <div class="r-row"><span class="r-lbl">DEF</span>${dots5(m.def,'def')}</div>`
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
            ?`<div class="m-item"><span>Сложность</span>${dots5(m.dif,'dif')}</div>`
            :`<div class="m-item"><span>ATK</span>${dots5(m.atk,'atk')}</div>
              <div class="m-item"><span>DEF</span>${dots5(m.def,'def')}</div>`
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
          <div class="h-card-body">
            <div class="h-card-name">${hero.name}</div>
            <div class="h-card-sub">${hero.subrole}</div>
            <div class="h-card-prio">Приоритет: ${hero.priority}/10</div>
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
  bg.innerHTML=banned.length?banned.map(h=>{
    const src=portrait(h.name);
    return`<div class="ban-card">
      ${src?`<img src="${src}" class="ban-card-img" alt="${h.name}" onerror="this.outerHTML='<div class=ban-card-img-ph>${h.name[0]}</div>'">`:`<div class="ban-card-img-ph">${h.name[0]}</div>`}
      <div class="ban-card-body"><div class="ban-card-name">${h.name}</div><div class="ban-card-role">${h.role} · ${h.subrole}</div></div>
    </div>`;
  }).join(''):'<div class="empty">Нет активных банов</div>';
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
