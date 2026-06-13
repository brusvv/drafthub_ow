// ════ MAPS ════
let mapPoolFilter='active'; // 'active' | 'all'

// Рендерим фильтры с иконками. Активная кнопка — только иконка (текст скрыт)
function renderMapFilters(){
  const el=document.getElementById('mapFilters');if(!el)return;
  const types=['all','Hybrid','Escort','Control','Push','Flashpoint'];
  el.innerHTML=types.map(t=>{
    const isAll=t==='all';
    const active=mapFilter===t;
    // Активный фильтр — иконка + текст когда всё, иначе только иконка
    const label=isAll
      ?'Все'
      :`${mapTypeIcon(t,15)}<span class="f-btn-text">${t}</span>`;
    return`<button class="f-btn${active?' active':''}" onclick="filterMaps('${t}',this)">${label}</button>`;
  }).join('');
}

function renderMaps(){
  renderMapFilters(); // обновляем фильтры с иконками
  const grid=document.getElementById('mapGrid');
  const detail=document.getElementById('mapDetail');
  detail.classList.remove('show');detail.innerHTML='';

  // Пул карт: active = только с приоритетом > 0 (в текущем пуле)
  const poolMaps = mapPoolFilter==='active'
    ? maps.filter(m=>m.priority>0)
    : maps;
  const filtered=poolMaps.filter(m=>mapFilter==='all'||m.type===mapFilter);

  // Обновляем счётчик — увеличенный шрифт
  const countEl=document.getElementById('mapPoolCount');
  if(countEl){
    const n=filtered.length;
    countEl.textContent=`${n} карт${n===1?'а':n>=2&&n<=4?'ы':''}`;
  }
  if(!filtered.length){grid.innerHTML='<div class="empty">Нет карт. Нажми "+ Карта" или Seed.</div>';return}
  grid.innerHTML=filtered.map(m=>{
    const src=mapImg(m.name);
    const noAD=NO_ATKDEF.includes(m.type);
    return`<div class="map-card" onclick="showMapDetail('${esc(m.name)}')">
      ${src?`<img src="${src}" class="map-card-img" alt="${m.name}" onerror="this.outerHTML='<div class=map-card-img-ph>${m.type}</div>'">`:`<div class="map-card-img-ph">${m.type}</div>`}
      <div class="map-card-body">
        <div class="map-card-name">${m.name}</div>
        <div class="map-card-type">${mapTypeIcon(m.type,12)}${mapFilter==='all'?`<span class="f-btn-text">${m.type}</span>`:''}</div>
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
      ${roleIcon(h.role,14)}
      ${ps?`<img src="${ps}" class="hero-row-av" onerror="this.outerHTML='<div class=hero-row-av-ph>${h.name[0]}</div>'">`:`<div class="hero-row-av-ph">${h.name[0]}</div>`}
      <div class="hero-row-info"><div class="hero-row-name">${h.name}</div><div class="hero-row-sub">${subroleIcon(h.role,h.subrole,11)}<span>${h.subrole}</span></div></div>
    </div>`})
  ).join('')||'<div class="empty">Не указаны</div>';

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

  const compHtml=buildCompDisplay(m.comp);

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
        ${counterByRole[r].map(n=>{const ps=portrait(n);return`<div class="ban-chip" style="background:rgba(240,160,48,.06);border-color:rgba(240,160,48,.2)">
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
            :`<div class="m-item">${ICON_ATK}${dots5(m.atk,'atk')}</div>
              <div class="m-item">${ICON_DEF}${dots5(m.def,'def')}</div>`
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
function toggleMapPool(btn){
  mapPoolFilter=mapPoolFilter==='active'?'all':'active';
  btn.textContent=mapPoolFilter==='active'?'АКТУАЛЬНЫЙ':'ВСЕ КАРТЫ';
  btn.classList.toggle('pool-active',mapPoolFilter==='active');
  backToMaps();
}
