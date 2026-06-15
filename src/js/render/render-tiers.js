// @hash 2366901a 2026-06-15T10:35
// ── Store proxies ──
Object.defineProperties(window, {
  tierOrderMaps:    { get(){ return store.get('tierOrderMaps'); },    set(v){ store.set('tierOrderMaps',v); },    configurable:true },
  tierOrderHeroes:  { get(){ return store.get('tierOrderHeroes'); },  set(v){ store.set('tierOrderHeroes',v); },  configurable:true },
  tierMapTypeFilter:{ get(){ return store.get('tierMapTypeFilter'); }, set(v){ store.set('tierMapTypeFilter',v); },configurable:true },
  tierHeroRoleFilter:{ get(){ return store.get('tierHeroRoleFilter'); },set(v){ store.set('tierHeroRoleFilter',v); },configurable:true },
  dragItem: { get(){ return store.get('dragItem'); }, set(v){ store.set('dragItem',v); }, configurable:true },
  dragType: { get(){ return store.get('dragType'); }, set(v){ store.set('dragType',v); }, configurable:true },
});

// ════ TIER LIST — D&D ════

// Состояние тирлистов (сохраняется локально)
// [store] tierOrderMaps → store.state
// [store] tierOrderHeroes → store.state
// [store] tierMapTypeFilter → store.state
// [store] tierHeroRoleFilter → store.state

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
// [store] dragItem/dragType → store.state

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
            ${m&&tierMapTypeFilter==='all'?`<span class="tier-pill-type">${mapTypeIcon(m.type,14)}</span>`:''}
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
          const h=heroMap[name]||{};
          const src=portrait(name);
          const hidden=tierHeroRoleFilter!=='all'&&(!h||h.role!==tierHeroRoleFilter);
          const tipText=h.subrole?`${name} · ${h.subrole}`:name;
          return`<div class="tier-hero-pill${hidden?' tier-pill-hidden':''}" draggable="true"
            data-tier="${t}" data-type="heroes" data-name="${esc(name)}" data-role="${h.role||''}"
            ondragstart="onDragStart(event,'heroes','${t}',${idx})"
            ondragend="onDragEnd(event)"
            onclick="openTierHeroPreview('${esc(name)}')">
            ${src?`<img src="${src}" alt="${name}" onerror="this.outerHTML='<div class=tier-hero-pill-ph>${name[0]}</div>'">`:`<div class="tier-hero-pill-ph">${name[0]}</div>`}
            <div class="tier-hero-pill-tip">${tipText}</div>
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

  const{name,tier:fromTier}=dragItem;

  // Работаем с явной копией чтобы избежать proxy-мутаций
  const snap=JSON.parse(JSON.stringify(
    type==='maps'?store.get('tierOrderMaps'):store.get('tierOrderHeroes')
  ));

  // 1. Убираем из исходного тира
  snap[fromTier]=(snap[fromTier]||[]).filter(n=>n!==name);
  if(!snap[toTier])snap[toTier]=[];

  const zone=e.currentTarget;

  // 2. Все пилюли в DOM-порядке (совпадает с порядком в snap[toTier] до удаления)
  const allPills=[...zone.querySelectorAll('[draggable]')];

  // Индекс перетаскиваемой пилюли — нужен для поправки смещения при drag внутри тира
  const draggedDomIdx=allPills.findIndex(el=>el.classList.contains('dragging'));

  // Только видимые, не перетаскиваемые пилюли — для расчёта позиции
  const visPills=allPills.filter(el=>
    !el.classList.contains('tier-pill-hidden')&&
    !el.classList.contains('dragging')
  );

  if(visPills.length===0){
    // Зона пустая → добавляем в конец
    snap[toTier].push(name);
  }else{
    // 3. Ищем пилюлю, ПЕРЕД которой нужно вставить
    // Учитываем flex-wrap: сравниваем и Y (строка) и X (позиция в строке)
    let targetPill=null;
    for(const pill of visPills){
      const r=pill.getBoundingClientRect();
      // Курсор выше начала этой строки → вставить перед ней
      const aboveRow=e.clientY<r.top;
      // Курсор на той же строке, в левой половине → тоже перед ней
      const sameRowLeft=e.clientY<=r.bottom&&e.clientX<r.left+r.width/2;
      if(aboveRow||sameRowLeft){targetPill=pill;break;}
    }

    // 4. Переводим DOM-индекс в индекс массива
    // Если перетаскиваемый элемент стоял ДО целевого в DOM,
    // то после его удаления из snap всё сдвинулось влево на 1
    const domToOrderIdx=(domIdx,insertBefore)=>{
      const shift=(draggedDomIdx!==-1&&draggedDomIdx<domIdx)?1:0;
      const orderIdx=domIdx-shift;
      return insertBefore?orderIdx:orderIdx+1;
    };

    let spliceIdx;
    if(targetPill){
      // Вставляем ПЕРЕД целевой пилюлей
      spliceIdx=domToOrderIdx(allPills.indexOf(targetPill),true);
    }else{
      // Курсор после последней видимой → вставляем ПОСЛЕ неё
      const lastPill=visPills[visPills.length-1];
      spliceIdx=domToOrderIdx(allPills.indexOf(lastPill),false);
    }

    // Clamp на случай edge-cases
    spliceIdx=Math.max(0,Math.min(spliceIdx,snap[toTier].length));
    snap[toTier].splice(spliceIdx,0,name);
  }

  // 5. Записываем обратно через proxy-сеттер и сохраняем
  if(type==='maps'){tierOrderMaps=snap;saveTierMaps();renderTierMaps();}
  else{tierOrderHeroes=snap;saveTierHeroes();renderTierHeroes();}
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

  // Preferred heroes — grouped by role
  const byRole={Tank:[],Damage:[],Support:[]};
  (m.preferredHeroes||[]).forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push(n);});
  const prefHtml=['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div style="margin-bottom:6px">
      <div style="font-family:var(--mono);font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:${rc[r]};margin-bottom:4px">${r}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${byRole[r].map(n=>{const ps=portrait(n);return`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:5px;background:var(--bg3)">
          ${ps?`<img src="${ps}" style="width:18px;height:18px;border-radius:3px;object-fit:cover" onerror="this.style.display='none'">`:''}
          <span style="font-size:11px;font-weight:600">${n}</span>
        </div>`;}).join('')}
      </div>
    </div>`).join('');

  // Bans — grouped by role
  const banByRole={Tank:[],Damage:[],Support:[]};
  (m.bans||[]).forEach(n=>{const h=heroMap[n];const role=h?h.role:'Damage';if(!banByRole[role])banByRole[role]=[];banByRole[role].push(n);});
  const bansHtml=['Tank','Damage','Support'].filter(r=>banByRole[r].length).map(r=>`
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">
      ${banByRole[r].map(n=>{const ps=portrait(n);return`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:5px;background:rgba(224,85,85,.08);border:1px solid rgba(224,85,85,.2)">
        ${ps?`<img src="${ps}" style="width:16px;height:16px;border-radius:3px;object-fit:cover" onerror="this.style.display='none'">`:''}
        <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--damage)">${n}</span>
      </div>`;}).join('')}
    </div>`).join('');

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
    ${prefHtml?`<div class="tier-preview-section"><div class="tier-preview-section-title">Предпочтительные герои</div>${prefHtml}</div>`:''}
    ${bansHtml?`<div class="tier-preview-section"><div class="tier-preview-section-title">Цели для банов</div>${bansHtml}</div>`:''}
    ${m.notes?`<div class="tier-preview-notes">${m.notes}</div>`:''}`;
  const actions=`<button class="btn" onclick="closeTierPreview();goToMap('${esc(m.name)}')">Открыть карточку</button><button class="btn btn-primary" onclick="closeTierPreview();openMapModal(maps.find(x=>x.name==='${esc(m.name)}'))">✎ Редактировать</button>`;
  openTierPreview(m.name,body,actions);
}
function openTierHeroPreview(name){
  // Используем единый попап из render-heroes.js
  if(typeof openHeroInfoPopup === 'function') openHeroInfoPopup(name);
}

function goToMap(name){showView('maps',document.querySelectorAll('.nav-btn')[0]);mapFilter='all';document.querySelectorAll('#mapFilters .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));renderMaps();setTimeout(()=>showMapDetail(name),30)}
