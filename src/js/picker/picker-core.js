// ════ PICKER — CORE ════

function openPicker(mode,max=999){
  pickerMode=mode;pickerMax=max;pickerRoleFilter='all';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{b.style.display='';});
  const titles={
    preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5)',
    playerMain:'Топ-5 героев',playerPool:'Пул героев',banHeroes:'Наши герои'
  };
  document.getElementById('pickerTitle').textContent=titles[mode]||'Выбери героев';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function openHeroPicker(mode,max,roleFilter){
  pickerMode=mode;pickerMax=max;pickerRoleFilter=roleFilter||'all';
  const titles={preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5)'};
  document.getElementById('pickerTitle').textContent=titles[mode]||'Выбери героев';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
    const r=b.getAttribute('onclick')||'';
    b.classList.toggle('active',r.includes(`'${pickerRoleFilter}'`)||r.includes(`"${pickerRoleFilter}"`));
  });
  if(pickerRoleFilter==='all')document.querySelectorAll('#pickerOverlay .f-btn')[0].classList.add('active');
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function openRoleHeroPicker(role){
  const key=`playerRole_${role}`;
  if(!pickerSelected[key])pickerSelected[key]=[];
  pickerMode=key;pickerMax=5;pickerRoleFilter=role;
  document.getElementById('pickerTitle').textContent=`Топ-5 героев — ${role}`;
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
    const r=b.getAttribute('onclick')||'';
    const isThisRole=r.includes(`'${role}'`)||r.includes(`"${role}"`);
    b.style.display=isThisRole?'':'none';
    b.classList.toggle('active',isThisRole);
  });
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function closePicker(){document.getElementById('pickerOverlay').classList.add('hidden')}

function pickerFilter(role,btn){
  pickerRoleFilter=role;
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderPickerGrid();
}

function togglePickerHero(name){
  const _ps=store.get('pickerSelected');
  const sel=_ps[pickerMode];if(!sel)return;
  const idx=sel.indexOf(name);
  if(idx>=0)sel.splice(idx,1);
  else if(sel.length<pickerMax)sel.push(name);
  else{toast(`Максимум ${pickerMax} героев`,'err');return}
  store.set('pickerSelected',_ps);
  renderPickerGrid();
}

function renderPickerGrid(){
  const sel=pickerSelected[pickerMode]||[];
  const _synExclude=pickerMode==='synergy'?(store.get('synergyExclude')||''):'';
  const _synRoleEx=pickerMode==='synergy'?(store.get('synergyRoleExclude')||''):'';
  const filtered=heroes.filter(h=>(pickerRoleFilter==='all'||h.role===pickerRoleFilter)&&h.name!==_synExclude&&(!_synRoleEx||h.role!==_synRoleEx))
    .sort((a,b)=>b.priority-a.priority);
  document.getElementById('pickerCount').textContent=sel.length+' выбрано';
  document.getElementById('pickerGrid').innerHTML=filtered.map(h=>{
    const src=portrait(h.name);
    const isSel=sel.includes(h.name);
    return`<div class="p-hero${isSel?' selected':''}" onclick="togglePickerHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
    </div>`;
  }).join('');
}

// Подтверждение — расширяется в picker-comp.js и picker-maps.js
function confirmPicker(){
  closePicker();
  renderSelPreview();
}

function renderSelPreview(){
  const elMap={preferred:'selPreferred',bans:'selBans',comp:'selComp',mapCounters:'selMapCounters',
    playerMain:'selPlayerMain',playerPool:'selPlayerPool'};
  Object.entries(elMap).forEach(([mode,elId])=>{
    const el=document.getElementById(elId);if(!el)return;
    const sel=pickerSelected[mode]||[];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(name=>{
      const h=heroMap[name]||{};const src=portrait(name);
      return`<div class="sel-hero-chip ${h.role||''}">
        ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        ${name}</div>`;
    }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
  renderRolePoolPreviews();
}

function renderRolePoolPreviews(){
  ['Tank','Damage','Support','Flex'].forEach(role=>{
    const el=document.getElementById(`selPlayer_${role}`);if(!el)return;
    const sel=pickerSelected[`playerRole_${role}`]||[];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать (до 5)</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(name=>{
      const src=portrait(name);
      return`<div class="sel-hero-chip ${role}">
        ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        ${name}</div>`;
    }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
}
