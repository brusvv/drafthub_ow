// ════ MODAL — HERO ════
// Состояние редактирования
let heroStrengthEdits=[];   // [{map, atk, def}]
let heroSynergyEdits=[];    // [{name, score}]

function openHeroModal(hero){
  document.getElementById('heroModalTitle').textContent=hero?'Редактировать героя':'Добавить героя';
  document.getElementById('heroEditRow').value=hero?hero.rowIndex:'';
  document.getElementById('hName').value=hero?hero.name:'';
  document.getElementById('hRole').value=hero?hero.role:'';
  document.getElementById('hSub').value=hero?hero.subrole:'';
  document.getElementById('hPrio').value=hero?hero.priority:'5';
  document.getElementById('hBanned').checked=hero?hero.banned:false;
  document.getElementById('hNotes').value=hero?hero.notes:'';
  counterPickerSelected=hero?(hero.counters.map(c=>({name:c.name,score:c.score!==undefined?c.score:5}))):[];
  document.getElementById('heroDeleteBtn').style.display=hero?'inline-flex':'none';
  // Загружаем силу героя на картах из heroMapStrength
  heroStrengthEdits=maps.map(m=>{
    const entry=(heroMapStrength[hero?hero.name:'']||{})[m.name]||{};
    return{map:m.name,type:m.type,atk:entry.atk||0,def:entry.def||0};
  });
  // Загружаем синергии
  heroSynergyEdits=hero?(heroSynergy[hero.name]||[]).map(s=>({...s})):[];
  renderCounterSelPreview();renderCounterScores();
  renderHeroStrengthTable();
  renderHeroSynergyBlock();
  document.getElementById('heroModal').classList.remove('hidden');
}

function renderHeroStrengthTable(){
  const el=document.getElementById('heroStrengthTable');if(!el)return;
  const types=['Control','Escort','Hybrid','Push','Flashpoint','Clash'];
  const byType={};
  heroStrengthEdits.forEach(e=>{
    if(!byType[e.type])byType[e.type]=[];
    byType[e.type].push(e);
  });
  el.innerHTML=types.filter(t=>byType[t]&&byType[t].length).map(t=>{
    const noAD=NO_ATKDEF.includes(t);
    return`<div class="strength-type-group">
      <div class="strength-type-label">${mapTypeIcon(t,11)} ${t}</div>
      ${byType[t].map(e=>`
        <div class="strength-row">
          <span class="strength-map-name">${e.map}</span>
          ${noAD
            ?_strengthDots(e.map,'atk',e.atk,'Сила')
            :`${_strengthDots(e.map,'atk',e.atk,'ATK')}${_strengthDots(e.map,'def',e.def,'DEF')}`
          }
        </div>`).join('')}
    </div>`;
  }).join('');
}

function _strengthDots(mapName,field,val,label){
  const dots=Array.from({length:10},(_,k)=>{
    const v=k+1;const filled=v<=val;
    const color=v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
    return`<span onclick="setHeroStrength('${esc(mapName)}','${field}',${v})"
      style="cursor:pointer;font-size:13px;color:${filled?color:'var(--border2)'};line-height:1">◆</span>`;
  }).join('');
  return`<div class="strength-field">
    <span class="strength-field-label">${label}</span>
    <div class="strength-dots">${dots}</div>
    <span class="strength-val" id="sv_${esc(mapName)}_${field}">${val||0}</span>
  </div>`;
}

function setHeroStrength(mapName,field,val){
  const entry=heroStrengthEdits.find(e=>e.map===mapName);if(!entry)return;
  entry[field]=val;
  // Обновляем только затронутый ряд — не перерисовываем всё
  const valEl=document.getElementById(`sv_${esc(mapName)}_${field}`);
  if(valEl)valEl.textContent=val;
  // Перекрашиваем точки
  const dots=document.querySelectorAll(`.strength-dots span[onclick*="'${mapName}','${field}'"]`);
  dots.forEach((dot,k)=>{
    const v=k+1;const filled=v<=val;
    const color=v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
    dot.style.color=filled?color:'var(--border2)';
  });
}

// ── Synergy block ──
function renderHeroSynergyBlock(){
  const el=document.getElementById('heroSynergyBlock');if(!el)return;
  el.innerHTML=`
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
      ${heroSynergyEdits.map((s,i)=>{
        const src=portrait(s.name);const color=s.score>=8?'var(--support)':s.score>=5?'var(--accent)':'var(--text3)';
        return`<div class="sel-hero-chip" style="border-left:2px solid ${color}">
          ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${s.name[0]}</div>`}
          ${s.name}
          <input type="number" min="1" max="10" value="${s.score}" style="width:28px;font-size:10px;background:var(--bg4);border:none;color:${color};text-align:center;border-radius:3px"
            onchange="heroSynergyEdits[${i}].score=parseInt(this.value)||5">
          <span onclick="removeSynergy(${i})" style="cursor:pointer;color:var(--text3);margin-left:2px">×</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn" onclick="openSynergyPicker()" style="font-size:10px">+ Добавить синергию</button>`;
}

function removeSynergy(idx){heroSynergyEdits.splice(idx,1);renderHeroSynergyBlock();}

function openSynergyPicker(){
  pickerMode='synergy';pickerMax=10;pickerRoleFilter='all';
  pickerSelected['synergy']=heroSynergyEdits.map(s=>s.name);
  document.getElementById('pickerTitle').textContent='Синергирует с';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>{b.style.display='';b.classList.toggle('active',i===0);});
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

// Override confirmPicker для синергий
const _heroModalConfirm=window.confirmPicker||(()=>{});
window.confirmPicker=function(){
  if(pickerMode==='synergy'){
    const sel=pickerSelected['synergy']||[];
    // Добавляем новые, не трогаем существующие
    sel.forEach(name=>{if(!heroSynergyEdits.find(s=>s.name===name))heroSynergyEdits.push({name,score:7});});
    heroSynergyEdits=heroSynergyEdits.filter(s=>sel.includes(s.name));
    closePicker();renderHeroSynergyBlock();return;
  }
  _heroModalConfirm();
};

// ── Map Strength Picker (оверлей) ─────────────────────────────
let _mapStrTypeFilter = 'all';

function openMapStrPicker(){
  _mapStrTypeFilter = 'all';
  _strengthActivePopup = null;
  // Обновляем subtitle с именем героя
  const heroName = document.getElementById('hName').value.trim();
  const sub = document.getElementById('mapStrPickerHeroName');
  if(sub) sub.textContent = heroName || '';
  // Сбрасываем фильтр кнопок типов
  document.querySelectorAll('#mapStrPickerOverlay .picker-filters .f-btn')
    .forEach((b,i) => b.classList.toggle('active', i===0));
  renderHeroStrengthGrid();
  updateMapStrCount();
  document.getElementById('mapStrPickerOverlay').classList.remove('hidden');
}

function closeMapStrPicker(){
  _strengthActivePopup = null;
  document.getElementById('mapStrPickerOverlay').classList.add('hidden');
}

function confirmMapStrPicker(){
  closeMapStrPicker();
  renderStrengthPreview();
}

function mapStrTypeFilter(type, btn){
  _mapStrTypeFilter = type;
  document.querySelectorAll('#mapStrPickerOverlay .picker-filters .f-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHeroStrengthGrid();
}

function updateMapStrCount(){
  const el = document.getElementById('mapStrPickerCount');
  if(!el) return;
  const rated = heroStrengthEdits.filter(e => e.atk > 0 || e.def > 0).length;
  el.textContent = rated + ' оценено';
}

// Переопределяем renderHeroStrengthGrid чтобы учитывать фильтр типа И _strengthShowOnlyRated
// (оригинал в старом коде не знал о _mapStrTypeFilter)
const _origRenderGrid = window.renderHeroStrengthGrid;
window.renderHeroStrengthGrid = function(){
  const el = document.getElementById('heroStrengthGrid');
  if(!el) return;
  _strengthActivePopup = null;
  const order = ['Control','Escort','Hybrid','Push','Flashpoint'];
  let entries = _strengthShowOnlyRated
    ? heroStrengthEdits.filter(e => e.atk > 0 || e.def > 0)
    : heroStrengthEdits;
  if(_mapStrTypeFilter !== 'all')
    entries = entries.filter(e => e.type === _mapStrTypeFilter);
  const byType = {};
  entries.forEach(e => { if(!byType[e.type]) byType[e.type]=[]; byType[e.type].push(e); });
  el.innerHTML = order.filter(t => byType[t]?.length).map(t => `
    <div class="hs-type-group">
      <div class="hs-type-label">${mapTypeIcon(t,11)} ${t}</div>
      <div class="hs-map-row">
        ${byType[t].map(e => _mapStrengthChip(e)).join('')}
      </div>
    </div>`).join('') || '<div class="empty" style="padding:8px 0">Нет карт</div>';
};

// Компактный превью в модалке — только карты с оценкой
function renderStrengthPreview(){
  const el = document.getElementById('heroStrengthPreview');
  if(!el) return;
  const rated = heroStrengthEdits.filter(e => e.atk > 0 || e.def > 0);
  if(!rated.length){
    el.innerHTML = '<span class="empty" style="font-size:11px">Нет оценок — нажми «Открыть редактор»</span>';
    return;
  }
  el.innerHTML = rated.map(e => {
    const noAD = NO_ATKDEF.includes(e.type);
    const label = noAD ? `${e.atk}` : `${e.atk}/${e.def}`;
    const color = e.atk >= 8 ? 'var(--damage)' : e.atk >= 5 ? 'var(--accent)' : 'var(--text3)';
    return `<div class="hs-map-chip rated" onclick="openMapStrPicker()" style="cursor:pointer">
      <span class="hs-map-name">${e.map}</span>
      <span class="hs-map-score" style="color:${color}">${label}</span>
    </div>`;
  }).join('');
  updateMapStrCount();
}

// Перехватываем setStrengthDot чтобы обновлять счётчик
const _origSetDot = window.setStrengthDot;
window.setStrengthDot = function(mapName, field, val){
  _origSetDot(mapName, field, val);
  updateMapStrCount();
};

// Закрываем оверлей по клику на фон
document.addEventListener('DOMContentLoaded', () => {
  const ov = document.getElementById('mapStrPickerOverlay');
  if(ov) ov.addEventListener('click', e => { if(e.target === ov) closeMapStrPicker(); });
});
