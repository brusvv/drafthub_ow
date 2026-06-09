// ════ PICKER ════
function openPicker(mode,max=999){
  pickerMode=mode;pickerMax=max;
  pickerRoleFilter='all';
  const titles={preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5)',playerMain:'Топ-5 героев',playerPool:'Пул героев'};
  document.getElementById('pickerTitle').textContent=titles[mode]||'Выбери героев';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}
function openHeroPicker(mode,max){openPicker(mode,max)}
function closePicker(){document.getElementById('pickerOverlay').classList.add('hidden')}
function confirmPicker(){closePicker();renderSelPreview()}

function pickerFilter(role,btn){
  pickerRoleFilter=role;
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderPickerGrid();
}

function togglePickerHero(name){
  const sel=pickerSelected[pickerMode];
  const idx=sel.indexOf(name);
  if(idx>=0)sel.splice(idx,1);
  else if(sel.length<pickerMax)sel.push(name);
  else{toast(`Максимум ${pickerMax} героев`,'err');return}
  renderPickerGrid();
}

function renderPickerGrid(){
  const sel=pickerSelected[pickerMode];
  const filtered=heroes.filter(h=>pickerRoleFilter==='all'||h.role===pickerRoleFilter).sort((a,b)=>b.priority-a.priority);
  document.getElementById('pickerCount').textContent=sel.length+' выбрано';
  document.getElementById('pickerGrid').innerHTML=filtered.map(h=>{
    const src=portrait(h.name);
    const isSelected=sel.includes(h.name);
    return`<div class="p-hero${isSelected?' selected':''}" onclick="togglePickerHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
    </div>`;
  }).join('');
}

function renderSelPreview(){
  const elMap={preferred:'selPreferred',bans:'selBans',comp:'selComp',playerMain:'selPlayerMain',playerPool:'selPlayerPool'};
  Object.entries(elMap).forEach(([mode,elId])=>{
    const el=document.getElementById(elId);if(!el)return;
    const sel=pickerSelected[mode];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(name=>{
      const h=heroMap[name]||{};const src=portrait(name);
      return`<div class="sel-hero-chip ${h.role||''}">
        ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        ${name}
      </div>`;
    }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
}

// ════ MAP TYPE CHANGE ════
function onMapTypeChange(){
  const t=document.getElementById('mType').value;
  const noAD=NO_ATKDEF.includes(t);
  document.getElementById('mAtkDefBlock').style.display=noAD?'none':'grid';
  document.getElementById('mDifBlock').style.display=noAD?'block':'none';
}

// ════ MAP PICKER (для героя: силён/слаб на картах) ════
function openMapPicker(mode){
  mapPickerMode=mode;mapPickerTypeFilter='all';
  const titles={heroStrong:'Карты где герой силён',heroWeak:'Карты где герой слаб'};
  document.getElementById('mapPickerTitle').textContent=titles[mode];
  document.querySelectorAll('#mapPickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderMapPickerGrid();
  document.getElementById('mapPickerOverlay').classList.remove('hidden');
}
function closeMapPicker(){document.getElementById('mapPickerOverlay').classList.add('hidden')}
function confirmMapPicker(){closeMapPicker();renderMapSelPreview()}

function mapPickerFilter(type,btn){
  mapPickerTypeFilter=type;
  document.querySelectorAll('#mapPickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderMapPickerGrid();
}

function toggleMapPicker(name){
  const sel=mapPickerSelected[mapPickerMode];
  const idx=sel.indexOf(name);
  if(idx>=0)sel.splice(idx,1);else sel.push(name);
  renderMapPickerGrid();
}

function renderMapPickerGrid(){
  const sel=mapPickerSelected[mapPickerMode];
  const filtered=maps.filter(m=>mapPickerTypeFilter==='all'||m.type===mapPickerTypeFilter);
  document.getElementById('mapPickerCount').textContent=sel.length+' выбрано';
  const isStrong=mapPickerMode==='heroStrong';
  document.getElementById('mapPickerGrid').innerHTML=filtered.map(m=>{
    const on=sel.includes(m.name);
    return`<div onclick="toggleMapPicker('${esc(m.name)}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:${on?'var(--bg4)':'var(--bg3)'};border:1px solid ${on?(isStrong?'rgba(43,189,142,.4)':'rgba(224,85,85,.4)'):'var(--border)'};cursor:pointer;transition:all .1s">
      <div style="width:6px;height:6px;border-radius:50%;background:${on?(isStrong?'var(--support)':'var(--damage)'):'var(--text3)'};flex-shrink:0"></div>
      <span style="font-size:12px;font-weight:600;flex:1">${m.name}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase">${m.type}</span>
      ${on?`<span style="font-family:var(--mono);font-size:9px;color:${isStrong?'var(--support)':'var(--damage)'}">${isStrong?'Силён':'Слаб'}</span>`:''}
    </div>`;
  }).join('');
}

function renderMapSelPreview(){
  const cfg={heroStrong:{elId:'selHeroStrong',color:'var(--support)'},heroWeak:{elId:'selHeroWeak',color:'var(--damage)'}};
  Object.entries(cfg).forEach(([mode,{elId,color}])=>{
    const el=document.getElementById(elId);if(!el)return;
    const sel=mapPickerSelected[mode];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(n=>`<div style="padding:3px 8px;border-radius:5px;background:var(--bg4);font-size:11px;font-weight:500;border-left:2px solid ${color}">${n}</div>`).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
}
