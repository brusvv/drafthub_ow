// @hash 096d0bd8 2026-07-15T05:57
// ════ PICKER — COUNTERS & MAP PICKER ════
//
// Попап оценки (10-точечная шкала) для выбранных контрпиков
// больше не дублируется здесь — после confirmCounterPicker()
// рендер и оценка идут через renderHeroCounterBlock() /
// openScoreChipPopup('counter', idx, chipEl) в modal-hero-chips.js.

// ── Counter picker ──
// counterPickerRoleFilter/counterPickerSelected — НЕ объявлены здесь через
// let: они уже проксированы в store через Object.defineProperties(window,
// ...) в config.js (см. AUDIT-A5, CHANGELOG.md). Локальный `let` с тем же
// именем перекрывал прокси во всём общем script-scope (bundle не ES-модули)
// — реальные чтения/записи здесь молча уходили в отдельную теневую
// переменную, а store.state.counterPickerSelected навсегда оставался
// пустым `[]`. Прокси-геттер/сеттер из config.js теперь достижим.

function openCounterPicker(){
  counterPickerRoleFilter='all';
  store.set('synergyExclude', document.getElementById('hName').value.trim());
  document.querySelectorAll('#counterPickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderCounterPickerGrid();
  document.getElementById('counterPickerOverlay').classList.remove('hidden');
}
function closeCounterPicker(){document.getElementById('counterPickerOverlay').classList.add('hidden')}
function confirmCounterPicker(){store.set('synergyExclude','');closeCounterPicker();renderHeroCounterBlock();}

function counterPickerFilter(role,btn){
  counterPickerRoleFilter=role;
  document.querySelectorAll('#counterPickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderCounterPickerGrid();
}

function toggleCounterHero(name){
  const idx=counterPickerSelected.findIndex(c=>c.name===name);
  if(idx>=0)counterPickerSelected.splice(idx,1);
  else counterPickerSelected.push({name,score:7});
  renderCounterPickerGrid();
}

function renderCounterPickerGrid(){
  const _cself=store.get('synergyExclude')||'';
  const filtered=heroes.filter(h=>(counterPickerRoleFilter==='all'||h.role===counterPickerRoleFilter)&&h.name!==_cself)
    .sort((a,b)=>b.priority-a.priority);
  document.getElementById('counterPickerCount').textContent=counterPickerSelected.length+' выбрано';
  document.getElementById('counterPickerGrid').innerHTML=filtered.map(h=>{
    const src=portrait(h.name);
    const entry=counterPickerSelected.find(c=>c.name===h.name);
    return`<button type="button" class="p-hero btn-reset${entry?' selected':''}" onclick="toggleCounterHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
      ${entry?`<div style="position:absolute;bottom:2px;right:3px;font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:700">${entry.score}</div>`:''}
    </button>`;
  }).join('');
}

// ── Map type filter helper ──
function onMapTypeChange(){
  const t=document.getElementById('mType').value;
  const noAD=NO_ATKDEF.includes(t);
  document.getElementById('mAtkDefBlock').style.display=noAD?'none':'block';
  document.getElementById('mDifBlock').style.display=noAD?'block':'none';
}
