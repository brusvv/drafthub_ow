// @hash c622b94f 2026-07-18T02:37
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
    return`<button type="button" class="p-hero btn-reset${isSel?' selected':''}" onclick="togglePickerHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
    </button>`;
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
    // AUDIT-A3 (16.07): контейнер .sel-heroes больше НЕ сам button/onclick —
    // раньше это давало button-in-button, т.к. .sel-hero-chip несёт свою
    // кнопку openHeroInfoPopup (реальная a11y-фича, не крестик — убирать её
    // ради конверсии контейнера было бы обменом одной a11y-фичи на другую,
    // см. AGENT_TASKS.md). Пусто → сам контейнер целиком кнопка (нет вложенных
    // кнопок — конфликта нет). Непусто → чипы остаются просто div'ами с
    // собственной кнопкой-инфо, а «открыть пикер» — отдельная кнопка-сиблинг
    // в конце строки (была декоративным span'ом с тем же смыслом по факту,
    // раз вся строка и так была одним большим onclick).
    if(!sel.length){
      el.innerHTML=`<button type="button" class="btn-reset sel-empty-btn" onclick="openPicker('${mode}')">
        <span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>
      </button>`;
      return;
    }
    el.innerHTML=sel.map(name=>{
      const h=heroMap[name]||{};const src=portrait(name);
      return`<div class="sel-hero-chip ${h.role||''}" title="${escAttr(name)}">
        <button type="button" class="btn-reset" onclick="openHeroInfoPopup('${esc(name)}')" style="display:flex;cursor:pointer">
          ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${escAttr(name[0])}</div>`}
        </button>
        ${escAttr(name)}</div>`;
    }).join('')+`<button type="button" class="btn-reset sel-edit-hint" style="margin-left:auto" onclick="openPicker('${mode}')">✎</button>`;
  });
  renderRolePoolPreviews();
}

function renderRolePoolPreviews(){
  ['Tank','Damage','Support','Flex'].forEach(role=>{
    const el=document.getElementById(`selPlayer_${role}`);if(!el)return;
    const sel=pickerSelected[`playerRole_${role}`]||[];
    // Та же логика что в renderSelPreview() выше — см. комментарий там.
    if(!sel.length){
      el.innerHTML=`<button type="button" class="btn-reset sel-empty-btn" onclick="openPicker('playerRole_${role}',5)">
        <span class="sel-empty">Нажми чтобы выбрать (до 5)</span><span class="sel-edit-hint">✎</span>
      </button>`;
      return;
    }
    el.innerHTML=sel.map(name=>{
      const src=portrait(name);
      return`<div class="sel-hero-chip ${role}" title="${escAttr(name)}">
        <button type="button" class="btn-reset" onclick="openHeroInfoPopup('${esc(name)}')" style="display:flex;cursor:pointer">
          ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${escAttr(name[0])}</div>`}
        </button>
        ${escAttr(name)}</div>`;
    }).join('')+`<button type="button" class="btn-reset sel-edit-hint" style="margin-left:auto" onclick="openPicker('playerRole_${role}',5)">✎</button>`;
  });
}
