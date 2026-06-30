// @hash 055549fe 2026-06-27T13:22
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
  const switcherEl = document.getElementById('tierModeSwitcher');
  if(switcherEl) switcherEl.innerHTML = _renderTierModeSwitcher();

  // ── Фаза 4: выпадающее меню сетов в personal режиме ──
  const setsEl = document.getElementById('tierSetSelector');
  if(setsEl) setsEl.innerHTML = tierViewMode === 'personal' ? _renderTierSetSelector() : '';

  renderTierMaps();
  renderTierHeroes();

  // Держим переключатель в хедере в синхроне (вдруг сюда попали
  // не через него, а через локальный _renderTierModeSwitcher() ниже)
  if(typeof renderAppModeSwitcher === 'function') renderAppModeSwitcher();
}

// ── Переключатель уровней тир-листа ──────────────────────────
function _renderTierModeSwitcher(){
  // Фаза 3: в публичном режиме показываем только global без кнопок переключения
  if(isPublicMode()) {
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
        <span style="font-family:var(--mono);font-size:9px;text-transform:uppercase;
          letter-spacing:.1em;color:var(--text3)">🌐 Глобальный тир-лист</span>
        <span style="margin-left:auto">
          <button class="btn btn-sm" onclick="renderAuthUI('login')">Войти</button>
        </span>
      </div>`;
  }

  const modes = [
    { key:'global',   label:'Глобальный', icon:'🌐' },
    { key:'team',     label:'Командный',  icon:'👥' },
    { key:'personal', label:'Личный',     icon:'👤' },
  ];
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-family:var(--mono);font-size:9px;text-transform:uppercase;
        letter-spacing:.1em;color:var(--text3)">Тир-лист:</span>
      ${modes.map(m => `
        <button class="f-btn${tierViewMode===m.key?' active':''}"
          onclick="switchTierMode('${m.key}')" style="font-size:11px">
          ${m.icon} ${m.label}
        </button>`).join('')}
      ${tierViewMode === 'personal'
        ? `<button class="btn" onclick="renderTierSharePanel()"
            style="font-size:10px;margin-left:auto">🔗 Поделиться</button>`
        : ''}
    </div>`;
}

// ── Фаза 4: выпадающее меню тир-сетов ────────────────────────
function _renderTierSetSelector(){
  if(!tierSets.length) {
    // Нет сетов — показываем только кнопку создания
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:11px;color:var(--text3)">Нет личных тир-листов</span>
        <button class="btn btn-primary btn-sm" onclick="_showCreateTierSetForm()">+ Создать</button>
      </div>
      <div id="createTierSetForm" style="display:none"></div>`;
  }

  const active = tierSets.find(s => s.id === activeTierSetId);
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <div class="tier-set-menu" style="position:relative">
        <button class="f-btn active" onclick="_toggleTierSetDropdown()" style="font-size:11px;min-width:120px">
          📋 ${active?.name ?? 'Тир-лист'} ▾
        </button>
        <div id="tierSetDropdown" style="display:none;position:absolute;top:100%;left:0;z-index:100;
          background:var(--bg2);border:1px solid var(--border);border-radius:8px;
          min-width:200px;padding:4px;margin-top:4px;box-shadow:0 4px 16px rgba(0,0,0,.4)">
          ${tierSets.map(s => `
            <div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:5px;
              background:${s.id===activeTierSetId?'var(--bg3)':'transparent'};cursor:pointer"
              onclick="switchTierSet('${s.id}');_closeTierSetDropdown()">
              <span style="flex:1;font-size:12px">${s.name}</span>
              ${s.is_default?'<span style="font-size:9px;color:var(--text3)">по умолчанию</span>':''}
              <button class="btn" onclick="event.stopPropagation();_openTierSetMenu('${s.id}','${esc(s.name)}')"
                style="font-size:9px;padding:1px 5px">⋯</button>
            </div>`).join('')}
          <div style="border-top:1px solid var(--border);margin:4px 0;padding-top:4px">
            <button class="btn btn-primary" onclick="_showCreateTierSetForm();_closeTierSetDropdown()"
              style="width:100%;font-size:10px">+ Создать тир-лист</button>
          </div>
        </div>
      </div>
      <span style="font-size:10px;color:var(--text3)">${tierSets.length}/10</span>
    </div>
    <div id="createTierSetForm" style="display:none;margin-bottom:10px"></div>`;
}

function _toggleTierSetDropdown(){
  const el = document.getElementById('tierSetDropdown');
  if(!el) return;
  const isOpen = el.style.display !== 'none';
  if(isOpen) { _closeTierSetDropdown(); return; }
  el.style.display = 'block';
  // Закрываем при клике снаружи
  setTimeout(() => document.addEventListener('click', _closeTierSetDropdown, { once: true }), 0);
}

function _closeTierSetDropdown(){
  const el = document.getElementById('tierSetDropdown');
  if(el) el.style.display = 'none';
}

function _showCreateTierSetForm(){
  const el = document.getElementById('createTierSetForm');
  if(!el) return;
  if(el.style.display !== 'none') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center">
      <input class="form-input" id="newTierSetName" placeholder="Название (напр. S14 Meta)"
        style="font-size:11px;padding:5px 8px" maxlength="40"
        onkeydown="if(event.key==='Enter')_submitCreateTierSet()">
      <button class="btn btn-primary btn-sm" onclick="_submitCreateTierSet()">Создать</button>
      <button class="btn btn-sm" onclick="this.closest('#createTierSetForm').style.display='none'">✕</button>
    </div>`;
  document.getElementById('newTierSetName')?.focus();
}

async function _submitCreateTierSet(){
  const name = document.getElementById('newTierSetName')?.value?.trim();
  if(!name) { toast('Укажи название', 'err'); return; }
  await createTierSet(name);  // db-write.js
  // renderTiers() вызывается внутри createTierSet
}

function _openTierSetMenu(setId, setName){
  // Контекстное меню для конкретного сета: переименовать / сделать дефолтным / удалить
  const active = tierSets.find(s => s.id === setId);
  openTierPreview(`📋 ${setName}`, `
    <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0">
      <button class="btn btn-full" onclick="_renameTierSetPrompt('${setId}','${esc(setName)}');closeTierPreview()">✎ Переименовать</button>
      ${!active?.is_default ? `<button class="btn btn-full" onclick="setDefaultTierSet('${setId}');closeTierPreview()">★ Сделать по умолчанию</button>` : ''}
      <button class="btn btn-danger btn-full" onclick="deleteTierSet('${setId}');closeTierPreview()">✕ Удалить</button>
    </div>`);
}

function _renameTierSetPrompt(setId, currentName){
  const name = prompt('Новое название:', currentName);
  if(name?.trim()) renameTierSet(setId, name.trim());  // db-write.js
}

// Может ли пользователь редактировать ТЕКУЩИЙ активный уровень тир-листа
function _canEditCurrentTier(){
  if(isPublicMode())              return false;   // фаза 3
  if(tierViewMode === 'global')   return isSuperAdmin();   // фаза 7
  if(tierViewMode === 'personal') return true;
  return canWrite();
}

function initTierMaps(){
  // Глобальный тир-лист не привязан к ростеру конкретной команды — нет
  // массива maps, по которому можно проверить «устарела запись или нет».
  // Без этой ранней проверки строки tierOrderMaps (= globalTierMaps)
  // были бы вычищены целиком, т.к. maps=[] для анонимного/глобального режима.
  if(tierViewMode === 'global') return;

  // В Supabase-версии данные приходят через loadTiers() → tierOrderMaps уже заполнен.
  // Сохраняем совместимость: добавляем новые карты которых нет ни в одном тире.
  const allNames = maps.map(m => m.name);
  const inTiers  = new Set(Object.values(tierOrderMaps).flat());
  allNames.filter(n => !inTiers.has(n)).forEach(n => {
    const m = maps.find(x => x.name === n);
    const tier = m ? m.tier : 'B';
    if(!tierOrderMaps[tier]) tierOrderMaps[tier] = [];
    tierOrderMaps[tier].push(n);
  });
  // Удаляем устаревшие записи
  const nameSet = new Set(allNames);
  ['S','A','B','C','D'].forEach(t => { tierOrderMaps[t] = (tierOrderMaps[t]||[]).filter(n => nameSet.has(n)); });
}

function initTierHeroes(){
  if(tierViewMode === 'global') return;   // см. initTierMaps

  const allNames = heroes.map(h => h.name);
  const inTiers  = new Set(Object.values(tierOrderHeroes).flat());
  allNames.filter(n => !inTiers.has(n)).forEach(n => {
    const h = heroes.find(x => x.name === n);
    const tier = h ? (h.priority>=9?'S':h.priority>=7?'A':h.priority>=5?'B':h.priority>=3?'C':'D') : 'C';
    if(!tierOrderHeroes[tier]) tierOrderHeroes[tier] = [];
    tierOrderHeroes[tier].push(n);
  });
  const nameSet = new Set(allNames);
  ['S','A','B','C','D'].forEach(t => { tierOrderHeroes[t] = (tierOrderHeroes[t]||[]).filter(n => nameSet.has(n)); });
}

// ── Сохранение через Supabase (db-write.js) вместо Google Sheets ──
let _tmTimer = null, _thTimer = null;

function saveTierMaps(){
  clearTimeout(_tmTimer);
  _tmTimer = setTimeout(() => {
    if(_canEditCurrentTier()) saveTierOrder('map', tierOrderMaps);  // db-write.js
  }, 800);
}
function saveTierHeroes(){
  clearTimeout(_thTimer);
  _thTimer = setTimeout(() => {
    if(_canEditCurrentTier()) saveTierOrder('hero', tierOrderHeroes);  // db-write.js
  }, 800);
}

// drag state
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
          // Фильтр по типу карты: прячем только если объект карты найден И тип не совпадает.
          // Если m=undefined (глобальный режим, нет командных данных) — не прячем,
          // иначе при любом фильтре весь тир-лист пустеет у неавторизованных.
          const hidden=tierMapTypeFilter!=='all'&&(m&&m.type!==tierMapTypeFilter);
          return`<div class="tier-pill${hidden?' tier-pill-hidden':''}" draggable="${_canEditCurrentTier()}"
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
          // Фильтр по роли: прячем только если герой найден И роль не совпадает.
          const hidden=tierHeroRoleFilter!=='all'&&(h&&h.role!==tierHeroRoleFilter);
          const tipText=h.subrole?`${name} · ${h.subrole}`:name;
          return`<div class="tier-hero-pill${hidden?' tier-pill-hidden':''}" draggable="${_canEditCurrentTier()}"
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
  if(!_canEditCurrentTier()){ e.preventDefault(); return; }
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
  if(!_canEditCurrentTier()||type!==dragType)return;
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
  if(!dragItem||type!==dragType||!_canEditCurrentTier())return;

  const{name,tier:fromTier}=dragItem;

  // Читаем из let-переменной (db-load.js), а не из store —
  // let tierOrderMaps/tierOrderHeroes и window-proxy на store это РАЗНЫЕ binding'и
  // в одном скрипте. store.get() не видит изменений сделанных через let.
  const snap=JSON.parse(JSON.stringify(
    type==='maps' ? tierOrderMaps : tierOrderHeroes
  ));

  snap[fromTier]=(snap[fromTier]||[]).filter(n=>n!==name);
  if(!snap[toTier])snap[toTier]=[];

  const zone=e.currentTarget;
  const allPills=[...zone.querySelectorAll('[draggable]')];
  const draggedDomIdx=allPills.findIndex(el=>el.classList.contains('dragging'));
  const visPills=allPills.filter(el=>
    !el.classList.contains('tier-pill-hidden')&&
    !el.classList.contains('dragging')
  );

  if(visPills.length===0){
    snap[toTier].push(name);
  }else{
    let targetPill=null;
    for(const pill of visPills){
      const r=pill.getBoundingClientRect();
      // Курсор выше этой строки → вставить перед
      if(e.clientY < r.top){targetPill=pill;break;}
      // Курсор на той же строке — сравниваем по X центра пилюли
      // Используем строгое сравнение: курсор должен быть ЛЕВЕЕ центра
      // (без -2px буфера чтобы избежать «прилипания» к первой позиции)
      if(e.clientY <= r.bottom && e.clientX < r.left+r.width/2-2){targetPill=pill;break;}
    }

    const domToOrderIdx=(domIdx,insertBefore)=>{
      const shift=(draggedDomIdx!==-1&&draggedDomIdx<domIdx)?1:0;
      const orderIdx=domIdx-shift;
      return insertBefore?orderIdx:orderIdx+1;
    };

    let spliceIdx;
    if(targetPill){
      spliceIdx=domToOrderIdx(allPills.indexOf(targetPill),true);
    }else{
      const lastPill=visPills[visPills.length-1];
      spliceIdx=domToOrderIdx(allPills.indexOf(lastPill),false);
    }

    spliceIdx=Math.max(0,Math.min(spliceIdx,snap[toTier].length));
    snap[toTier].splice(spliceIdx,0,name);
  }

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
  const actions=_canEditCurrentTier()
    ? `<button class="btn" onclick="closeTierPreview();goToMap('${esc(m.name)}')">Открыть карточку</button><button class="btn btn-primary" onclick="closeTierPreview();openMapModal(maps.find(x=>x.name==='${esc(m.name)}'))">✎ Редактировать</button>`
    : `<button class="btn" onclick="closeTierPreview();goToMap('${esc(m.name)}')">Открыть карточку</button>`;
  openTierPreview(m.name,body,actions);
}
function openTierHeroPreview(name){
  if(typeof openHeroInfoPopup === 'function') openHeroInfoPopup(name);
}

function goToMap(name){showView('maps',document.querySelectorAll('.nav-btn')[0]);mapFilter='all';document.querySelectorAll('#mapFilters .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));renderMaps();setTimeout(()=>showMapDetail(name),30);}
