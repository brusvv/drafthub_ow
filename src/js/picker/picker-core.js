// ════ PICKER — CORE ════

// ════════════════════════════════════════════════════════════
// DISPATCH-ТАБЛИЦА confirmPicker (LEQ-1)
//
// Заменяет цепочку из 4 window.confirmPicker = function(){...} overrides
// (picker-comp.js, modal-hero.js, render-bans-core.js, render-draft-comp.js).
//
// registerPickerHandler(mode, fn) регистрирует обработчик для конкретного
// pickerMode. confirmPicker() вызывает нужный хендлер по ключу.
//
// Специальные ключи:
//   '__draft_prefix__' — срабатывает если pickerMode.startsWith('draft_')
//   '__playerRole_prefix__' — срабатывает если pickerMode.startsWith('playerRole_')
//
// Порядок проверки в confirmPicker():
//   1. Точное совпадение mode → handler
//   2. startsWith('draft_') → '__draft_prefix__'
//   3. startsWith('playerRole_') → '__playerRole_prefix__'
//   4. Дефолт — closePicker() + renderSelPreview()
// ════════════════════════════════════════════════════════════
const _pickerHandlers = {};

function registerPickerHandler(mode, fn) {
  _pickerHandlers[mode] = fn;
}

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

// ── Центральный confirmPicker — dispatch по режиму ──────────
function confirmPicker(){
  const m = pickerMode;

  // 1. Точное совпадение
  if(_pickerHandlers[m]){ _pickerHandlers[m](); return; }

  // 2. Префикс draft_ (render-draft-comp.js регистрирует '__draft_prefix__')
  if(m && m.startsWith('draft_') && _pickerHandlers['__draft_prefix__']){
    _pickerHandlers['__draft_prefix__'](); return;
  }

  // 3. Префикс playerRole_ — дефолтное поведение (close + preview)
  if(m && m.startsWith('playerRole_')){
    closePicker();
    renderSelPreview();
    return;
  }

  // 4. Дефолт: preferred, bans, mapCounters, playerMain, playerPool и т.д.
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
      return`<div class="sel-hero-chip ${h.role||''}" title="${esc(name)}">
        <span onclick="event.stopPropagation();openHeroInfoPopup('${esc(name)}')" style="display:flex;cursor:pointer">
          ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        </span>
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
      return`<div class="sel-hero-chip ${role}" title="${esc(name)}">
        <span onclick="event.stopPropagation();openHeroInfoPopup('${esc(name)}')" style="display:flex;cursor:pointer">
          ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
        </span>
        ${name}</div>`;
    }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
  });
}
