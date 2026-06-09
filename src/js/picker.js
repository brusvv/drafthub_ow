// ════ PICKER ════
function openPicker(mode){
  pickerMode=mode;
  pickerRoleFilter='all';
  const titles={preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5 героев)'};
  document.getElementById('pickerTitle').textContent=titles[mode];
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}
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
  if(pickerMode==='comp'){
    if(idx>=0)sel.splice(idx,1);
    else if(sel.length<5)sel.push(name);
    else{toast('Максимум 5 героев в составе','err');return}
  }else{
    if(idx>=0)sel.splice(idx,1);else sel.push(name);
  }
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
  ['preferred','bans','comp'].forEach(mode=>{
    const el=document.getElementById(mode==='preferred'?'selPreferred':mode==='bans'?'selBans':'selComp');
    const sel=pickerSelected[mode];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(name=>{
      const h=heroMap[name]||{};
      const src=portrait(name);
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
