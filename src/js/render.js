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

const ruPluralRules=new Intl.PluralRules('ru-RU');
function pluralRu(count,forms){
  const category=ruPluralRules.select(Math.abs(count));
  return forms[category]||forms.other;
}
function heroesCountLabel(count){return `${count} ${pluralRu(count,{one:'герой',few:'героя',many:'героев',other:'героя'})}`}
 
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
@@ -103,51 +110,51 @@ function showMapDetail(name){
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
          <button class="btn" style="margin-top:2.5rem" onclick="closeTierPreview();openMapModal(maps.find(x=>x.name==='${esc(m.name)}'))">✎ Редактировать</button>
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
@@ -165,114 +172,106 @@ function showMapDetail(name){
 
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
 
// ════ HEROES — группировка: роль → подкласс → алфавит ════
function renderHeroes(){
  const pool=document.getElementById('heroPool');
  const roles=heroFilter==='all'?['Tank','Damage','Support']:[heroFilter];
  pool.innerHTML=roles.map(role=>{
    const h=heroes.filter(x=>x.role===role).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
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
        <div class="subrole-lbl">${subroleIcon(role,sub,14)} ${sub}</div>
        <div class="hero-grid">${bySubrole[sub].map(hero=>{
          const src=portrait(hero.name);
          // Top counters (up to 3) with portrait + score
          const topC=(hero.counters||[]).slice().sort((a,b)=>b.score-a.score).slice(0,3);
          const counterChips=topC.map(c=>{
            const csrc=portrait(c.name);
            const cc=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';
            return`<div class="h-counter-icon">
              ${csrc?`<img src="${csrc}" alt="${c.name}" onerror="this.style.display='none'">`:`<div class="h-counter-icon-ph">${c.name[0]}</div>`}
              <div class="h-counter-score" style="color:${cc}">${c.score}</div>
            </div>`;
          }).join('');
          return`<div class="h-card ${hero.banned?'banned':''}" onclick="openHeroModal(heroes.find(x=>x.name==='${esc(hero.name)}'))">
            <div class="h-card-accent" style="background:${rc[hero.role]}"></div>
            ${src?`<img src="${src}" class="h-card-img" alt="${hero.name}" onerror="this.outerHTML='<div class=h-card-img-ph>${hero.name[0]}</div>'">`:`<div class="h-card-img-ph">${hero.name[0]}</div>`}
            ${hero.banned?'<div class="banned-tag">БАН</div>':''}
            ${hero.counters&&hero.counters.some(c=>c.score>=8)?'<div class="h-card-counter-badge">⚠</div>':''}
            <div class="h-card-body">
              <div class="h-card-name">${hero.name}</div>
              ${topC.length?`<div class="h-counter-list">${counterChips}</div>`:''}
            </div>
          </div>`;
        }).join('')}</div>
      </div>`).join('');
 
    return`<div class="role-section">
      <div class="role-header">
        ${roleIcon(role,18)}
        <span class="role-title">${role}</span>
        <span class="role-cnt">${heroesCountLabel(h.length)}</span>
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

@@ -354,83 +353,84 @@ async function saveTierHeroesSheets(){
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
            data-tier="${t}" data-type="maps" data-name="${esc(name)}"
            ondragstart="onDragStart(event,'maps','${t}',${idx})"
            ondragend="onDragEnd(event)"
            onclick="openTierMapPreview('${esc(name)}')">
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
            data-tier="${t}" data-type="heroes" data-name="${esc(name)}"
            ondragstart="onDragStart(event,'heroes','${t}',${idx})"
            ondragend="onDragEnd(event)"
            onclick="openTierHeroPreview('${esc(name)}')">
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
@@ -450,50 +450,98 @@ function onDrop(e,type,toTier){
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
 
function closeTierPreview(){const el=document.getElementById('tierPreviewOverlay');if(el)el.remove();}
function openTierPreview(title,body,actions=''){
  closeTierPreview();
  document.body.insertAdjacentHTML('beforeend',`<div class="tier-preview-overlay" id="tierPreviewOverlay" onclick="if(event.target.id==='tierPreviewOverlay')closeTierPreview()">
    <div class="tier-preview-box">
      <div class="tier-preview-head">
        <div class="tier-preview-title">${title}</div>
        <button class="tier-preview-close" onclick="closeTierPreview()">×</button>
      </div>
      <div class="tier-preview-body">${body}</div>
      ${actions?`<div class="tier-preview-actions">${actions}</div>`:''}
    </div>
  </div>`);
}
function openTierMapPreview(name){
  const m=maps.find(x=>x.name===name);if(!m)return;
  const src=mapImg(m.name);const noAD=NO_ATKDEF.includes(m.type);
  const body=`
    ${src?`<img src="${src}" class="tier-preview-banner" alt="${m.name}" onerror="this.outerHTML='<div class=tier-preview-banner-ph>${m.type}</div>'">`:`<div class="tier-preview-banner-ph">${m.type}</div>`}
    <div class="tier-preview-meta">
      <span class="tier-badge tier-${m.tier}">${m.tier}</span>
      <span>${mapTypeIcon(m.type,14)} ${m.type}</span>
      <span>Приоритет #${m.priority}</span>
    </div>
    <div class="tier-preview-stats">
      ${noAD?`<div>${ICON_DIF}<span>Сложность</span>${dots5(m.dif,'dif')}</div>`:`<div>${ICON_ATK}<span>ATK</span>${dots5(m.atk,'atk')}</div><div>${ICON_DEF}<span>DEF</span>${dots5(m.def,'def')}</div>`}
    </div>
    ${m.notes?`<div class="tier-preview-notes">${m.notes}</div>`:''}`;
  const actions=`<button class="btn" onclick="closeTierPreview();goToMap('${esc(m.name)}')">Открыть карточку</button><button class="btn btn-primary" onclick="closeTierPreview();openMapModal(maps.find(x=>x.name==='${esc(m.name)}'))">✎ Редактировать</button>`;
  openTierPreview(m.name,body,actions);
}
function openTierHeroPreview(name){
  const h=heroMap[name];if(!h)return;
  const src=portrait(h.name);
  const counters=(h.counters||[]).slice().sort((a,b)=>b.score-a.score).slice(0,5);
  const counterHtml=counters.length?`<div class="tier-preview-section"><div class="tier-preview-section-title">Контрпики</div><div class="h-counter-list tier-preview-counters">${counters.map(c=>{const csrc=portrait(c.name);const cc=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';return`<div class="h-counter-icon" title="${c.name}">${csrc?`<img src="${csrc}" alt="${c.name}" onerror="this.style.display='none'">`:`<div class="h-counter-icon-ph">${c.name[0]}</div>`}<div class="h-counter-score" style="color:${cc}">${c.score}</div></div>`;}).join('')}</div></div>`:'';
  const body=`<div class="tier-hero-preview-card">
    ${src?`<img src="${src}" class="tier-hero-preview-img" alt="${h.name}" onerror="this.outerHTML='<div class=tier-hero-preview-ph>${h.name[0]}</div>'">`:`<div class="tier-hero-preview-ph">${h.name[0]}</div>`}
    <div class="tier-hero-preview-info">
      <div class="tier-preview-meta"><span>${roleIcon(h.role,16)} ${h.role}</span><span>${subroleIcon(h.role,h.subrole,14)} ${h.subrole||'Other'}</span><span>Приоритет #${h.priority}</span>${h.banned?'<span class="tier-preview-ban">БАН</span>':''}</div>
      ${counterHtml}
      ${h.notes?`<div class="tier-preview-notes">${h.notes}</div>`:''}
    </div>
  </div>`;
  const actions=`<button class="btn btn-primary" onclick="closeTierPreview();openHeroModal(heroes.find(x=>x.name==='${esc(h.name)}'))">✎ Редактировать</button>`;
  openTierPreview(h.name,body,actions);
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
@@ -752,51 +800,51 @@ function renderRoster(){
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
      <span style="font-size:14px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${m.type}</span>
      <div class="tier-badge tier-${m.tier}" style="font-size:9px;padding:1px 5px">${m.tier}</div>
      <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--support)">+${m.score}</span>
    </div>`).join(''):'<div class="empty">Добавь героев игрокам</div>';
  const avoidHtml=recs.avoid.length?recs.avoid.map(m=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--bg3)">
      <div style="width:7px;height:7px;border-radius:50%;background:var(--damage);flex-shrink:0"></div>
      <span style="font-size:14px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--damage)">−${m.score}</span>
    </div>`).join(''):'';

  el.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:1.5rem">${playerCards}</div>
    <div class="detail-grid">
