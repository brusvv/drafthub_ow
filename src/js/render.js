// ════ RENDER ════
function renderCurrentView(){
  const a=document.querySelector('.view.active');if(!a)return;
  const id=a.id;
  if(id==='view-maps')renderMaps();
  if(id==='view-heroes')renderHeroes();
  if(id==='view-tiers')renderTiers();
  if(id==='view-bans')renderBans();
  if(id==='view-players')renderPlayers();
  if(id==='view-roster')renderRoster();
}
 
function dots5(val,type,max=5){
  let h='<div class="dots">';
  for(let i=1;i<=max;i++)h+=`<div class="dot ${i<=val?type:''}"></div>`;
  return h+'</div>';
}
 
// ════ MAPS ════
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
        <div class="map-card-type">${mapTypeIcon(m.type,12)}<span>${m.type}</span></div>
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
 
  // Preferred heroes
  const byRole={Tank:[],Damage:[],Support:[]};
  m.preferredHeroes.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push(h)});
  const heroRows=['Tank','Damage','Support'].flatMap(role=>
    byRole[role].map(h=>{const ps=portrait(h.name);return`<div class="hero-row">
      ${roleIcon(h.role,14)}
      ${ps?`<img src="${ps}" class="hero-row-av" onerror="this.outerHTML='<div class=hero-row-av-ph>${h.name[0]}</div>'">`:`<div class="hero-row-av-ph">${h.name[0]}</div>`}
      <div class="hero-row-info"><div class="hero-row-name">${h.name}</div><div class="hero-row-sub">${subroleIcon(h.role,h.subrole,11)}<span>${h.subrole}</span></div></div>
    </div>`})
  ).join('')||'<div class="empty">Не указаны</div>';
 
  // Bans — grouped by role: Tank, Damage, Support
  const banByRole={Tank:[],Damage:[],Support:[]};
  m.bans.forEach(n=>{
    const h=heroMap[n];
    const role=h?h.role:'Damage';
    if(!banByRole[role])banByRole[role]=[];
    banByRole[role].push(n);
  });
  const banGroupsHtml=['Tank','Damage','Support'].filter(r=>banByRole[r].length).map(r=>`
    <div class="ban-role-group">
      <div class="ban-role-header">
        ${roleIcon(r,14)}
        <span class="ban-role-title" style="color:${rc[r]}">${r}</span>
      </div>
      <div class="ban-role-heroes">
        ${banByRole[r].map(n=>{const ps=portrait(n);return`<div class="ban-chip">
          ${ps?`<img src="${ps}" onerror="this.outerHTML='<div class=ban-chip-ph>${n[0]}</div>'">`:`<div class="ban-chip-ph">${n[0]}</div>`}
          <span class="ban-chip-name">${n}</span>
        </div>`;}).join('')}
      </div>
    </div>`).join('')||'<div class="empty">Не указаны</div>';
 
  // Comp — role-aware slots
  const compHtml=buildCompDisplay(m.comp);
 
  // Counters
  const counterByRole={Tank:[],Damage:[],Support:[]};
  (m.counters||[]).forEach(n=>{
    const h=heroMap[n];
    const role=h?h.role:'Damage';
    if(!counterByRole[role])counterByRole[role]=[];
    counterByRole[role].push(n);
  });
  const counterGroupsHtml=['Tank','Damage','Support'].filter(r=>counterByRole[r].length).map(r=>`
    <div class="ban-role-group">
      <div class="ban-role-header">
        ${roleIcon(r,14)}
        <span class="ban-role-title" style="color:${rc[r]}">${r}</span>
      </div>
      <div class="ban-role-heroes">
        ${counterByRole[r].map(n=>{const ps=portrait(n);const hd=heroMap[n];return`<div class="ban-chip" style="background:rgba(240,160,48,.06);border-color:rgba(240,160,48,.2)">
          ${ps?`<img src="${ps}" onerror="this.outerHTML='<div class=ban-chip-ph>${n[0]}</div>'">`:`<div class="ban-chip-ph">${n[0]}</div>`}
          <span class="ban-chip-name" style="color:var(--accent)">${n}</span>
        </div>`;}).join('')}
      </div>
    </div>`).join('')||'<div class="empty">Не указаны</div>';
 
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
          <div class="m-item"><span>Тип:</span>${mapTypeIcon(m.type,14)}<span class="m-val">${m.type}</span></div>
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
        ${banGroupsHtml}
      </div>
      <div class="d-card">
        <div class="d-card-title">Предпочтительный состав</div>
        ${compHtml}
      </div>
      <div class="d-card">
        <div class="d-card-title">Контрпики на карте</div>
        ${counterGroupsHtml}
      </div>
      <div class="d-card full">
        <div class="d-card-title">Заметки о подготовке</div>
        <div class="notes-text">${notesHtml}</div>
      </div>
    </div>`;
}
 
// Состав — отображение по ролям
function buildCompDisplay(comp){
  if(!comp||!comp.length)return'<div class="empty">Не указан</div>';
  const byRole={Tank:[],Damage:[],Support:[]};
  comp.forEach(c=>{
    const role=c.playerRole||c.role||(heroMap[c.hero]||{}).role||'Damage';
    if(!byRole[role])byRole[role]=[];
    byRole[role].push({...c,displayRole:role});
  });
  return['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div style="margin-bottom:8px">
      <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:${rc[r]};margin-bottom:5px;font-weight:700">${r}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${byRole[r].map(c=>{const ps=portrait(c.hero);return`<div class="comp-card ${r}">
          ${ps?`<img src="${ps}" class="comp-av" onerror="this.outerHTML='<div class=comp-av-ph>${c.hero[0]}</div>'">`:`<div class="comp-av-ph">${c.hero[0]}</div>`}
          <div class="comp-name">${c.hero}</div>
        </div>`;}).join('')}
      </div>
    </div>`).join('');
}
 
function backToMaps(){document.getElementById('mapDetail').classList.remove('show');document.getElementById('mapDetail').innerHTML='';renderMaps()}
function filterMaps(type,btn){mapFilter=type;document.querySelectorAll('#mapFilters .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');backToMaps()}
 
// ════ HEROES — подклассы новой строкой ════
function renderHeroes(){
  const pool=document.getElementById('heroPool');
  const roles=heroFilter==='all'?['Tank','Damage','Support']:[heroFilter];
  pool.innerHTML=roles.map(role=>{
    const h=heroes.filter(x=>x.role===role).sort((a,b)=>b.priority-a.priority);
    if(!h.length)return'';
 
    // Группировка по подклассу
    const subroleOrder={
      Tank:['Initiator','Bruiser','Stalwart'],
      Damage:['Sharpshooter','Flanker','Recon','Specialist'],
      Support:['Tactician','Medic','Survivor']
    };
    const order=subroleOrder[role]||[];
    const bySubrole={};
    h.forEach(hero=>{
      const sub=hero.subrole||'Other';
      if(!bySubrole[sub])bySubrole[sub]=[];
      bySubrole[sub].push(hero);
    });
    const sortedSubs=[...new Set([...order,...Object.keys(bySubrole)])].filter(s=>bySubrole[s]);
 
    const subroleGroups=sortedSubs.map(sub=>`
      <div class="subrole-group">
        <div class="subrole-lbl">${subroleIcon(role,sub,11)} ${sub}</div>
        <div class="hero-grid">${bySubrole[sub].map(hero=>{
          const src=portrait(hero.name);
          return`<div class="h-card ${hero.banned?'banned':''}" onclick="openHeroModal(heroes.find(x=>x.name==='${esc(hero.name)}'))">
            <div class="h-card-accent" style="background:${rc[hero.role]}"></div>
            ${src?`<img src="${src}" class="h-card-img" alt="${hero.name}" onerror="this.outerHTML='<div class=h-card-img-ph>${hero.name[0]}</div>'">`:`<div class="h-card-img-ph">${hero.name[0]}</div>`}
            ${hero.banned?'<div class="banned-tag">БАН</div>':''}
            ${hero.counters&&hero.counters.some(c=>c.score>=8)?'<div class="banned-tag" style="background:var(--accent);top:auto;bottom:5px;font-size:8px">⚠ Контр</div>':''}
            <div class="h-card-body">
              <div class="h-card-name">${hero.name}</div>
              <div class="h-card-prio">Приоритет: ${hero.priority}/10</div>
              ${hero.counters&&hero.counters.length?`<div class="h-card-prio" style="color:var(--damage);font-size:9px">▲ ${hero.counters.slice().sort((a,b)=>b.score-a.score).slice(0,2).map(c=>c.name).join(', ')}</div>`:''}
            </div>
          </div>`;
        }).join('')}</div>
      </div>`).join('');
 
    return`<div class="role-section">
      <div class="role-header">
        ${roleIcon(role,18)}
        <span class="role-title">${role}</span>
        <span class="role-cnt">${h.length} героев</span>
      </div>
      ${subroleGroups}
    </div>`;
  }).join('')||'<div class="empty">Нет героев.</div>';
}
 
function filterHeroes(role,btn){heroFilter=role;document.querySelectorAll('#heroFilters .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderHeroes()}
 
// ════ TIER LIST — D&D ════
 
// Состояние тирлистов (сохраняется локально)
let tierOrderMaps={S:[],A:[],B:[],C:[],D:[]};
let tierOrderHeroes={S:[],A:[],B:[],C:[],D:[]};
let tierMapTypeFilter='all';
let tierHeroRoleFilter='all';

function switchTierTab(tab,btn){
  document.querySelectorAll('.tier-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tierListMaps').style.display=tab==='maps'?'block':'none';
  document.getElementById('tierListHeroes').style.display=tab==='heroes'?'block':'none';
  document.getElementById('tierMapFilters').style.display=tab==='maps'?'flex':'none';
  document.getElementById('tierHeroFilters').style.display=tab==='heroes'?'flex':'none';
}

function filterTierMaps(type,btn){
  tierMapTypeFilter=type;
  document.querySelectorAll('#tierMapFilters .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTierMaps();
}
function filterTierHeroes(role,btn){
  tierHeroRoleFilter=role;
  document.querySelectorAll('#tierHeroFilters .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTierHeroes();
}

function renderTiers(){
  renderTierMaps();
  renderTierHeroes();
}

function initTierMaps(){
  // Prefer Sheets data (loaded into tierOrderMaps by loadTiers), fallback to localStorage
  const saved=Object.values(tierOrderMaps).some(a=>a.length)
    ? null
    : JSON.parse(localStorage.getItem('draft_tier_maps')||'null');
  if(saved) tierOrderMaps=saved;
  // Merge new maps not yet in any tier
  const allNames=maps.map(m=>m.name);
  const inTiers=new Set(Object.values(tierOrderMaps).flat());
  allNames.filter(n=>!inTiers.has(n)).forEach(n=>{
    const m=maps.find(x=>x.name===n);
    const tier=m?m.tier:'B';
    if(!tierOrderMaps[tier])tierOrderMaps[tier]=[];
    tierOrderMaps[tier].push(n);
  });
  // Remove stale entries (maps deleted from sheet)
  const nameSet=new Set(allNames);
  ['S','A','B','C','D'].forEach(t=>{tierOrderMaps[t]=(tierOrderMaps[t]||[]).filter(n=>nameSet.has(n))});
}

function initTierHeroes(){
  const saved=Object.values(tierOrderHeroes).some(a=>a.length)
    ? null
    : JSON.parse(localStorage.getItem('draft_tier_heroes')||'null');
  if(saved) tierOrderHeroes=saved;
  const allNames=heroes.map(h=>h.name);
  const inTiers=new Set(Object.values(tierOrderHeroes).flat());
  allNames.filter(n=>!inTiers.has(n)).forEach(n=>{
    const h=heroes.find(x=>x.name===n);
    const tier=h?(h.priority>=9?'S':h.priority>=7?'A':h.priority>=5?'B':h.priority>=3?'C':'D'):'C';
    if(!tierOrderHeroes[tier])tierOrderHeroes[tier]=[];
    tierOrderHeroes[tier].push(n);
  });
  const nameSet=new Set(allNames);
  ['S','A','B','C','D'].forEach(t=>{tierOrderHeroes[t]=(tierOrderHeroes[t]||[]).filter(n=>nameSet.has(n))});
}

let _tmTimer=null,_thTimer=null;
function saveTierMaps(){
  localStorage.setItem('draft_tier_maps',JSON.stringify(tierOrderMaps));
  clearTimeout(_tmTimer);_tmTimer=setTimeout(saveTierMapsSheets,1500);
}
function saveTierHeroes(){
  localStorage.setItem('draft_tier_heroes',JSON.stringify(tierOrderHeroes));
  clearTimeout(_thTimer);_thTimer=setTimeout(saveTierHeroesSheets,1500);
}
async function saveTierMapsSheets(){
  if(!SID())return;
  const rows=[['name','tier'],...Object.entries(tierOrderMaps).flatMap(([t,ns])=>ns.map(n=>[n,t]))];
  try{
    await sUp('TierMaps!A1:B'+rows.length,rows);
    if(rows.length<500)await sClear('TierMaps!A'+(rows.length+1)+':B500');
  }catch(e){console.warn('TierMaps save error:',e.message)}
}
async function saveTierHeroesSheets(){
  if(!SID())return;
  const rows=[['name','tier'],...Object.entries(tierOrderHeroes).flatMap(([t,ns])=>ns.map(n=>[n,t]))];
  try{
    await sUp('TierHeroes!A1:B'+rows.length,rows);
    if(rows.length<500)await sClear('TierHeroes!A'+(rows.length+1)+':B500');
  }catch(e){console.warn('TierHeroes save error:',e.message)}
}

// drag state
let dragItem=null,dragType=null;
 
function renderTierMaps(){
  initTierMaps();
  const el=document.getElementById('tierListMaps');
  el.innerHTML=['S','A','B','C','D'].map(t=>{
    const items=tierOrderMaps[t]||[];
    const style=ts[t];
    return`<div class="tier-row" data-tier="${t}">
      <div class="tier-lbl" style="background:${style.bg};color:${style.c}">${t}</div>
      <div class="tier-maps" id="tierMapZone_${t}"
        ondragover="onDragOver(event,'maps','${t}')"
        ondrop="onDrop(event,'maps','${t}')"
        ondragleave="onDragLeave(event)">
        ${items.map((name,idx)=>{
          const m=maps.find(x=>x.name===name);
          const hidden=tierMapTypeFilter!=='all'&&(!m||m.type!==tierMapTypeFilter);
          return`<div class="tier-pill${hidden?' tier-pill-hidden':''}" draggable="true"
            data-tier="${t}" data-type="maps"
            ondragstart="onDragStart(event,'maps','${t}',${idx})"
            ondragend="onDragEnd(event)"
            onclick="goToMap('${esc(name)}')">
            ${m&&tierMapTypeFilter==='all'?`<span class="tier-pill-type">${m.type.slice(0,3).toUpperCase()}</span>`:''}
            ${name}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}
 
function renderTierHeroes(){
  initTierHeroes();
  const el=document.getElementById('tierListHeroes');
  el.innerHTML=['S','A','B','C','D'].map(t=>{
    const items=tierOrderHeroes[t]||[];
    const style=ts[t];
    return`<div class="tier-row" data-tier="${t}">
      <div class="tier-lbl" style="background:${style.bg};color:${style.c}">${t}</div>
      <div class="tier-maps" id="tierHeroZone_${t}"
        ondragover="onDragOver(event,'heroes','${t}')"
        ondrop="onDrop(event,'heroes','${t}')"
        ondragleave="onDragLeave(event)">
        ${items.map((name,idx)=>{
          const h=heroMap[name];
          const src=portrait(name);
          const hidden=tierHeroRoleFilter!=='all'&&(!h||h.role!==tierHeroRoleFilter);
          return`<div class="tier-hero-pill${hidden?' tier-pill-hidden':''}" draggable="true"
            data-tier="${t}" data-type="heroes"
            ondragstart="onDragStart(event,'heroes','${t}',${idx})"
            ondragend="onDragEnd(event)">
            ${src?`<img src="${src}" width="22" height="22" style="border-radius:4px;object-fit:cover" onerror="this.style.display='none'">`:`<div class="tier-hero-pill-ph">${name[0]}</div>`}
            ${name}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}
 
// ── Drag & Drop ──
function onDragStart(e,type,fromTier,idx){
  const order=type==='maps'?tierOrderMaps:tierOrderHeroes;
  const name=(order[fromTier]||[])[idx];
  dragItem={name,tier:fromTier};
  dragType=type;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',name||'');
}
 
function onDragEnd(e){
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.tier-maps').forEach(z=>z.classList.remove('drag-over'));
  dragItem=null;dragType=null;
}
 
function onDragOver(e,type,tier){
  if(type!==dragType)return;
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  e.currentTarget.classList.add('drag-over');
}
 
function onDragLeave(e){
  e.currentTarget.classList.remove('drag-over');
}
 
function onDrop(e,type,toTier){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(!dragItem||type!==dragType)return;
  const {name,tier:fromTier}=dragItem;
  const order=type==='maps'?tierOrderMaps:tierOrderHeroes;
 
  // Убираем из старого тира
  order[fromTier]=order[fromTier].filter(n=>n!==name);
  // Добавляем в новый
  if(!order[toTier])order[toTier]=[];
 
  // Определяем позицию по месту дропа
  const zone=e.currentTarget;
  const pills=[...zone.querySelectorAll('[draggable]')].filter(el=>el.dataset.name!==name);
  let insertIdx=pills.length;
  for(let i=0;i<pills.length;i++){
    const rect=pills[i].getBoundingClientRect();
    if(e.clientX<rect.left+rect.width/2){insertIdx=i;break}
  }
  order[toTier].splice(insertIdx,0,name);
 
  if(type==='maps'){saveTierMaps();renderTierMaps();}
  else{saveTierHeroes();renderTierHeroes();}
}
 
function goToMap(name){showView('maps',document.querySelectorAll('.nav-btn')[0]);mapFilter='all';document.querySelectorAll('#mapFilters .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));renderMaps();setTimeout(()=>showMapDetail(name),30)}
 
// ════ BANS — по ролям ════
function renderBans(){
  const bg=document.getElementById('bansGrid');
  const banned=heroes.filter(h=>h.banned);
  const highCounters=heroes.filter(h=>!h.banned&&h.counters&&h.counters.some(c=>c.score>=8));
 
  function buildRoleGroups(heroList,chipStyle){
    const byRole={Tank:[],Damage:[],Support:[]};
    heroList.forEach(h=>{if(byRole[h.role])byRole[h.role].push(h)});
    return['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
      <div class="ban-role-group">
        <div class="ban-role-header">
          ${roleIcon(r,14)}
          <span class="ban-role-title" style="color:${rc[r]}">${r}</span>
        </div>
        <div class="ban-role-heroes">
          ${byRole[r].map(h=>{const src=portrait(h.name);return`<div class="ban-chip" style="${chipStyle||''}">
            ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-chip-ph">${h.name[0]}</div>`}
            <span class="ban-chip-name">${h.name}</span>
          </div>`;}).join('')}
        </div>
      </div>`).join('');
  }
 
  let html='';
  if(banned.length){
    html+=`<div style="margin-bottom:1.5rem">
      <div class="section-lbl" style="margin-bottom:.75rem">Текущие баны команды</div>
      ${buildRoleGroups(banned,'')}
    </div>`;
  }
  if(highCounters.length){
    html+=`<div>
      <div class="section-lbl" style="margin-bottom:.75rem">Рекомендуется к бану (контрпики ≥8)</div>
      ${buildRoleGroups(highCounters,'background:rgba(240,160,48,.06);border-color:rgba(240,160,48,.25)')}
    </div>`;
  }
  bg.innerHTML=html||'<div class="empty">Нет активных банов и контрпиков</div>';
}
 
// ════ NAV ════
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
 
// ════ HELPERS ════
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
  const recMaps=Object.values(mapScores).sort((a,b)=>b.score-a.score).slice(0,6);
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
  return{recBans,recMaps,avoidMaps};
}
 
function renderPlayers(){
  const grid=document.getElementById('playerGrid');
  if(!grid)return;
  const detail=document.getElementById('playerDetail');
  detail.classList.remove('show');detail.innerHTML='';
  if(!players.length){grid.innerHTML='<div class="empty">Нет игроков. Нажми "+ Игрок".</div>';return}
  grid.innerHTML=players.map(p=>{
    const mainH=p.mainHeroes.slice(0,5);
    const isFlex=p.mainRole==='Flex';
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
  const pool=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  const byRole={Tank:[],Damage:[],Support:[]};
  pool.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push({name:n,isMain:p.mainHeroes.includes(n)})});
  const isFlex=p.mainRole==='Flex';
  const hasOff=p.offRole&&p.offRole!==p.mainRole;
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
          ${src?`<img src="${src}" title="${n}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:2px solid ${border}" onerror="this.outerHTML='<div style=width:36px;height:36px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;border:2px solid ${border}>${n[0]}</div>'">`:`<div style="width:36px;height:36px;border-radius:6px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--text3);border:2px solid ${border}">${n[0]}</div>`}
          <div style="width:5px;height:5px;border-radius:50%;background:${isMain?'var(--accent)':'transparent'}"></div>
        </div>`;
      }).join('')}</div>
    </div>`).join('')||'<div class="empty">Герои не указаны</div>';
  const recs=computePlayerRecs(p);
  const recBansHtml=recs.recBans.length?recs.recBans.map(b=>{
    const src=portrait(b.name);const h=heroMap[b.name]||{};
    const avg=Math.round(b.score/b.count);const color=avg>=8?'var(--damage)':avg>=6?'var(--accent)':'var(--text3)';
    return`<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3);border:1px solid ${avg>=8?'rgba(224,85,85,.3)':'var(--border)'}">
      ${src?`<img src="${src}" style="width:28px;height:28px;border-radius:5px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:28px;height:28px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px">${b.name[0]}</div>`}
      <span style="font-size:12px;font-weight:600;flex:1">${b.name}</span>
      ${h.role?`<div style="display:flex;align-items:center;gap:2px">${roleIcon(h.role,13)}${subroleIcon(h.role,h.subrole,13)}</div>`:""}
      <span style="font-family:var(--mono);font-size:9px;color:${color}">${avg>=8?'🔴 БАН':'⚠ КОНТР'}</span>
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
    </div>`).join(''):'';
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
 
let rosterPlayers=[];
function renderRoster(){
  const el=document.getElementById('rosterContent');if(!el)return;
  if(!rosterPlayers.length){el.innerHTML='<div class="empty">Добавь игроков для анализа состава.</div>';return;}
  const recs=computeRosterRecs();
  const playerCards=rosterPlayers.map(p=>{
    const mainH=p.mainHeroes.slice(0,5);
    const isFlex=p.mainRole==='Flex';const hasOff=p.offRole&&p.offRole!==p.mainRole;
    let roleBlock='';
    if(isFlex)roleBlock=roleIcon('Flex',20);
    else if(p.mainRole)roleBlock=roleIcon(p.mainRole,16)+(hasOff?roleIcon(p.offRole,12):'');
    return`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="display:flex;gap:3px;align-items:center">${roleBlock}</div>
        <span style="font-weight:700;font-size:13px">${p.name}</span>
      </div>
      <div style="display:flex;gap:4px">${mainH.map(n=>{const src=portrait(n);return src?`<img src="${src}" title="${n}" style="width:26px;height:26px;border-radius:4px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:26px;height:26px;border-radius:4px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${n[0]}</div>`;}).join('')}</div>
      <button class="btn btn-danger" style="padding:3px 8px;font-size:10px" onclick="removeRosterPlayer('${esc(p.name)}')">✕</button>
    </div>`;
  }).join('');
  const banHtml=recs.bans.length?recs.bans.map(b=>{
    const src=portrait(b.name);const h=heroMap[b.name]||{};const color=b.avg>=8?'var(--damage)':'var(--accent)';
    return`<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3);border:1px solid ${b.avg>=8?'rgba(224,85,85,.3)':'rgba(240,160,48,.2)'}">
      ${src?`<img src="${src}" style="width:28px;height:28px;border-radius:5px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:28px;height:28px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px">${b.name[0]}</div>`}
      <span style="font-size:12px;font-weight:600;flex:1">${b.name}</span>
      ${h.role?`<div style="display:flex;align-items:center;gap:2px">${roleIcon(h.role,13)}${subroleIcon(h.role,h.subrole,13)}</div>`:""}
      <span style="font-family:var(--mono);font-size:9px;color:${color}">${b.count} игрок(ов)</span>
    </div>`;
  }).join(''):'<div class="empty">Нет данных</div>';
  const mapHtml=recs.maps.length?recs.maps.map(m=>`
    <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3);border:1px solid rgba(43,189,142,.25)">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--support);flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${m.type}</span>
      <div class="tier-badge tier-${m.tier}" style="font-size:9px;padding:1px 5px">${m.tier}</div>
      <span style="font-family:var(--mono);font-size:9px;color:var(--support)">+${m.score}</span>
    </div>`).join(''):'<div class="empty">Добавь героев игрокам</div>';
  const avoidHtml=recs.avoid.length?recs.avoid.map(m=>`
    <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;background:var(--bg3)">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--damage);flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--damage)">−${m.score}</span>
    </div>`).join(''):'';
  el.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:1.5rem">${playerCards}</div>
    <div class="detail-grid">
      <div class="d-card"><div class="d-card-title">🔴 Рекомендованные баны</div><div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:8px">Контрпики нескольких игроков</div><div style="display:flex;flex-direction:column;gap:4px">${banHtml}</div></div>
      <div class="d-card"><div class="d-card-title">✅ Предпочтительные карты</div><div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:8px">По сильным картам всех игроков</div><div style="display:flex;flex-direction:column;gap:4px">${mapHtml}</div>${avoidHtml?`<div class="d-card-title" style="margin-top:12px;border:none;padding:0 0 8px">⚠ Избегать</div><div style="display:flex;flex-direction:column;gap:4px">${avoidHtml}</div>`:''}</div>
    </div>`;
}
function computeRosterRecs(){
  const banMap={};
  rosterPlayers.forEach(p=>{
    const allH=[...new Set([...p.mainHeroes,...p.poolHeroes])];
    allH.forEach(hn=>{const h=heroMap[hn];if(!h)return;(h.counters||[]).forEach(c=>{if(!banMap[c.name])banMap[c.name]={name:c.name,totalScore:0,count:0};banMap[c.name].totalScore+=c.score;banMap[c.name].count++;});});
  });
  const bans=Object.values(banMap).map(b=>({...b,avg:Math.round(b.totalScore/b.count)})).filter(b=>b.avg>=6&&b.count>=1).sort((a,b)=>b.count-a.count||b.avg-a.avg).slice(0,8);
  const mapScores={};
  rosterPlayers.forEach(p=>{
    const allH=[...new Set([...p.mainHeroes,...p.poolHeroes])];
    allH.forEach(hn=>{const h=heroMap[hn];if(!h)return;(h.strongMaps||[]).forEach(mn=>{const m=maps.find(x=>x.name===mn);if(!m)return;if(!mapScores[mn])mapScores[mn]={name:mn,score:0,type:m.type,tier:m.tier};mapScores[mn].score+=p.mainHeroes.includes(hn)?2:1;});(h.weakMaps||[]).forEach(mn=>{if(!mapScores[mn]){const m=maps.find(x=>x.name===mn);if(!m)return;mapScores[mn]={name:mn,score:0,type:m.type,tier:m.tier};}mapScores[mn].score-=p.mainHeroes.includes(hn)?2:1;});});
  });
  const mapArr=Object.values(mapScores);
  return{bans,maps:mapArr.filter(m=>m.score>0).sort((a,b)=>b.score-a.score).slice(0,8),avoid:mapArr.filter(m=>m.score<0).sort((a,b)=>a.score-b.score).slice(0,4)};
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
  rosterPlayers.push(p);renderRoster();
}
function removeRosterPlayer(name){rosterPlayers=rosterPlayers.filter(p=>p.name!==name);renderRoster()}
