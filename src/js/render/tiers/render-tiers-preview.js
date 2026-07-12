// ════ RENDER — TIERS: ПОПАПЫ КАРТОЧКИ КАРТЫ/ГЕРОЯ ════
// Часть группы render-tiers-*.js (FILESPLIT-1, 03.07) — см. шапку
// render-tiers.js за общим описанием разбивки.
//
// openTierMapPreview/openTierHeroPreview вызываются из onclick разметки
// пилюль в render-tiers-dnd.js. openTierPreview/closeTierPreview — общий
// generic popup-контейнер, используется и здесь, и render-tiers.js
// (_openTierSetMenu — меню управления сетом переиспользует тот же попап).
//
// Зависимости: render-tiers.js (_canEditCurrentTier), render-tiers-dnd.js
// (не вызывает функции отсюда напрямую — только onclick в разметке)

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
      <div class="chip-row">
        ${byRole[r].map(n=>{const ps=portrait(n);return`<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:5px;background:var(--bg3)">
          ${ps?`<img src="${ps}" class="icon-sm" onerror="this.style.display='none'">`:''}
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
