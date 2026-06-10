// ════ PICKER ════
function openPicker(mode,max=999){
  pickerMode=mode;pickerMax=max;
  pickerRoleFilter='all';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{b.style.display='';});
  const titles={preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5)',playerMain:'Топ-5 героев',playerPool:'Пул героев'};
  document.getElementById('pickerTitle').textContent=titles[mode]||'Выбери героев';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}
function openHeroPicker(mode,max,roleFilter){
  pickerMode=mode;pickerMax=max;
  pickerRoleFilter=roleFilter||'all';
  const titles={preferred:'Предпочтительные герои',bans:'Цели для банов',comp:'Состав (до 5)',playerMain:'Топ-5 героев',playerPool:'Пул героев'};
  document.getElementById('pickerTitle').textContent=titles[mode]||'Выбери героев';
  // sync filter buttons
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
    const r=b.getAttribute('onclick')||'';
    b.classList.toggle('active',r.includes(`'${pickerRoleFilter}'`)||r.includes(`"${pickerRoleFilter}"`));
  });
  if(pickerRoleFilter==='all')document.querySelectorAll('#pickerOverlay .f-btn')[0].classList.add('active');
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
  // also refresh per-role pickers in player modal
  renderRolePoolPreviews();
}
 
// per-role player picker previews
function renderRolePoolPreviews(){
  ['Tank','Damage','Support','Flex'].forEach(role=>{
    const elId=`selPlayer_${role}`;
    const el=document.getElementById(elId);if(!el)return;
    const key=`playerRole_${role}`;
    const sel=pickerSelected[key]||[];
    if(!sel.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать (до 5)</span><span class="sel-edit-hint">✎</span>';return}
    el.innerHTML=sel.map(name=>{
      const src=portrait(name);
      return`<div class="sel-hero-chip ${role}">
        ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        ${name}
      </div>`;
    }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
}
 
// ════ COUNTER PICKER ════
let counterPickerRoleFilter='all';
let counterPickerSelected=[];
 
function openCounterPicker(){
  counterPickerRoleFilter='all';
  document.querySelectorAll('#counterPickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderCounterPickerGrid();
  document.getElementById('counterPickerOverlay').classList.remove('hidden');
}
function closeCounterPicker(){document.getElementById('counterPickerOverlay').classList.add('hidden')}
function confirmCounterPicker(){
  closeCounterPicker();
  renderCounterSelPreview();
  renderCounterScores();
}
 
function counterPickerFilter(role,btn){
  counterPickerRoleFilter=role;
  document.querySelectorAll('#counterPickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderCounterPickerGrid();
}
 
function toggleCounterHero(name){
  const idx=counterPickerSelected.findIndex(c=>c.name===name);
  if(idx>=0)counterPickerSelected.splice(idx,1);
  else counterPickerSelected.push({name,score:7});
  renderCounterPickerGrid();
}
 
function renderCounterPickerGrid(){
  const filtered=heroes.filter(h=>counterPickerRoleFilter==='all'||h.role===counterPickerRoleFilter).sort((a,b)=>b.priority-a.priority);
  document.getElementById('counterPickerCount').textContent=counterPickerSelected.length+' выбрано';
  document.getElementById('counterPickerGrid').innerHTML=filtered.map(h=>{
    const src=portrait(h.name);
    const entry=counterPickerSelected.find(c=>c.name===h.name);
    const isSelected=!!entry;
    return`<div class="p-hero${isSelected?' selected':''}" onclick="toggleCounterHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
      ${isSelected?`<div style="position:absolute;bottom:2px;right:3px;font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:700">${entry.score}</div>`:''}
    </div>`;
  }).join('');
}
 
function renderCounterSelPreview(){
  const el=document.getElementById('selHeroCounters');if(!el)return;
  if(!counterPickerSelected.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
  el.innerHTML=counterPickerSelected.map(({name,score})=>{
    const src=portrait(name);
    const color=score>=8?'var(--damage)':score>=6?'var(--accent)':'var(--text3)';
    return`<div class="sel-hero-chip" style="border-left:2px solid ${color}">
      ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
      ${name}<span style="font-family:var(--mono);font-size:9px;color:${color};margin-left:2px">${score}</span>
    </div>`;
  }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
}
 
function renderCounterScores(){
  const block=document.getElementById('counterScoresBlock');
  const list=document.getElementById('counterScoresList');
  if(!block||!list)return;
  if(!counterPickerSelected.length){block.style.display='none';return}
  block.style.display='block';
  list.innerHTML=counterPickerSelected.map((c,i)=>{
    const dots=Array.from({length:10},(_,k)=>{
      const val=k+1;
      const filled=val<=c.score;
      const color=val>=8?'var(--damage)':val>=5?'var(--accent)':'var(--text3)';
      return`<span onclick="setCounterScore(${i},${val})" title="${val}" style="cursor:pointer;font-size:14px;line-height:1;color:${filled?color:'var(--border2)'}">◆</span>`;
    }).join('');
    const labelColor=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';
    return`<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
      <span style="font-size:12px;font-weight:600;flex:1;min-width:80px">${c.name}</span>
      <div style="display:flex;gap:2px;align-items:center">${dots}</div>
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${labelColor};min-width:16px;text-align:right">${c.score}</span>
    </div>`;
  }).join('');
}

function setCounterScore(idx,val){
  if(!counterPickerSelected[idx])return;
  counterPickerSelected[idx].score=val;
  renderCounterScores();
  renderCounterSelPreview();
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
 
// ════ PLAYER ROLE CHANGE — dynamic per-role hero pool blocks ════
// Скрывает/показывает поле Офф-роль в зависимости от выбранной основной роли
function _syncOffRoleVisibility(){
  const mainRole=document.getElementById('pMainRole')?.value;
  const offGroup=document.getElementById('pOffRole')?.closest('.form-group');
  if(!offGroup)return;
  if(mainRole==='Flex'){
    offGroup.style.display='none';
    document.getElementById('pOffRole').value='';
  } else {
    offGroup.style.display='';
  }
}

function onPlayerRoleChange(){
  _syncOffRoleVisibility();
  const mainRole=document.getElementById('pMainRole').value;
  const offRole=document.getElementById('pOffRole').value;
  const block=document.getElementById('playerHeroPoolsBlock');
  if(!block)return;
 
  const isFlex=mainRole==='Flex';
  let roles=[];
  if(isFlex){
    roles=['Tank','Damage','Support'];
  } else if(mainRole){
    roles=[mainRole];
    if(offRole&&offRole!==mainRole)roles.push(offRole);
  }
 
  block.innerHTML=roles.map(role=>{
    const key=`playerRole_${role}`;
    if(!pickerSelected[key])pickerSelected[key]=[];
    const cur=pickerSelected[key];
    const preview=cur.length
      ? cur.map(name=>{const src=portrait(name);return`<div class="sel-hero-chip ${role}">${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}${name}</div>`;}).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>'
      : '<span class="sel-empty">Нажми чтобы выбрать (до 5)</span><span class="sel-edit-hint">✎</span>';
    return`<div class="form-group">
      <label class="form-label">Топ-5 героев — <span style="color:${rc[role]||'var(--accent)'}">${role}</span></label>
      <div class="sel-heroes" id="selPlayer_${role}" onclick="openRoleHeroPicker('${role}')">${preview}</div>
    </div>`;
  }).join('');
}
 
function openRoleHeroPicker(role){
  const key=`playerRole_${role}`;
  if(!pickerSelected[key])pickerSelected[key]=[];
  pickerMode=key;pickerMax=5;
  pickerRoleFilter=role;
  // lock filter buttons to only show the relevant role
  document.getElementById('pickerTitle').textContent=`Топ-5 героев — ${role}`;
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
    const r=b.getAttribute('onclick')||'';
    const isThisRole=r.includes(`'${role}'`)||r.includes(`"${role}"`);
    // скрываем ALL и другие роли — показываем только нужную роль
    b.style.display=isThisRole?'':'none';
    b.classList.toggle('active',isThisRole);
  });
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}
 
// ════ COMP SLOTS ════
// compSlots[0] = {hero, role:'Tank'}, [1],[2] = Damage, [3],[4] = Support
let compSlots=[
  {hero:null,role:'Tank'},
  {hero:null,role:'Damage'},
  {hero:null,role:'Damage'},
  {hero:null,role:'Support'},
  {hero:null,role:'Support'}
];
let activeSlotIdx=null;
 
function initCompSlots(map){
  compSlots=[
    {hero:null,role:'Tank'},
    {hero:null,role:'Damage'},
    {hero:null,role:'Damage'},
    {hero:null,role:'Support'},
    {hero:null,role:'Support'}
  ];
  if(map&&map.comp&&map.comp.length){
    const byRole={Tank:[],Damage:[],Support:[]};
    map.comp.forEach(c=>{
      const role=c.playerRole||c.role||(heroMap[c.hero]||{}).role||'Damage';
      if(byRole[role])byRole[role].push(c.hero);
    });
    // заполняем слоты
    let di=0,si=0;
    if(byRole.Tank[0])compSlots[0].hero=byRole.Tank[0];
    byRole.Damage.forEach(h=>{if(di<2){compSlots[1+di].hero=h;di++;}});
    byRole.Support.forEach(h=>{if(si<2){compSlots[3+si].hero=h;si++;}});
  }
  renderCompSlots();
}
 
function renderCompSlots(){
  [0,1,2,3,4].forEach(i=>{
    const slot=compSlots[i];
    const el=document.querySelector(`.comp-slot[data-slot="${i}"]`);
    if(!el)return;
    if(slot.hero){
      const src=portrait(slot.hero);
      el.innerHTML=`${src?`<img src="${src}" style="width:28px;height:28px;border-radius:5px;object-fit:cover" onerror="this.style.display='none'">`:`<div class="comp-slot-ph">${slot.hero[0]}</div>`}
        <span class="comp-slot-name">${slot.hero}</span>
        <button class="comp-slot-clear" onclick="event.stopPropagation();clearCompSlot(${i})">✕</button>`;
      el.classList.add('filled');
    }else{
      el.innerHTML=`<span class="sel-empty" style="font-size:11px">Выбрать</span>`;
      el.classList.remove('filled');
    }
  });
  // sync pickerSelected.comp for saveMap
  pickerSelected.comp=compSlots.filter(s=>s.hero).map(s=>s.hero);
}
 
function openCompSlotPicker(slotIdx,role){
  activeSlotIdx=slotIdx;
  pickerMode='comp_slot';
  pickerRoleFilter=role;
  pickerMax=1;
  document.getElementById('pickerTitle').textContent=`Выбери ${role}`;
  document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
    const r=b.getAttribute('onclick')||'';
    b.classList.toggle('active',r.includes(`'${role}'`)||r.includes(`"${role}"`));
  });
  renderCompSlotPickerGrid(role);
  document.getElementById('pickerOverlay').classList.remove('hidden');
}
 
function renderCompSlotPickerGrid(role){
  const filtered=heroes.filter(h=>h.role===role).sort((a,b)=>b.priority-a.priority);
  const selected=compSlots[activeSlotIdx]?.hero;
  document.getElementById('pickerCount').textContent=selected?'1 выбрано':'0 выбрано';
  document.getElementById('pickerGrid').innerHTML=filtered.map(h=>{
    const src=portrait(h.name);
    const isSel=h.name===selected;
    return`<div class="p-hero${isSel?' selected':''}" onclick="selectCompSlotHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
    </div>`;
  }).join('');
}
 
function selectCompSlotHero(name){
  if(activeSlotIdx===null)return;
  const current=compSlots[activeSlotIdx].hero;
  compSlots[activeSlotIdx].hero=current===name?null:name;
  renderCompSlotPickerGrid(compSlots[activeSlotIdx].role);
}
 
function clearCompSlot(idx){compSlots[idx].hero=null;renderCompSlots()}
 
// Override confirmPicker to handle comp_slot
const _origConfirm=confirmPicker;
window.confirmPicker=function(){
  if(pickerMode==='comp_slot'){
    document.getElementById('pickerOverlay').classList.add('hidden');
    renderCompSlots();
    return;
  }
  _origConfirm();
}
