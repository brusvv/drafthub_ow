// @hash 6d4ff178 2026-07-15T23:31
// ════ PICKER — COMP SLOTS ════
// LEQ-2: window.confirmPicker override заменён на registerPickerHandler('comp_slot', ...)

// compSlots/activeSlotIdx — НЕ объявлены здесь: проксированы в store через
// Object.defineProperties(window, ...) в config.js (AUDIT-A5, CHANGELOG.md).
// Дефолт (5 пустых слотов Tank/Damage×2/Support×2) живёт в store.js
// INITIAL_STATE — initCompSlots() ниже пересобирает тот же дефолт заново,
// не полагается на значение из store при первом заходе.

function initCompSlots(map){
  compSlots=[
    {hero:null,role:'Tank'},{hero:null,role:'Damage'},{hero:null,role:'Damage'},
    {hero:null,role:'Support'},{hero:null,role:'Support'}
  ];
  if(map&&map.comp&&map.comp.length){
    const byRole={Tank:[],Damage:[],Support:[]};
    map.comp.forEach(c=>{
      const role=c.playerRole||c.role||(heroMap[c.hero]||{}).role||'Damage';
      if(byRole[role])byRole[role].push(c.hero);
    });
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
    const el=document.querySelector(`.comp-slot[data-slot="${i}"]`);if(!el)return;
    if(slot.hero){
      const src=portrait(slot.hero);
      el.innerHTML=`${src?`<img src="${src}" style="width:28px;height:28px;border-radius:5px;object-fit:cover" onerror="this.style.display='none'">`:`<div class="comp-slot-ph">${slot.hero[0]}</div>`}
        <span class="comp-slot-name">${slot.hero}</span>
        <span class="comp-slot-clear" onclick="event.stopPropagation();clearCompSlot(${i})">✕</span>`;
      el.classList.add('filled');
    }else{
      el.innerHTML='<span class="sel-empty fs-11">Выбрать</span>';
      el.classList.remove('filled');
    }
  });
  pickerSelected.comp=compSlots.filter(s=>s.hero).map(s=>s.hero);
}

function openCompSlotPicker(slotIdx,role){
  activeSlotIdx=slotIdx;pickerMode='comp_slot';
  pickerRoleFilter=role;pickerMax=1;
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
    const src=portrait(h.name);const isSel=h.name===selected;
    return`<button type="button" class="p-hero btn-reset${isSel?' selected':''}" onclick="selectCompSlotHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
    </button>`;
  }).join('');
}

function selectCompSlotHero(name){
  if(activeSlotIdx===null)return;
  const current=compSlots[activeSlotIdx].hero;
  compSlots[activeSlotIdx].hero=current===name?null:name;
  renderCompSlotPickerGrid(compSlots[activeSlotIdx].role);
}

function clearCompSlot(idx){compSlots[idx].hero=null;renderCompSlots();}

// LEQ-2: регистрируем обработчик вместо window.confirmPicker override
registerPickerHandler('comp_slot', function(){
  document.getElementById('pickerOverlay').classList.add('hidden');
  renderCompSlots();
});
