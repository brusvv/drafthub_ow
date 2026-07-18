// @hash 2630a2e4 2026-07-18T02:37
// ════ RENDER — TIERS: РЯДЫ S/A/B/C/D + DRAG&DROP ════
// Часть группы render-tiers-*.js (FILESPLIT-1, 03.07) — см. шапку
// render-tiers.js за общим описанием разбивки.
//
// initTierMaps/initTierHeroes — синхронизация tierOrderMaps/tierOrderHeroes
// с текущим ростером (добавляет новое, чистит удалённое). renderTierMaps/
// renderTierHeroes — сам рендер рядов + фоллбек на каталог (data/db/db-load.js
// _heroCatalogByName/_mapCatalogByName) когда team-scoped maps[]/heroMap
// пустые (публичный/глобальный режим без авторизации).
//
// Зависимости: render-tiers.js (_canEditCurrentTier, store proxies),
//              render-tiers-preview.js (openTierMapPreview/openTierHeroPreview
//              — вызываются из onclick в разметке пилюль), data/db/db-write.js
//              (saveTierOrder), data/db/db-load.js (_heroCatalogByName, _mapCatalogByName)

function initTierMaps(){
  // Глобальный тир-лист не привязан к ростеру конкретной команды — нет
  // массива maps, по которому можно проверить «устарела запись или нет».
  // Без этой ранней проверки строки tierOrderMaps (= globalTierMaps)
  // были бы вычищены целиком, т.к. maps=[] для анонимного/глобального режима.
  if(tierViewMode === 'global') return;

  const allNames = maps.map(m => m.name);
  const inTiers  = new Set(Object.values(tierOrderMaps).flat());
  allNames.filter(n => !inTiers.has(n)).forEach(n => {
    const m = maps.find(x => x.name === n);
    const tier = m ? m.tier : 'B';
    if(!tierOrderMaps[tier]) tierOrderMaps[tier] = [];
    tierOrderMaps[tier].push(n);
  });
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

let _tmTimer = null, _thTimer = null;

function saveTierMaps(){
  clearTimeout(_tmTimer);
  _tmTimer = setTimeout(() => {
    if(_canEditCurrentTier()) saveTierOrder('map', tierOrderMaps);  // data/db/db-write.js
  }, 800);
}
function saveTierHeroes(){
  clearTimeout(_thTimer);
  _thTimer = setTimeout(() => {
    if(_canEditCurrentTier()) saveTierOrder('hero', tierOrderHeroes);  // data/db/db-write.js
  }, 800);
}

function renderTierMaps(){
  initTierMaps();
  const el=document.getElementById('tierListMaps');
  el.innerHTML=['S','A','B','C','D'].map(t=>{
    const items=tierOrderMaps[t]||[];
    const style=ts[t];
    return`<div class="tier-row" data-tier="${t}" data-editable="${_canEditCurrentTier()}">
      <div class="tier-lbl" style="background:${style.bg};color:${style.c}">${t}</div>
      <div class="tier-maps" id="tierMapZone_${t}"
        ondragover="onDragOver(event,'maps','${t}')"
        ondrop="onDrop(event,'maps','${t}')"
        ondragleave="onDragLeave(event)">
        ${items.map((name,idx)=>{
          const m=maps.find(x=>x.name===name);
          // Fallback к map_catalog (db-load.js) если maps[] пуст (неавторизованный,
          // глобальный режим) — каталог публичный и не team-scoped, грузится всегда
          const mapType = m?.type ?? _mapCatalogByName[name]?.type;
          const hidden=tierMapTypeFilter!=='all'&&(mapType&&mapType!==tierMapTypeFilter);
          return`<div class="tier-pill${hidden?' tier-pill-hidden':''}" draggable="${_canEditCurrentTier()}"
            data-tier="${t}" data-type="maps" data-name="${escAttr(name)}"
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
  // DESIGN-1: сквозной счётчик через все 5 тиров (S/A/B/C/D), не сбрасывается
  // на каждом — та же логика что в render-heroes.js для подролей: иначе
  // fade-up анимация "перезапускалась" бы с задержки 0 в начале каждого тира,
  // выглядело бы как повторяющийся рывок вместо одной волны сверху вниз.
  let _cardIdx=0;
  el.innerHTML=['S','A','B','C','D'].map(t=>{
    const items=tierOrderHeroes[t]||[];
    const style=ts[t];
    return`<div class="tier-row" data-tier="${t}" data-editable="${_canEditCurrentTier()}">
      <div class="tier-lbl" style="background:${style.bg};color:${style.c}">${t}</div>
      <div class="tier-maps" id="tierHeroZone_${t}"
        ondragover="onDragOver(event,'heroes','${t}')"
        ondrop="onDrop(event,'heroes','${t}')"
        ondragleave="onDragLeave(event)">
        ${items.map((name,idx)=>{
          const h=heroMap[name];   // undefined в global-режиме без auth — не заменяем на {},
          // иначе {} truthy → h.role=undefined → undefined!=='Tank'=true → все герои скрыты
          const src=portrait(name);
          // Fallback к hero_catalog (db-load.js) если heroes[] пуст (неавторизованный) —
          // каталог публичный и не team-scoped, грузится всегда (было: OW_HERO_ROLE из config.js)
          const catHero=_heroCatalogByName[name];
          const heroRole=h?.role??catHero?.role;
          const heroSubrole=h?.subrole??catHero?.subrole;
          const hidden=tierHeroRoleFilter!=='all'&&heroRole&&heroRole!==tierHeroRoleFilter;
          const tipText=heroSubrole?`${name} · ${heroSubrole}`:name;
          return`<div class="tier-hero-pill${hidden?' tier-pill-hidden':''}" style="--card-i:${Math.min(_cardIdx++,12)}" draggable="${_canEditCurrentTier()}"
            data-tier="${t}" data-type="heroes" data-name="${escAttr(name)}" data-role="${heroRole||''}"
            ondragstart="onDragStart(event,'heroes','${t}',${idx})"
            ondragend="onDragEnd(event)"
            onclick="openTierHeroPreview('${esc(name)}')">
            ${src?`<img src="${src}" alt="${escAttr(name)}" onerror="this.outerHTML='<div class=tier-hero-pill-ph>${escAttr(name[0])}</div>'">`:`<div class="tier-hero-pill-ph">${escAttr(name[0])}</div>`}
            <div class="tier-hero-pill-tip">${escAttr(tipText)}</div>
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

  // Читаем из let-переменной (data/db/db-load-tiers.js), а не из store —
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
      if(e.clientY < r.top){targetPill=pill;break;}
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
