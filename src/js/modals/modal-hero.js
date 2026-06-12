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
  renderStrengthPreview();
  renderHeroSynergyBlock();
  document.getElementById('heroModal').classList.remove('hidden');
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
// Состояние оверлея «Оценка силы героя на картах».
let _mapStrTypeFilter      = 'all';   // фильтр по типу карты ('all'|'Control'|...)
let _strengthShowOnlyRated = false;   // кнопка «С оценкой» — показывать только оценённые
let _strengthActivePopup   = null;    // имя карты, для которой открыт inline-попап оценки

function openMapStrPicker(){
  _mapStrTypeFilter      = 'all';
  _strengthShowOnlyRated = false;
  _strengthActivePopup   = null;
  // Обновляем subtitle с именем героя
  const heroName = document.getElementById('hName').value.trim();
  const sub = document.getElementById('mapStrPickerHeroName');
  if(sub) sub.textContent = heroName || '';
  // Сбрасываем фильтр кнопок типов
  document.querySelectorAll('#mapStrPickerOverlay .picker-filters .f-btn')
    .forEach((b,i) => b.classList.toggle('active', i===0));
  // Сбрасываем кнопку «С оценкой» (может дублироваться: в модалке и в оверлее)
  document.querySelectorAll('[id="mapStrFilterBtn"]')
    .forEach(b => b.classList.remove('active'));
  renderHeroStrengthGrid();
  updateMapStrCount();
  document.getElementById('mapStrPickerOverlay').classList.remove('hidden');
}

function closeMapStrPicker(){
  _strengthActivePopup = null;
  _closeStrengthPopup();
  document.getElementById('mapStrPickerOverlay').classList.add('hidden');
}

function confirmMapStrPicker(){
  closeMapStrPicker();
  renderStrengthPreview();
}

function mapStrTypeFilter(type, btn){
  _mapStrTypeFilter = type;
  _strengthActivePopup = null;
  _closeStrengthPopup();
  document.querySelectorAll('#mapStrPickerOverlay .picker-filters .f-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHeroStrengthGrid();
}

/**
 * Кнопка «С оценкой» — показывает только карты с заполненной оценкой.
 * Может присутствовать дважды (в модалке и в оверлее) — синхронизируем обе.
 */
function toggleStrengthFilter(btn){
  _strengthShowOnlyRated = !_strengthShowOnlyRated;
  document.querySelectorAll('[id="mapStrFilterBtn"]')
    .forEach(b => b.classList.toggle('active', _strengthShowOnlyRated));
  _strengthActivePopup = null;
  _closeStrengthPopup();
  renderHeroStrengthGrid();
}

function updateMapStrCount(){
  const el = document.getElementById('mapStrPickerCount');
  if(!el) return;
  const rated = heroStrengthEdits.filter(e => e.atk > 0 || e.def > 0).length;
  el.textContent = rated + ' оценено';
}

/**
 * Рисует сетку карт в оверлее с учётом фильтра типа и «С оценкой».
 */
function renderHeroStrengthGrid(){
  const el = document.getElementById('heroStrengthGrid');
  if(!el) return;
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
  // Если попап был открыт для карты, отфильтрованной фильтром — закрываем
  if(_strengthActivePopup && !entries.find(e => e.map === _strengthActivePopup)){
    _strengthActivePopup = null;
  }
  _renderStrengthPopup();
}

/**
 * Карточка-чип одной карты в гриде оценки силы.
 * Клик открывает inline-попап с диамантами ATK/DEF.
 */
function _mapStrengthChip(e){
  const src    = mapImg(e.map);
  const noAD   = NO_ATKDEF.includes(e.type);
  const hasData= e.atk>0 || (!noAD && e.def>0);
  const label  = noAD ? `${e.atk||0}` : `${e.atk||0}/${e.def||0}`;
  return `<div class="map-str-chip${hasData?' has-data':''}"
               data-map="${esc(e.map)}"
               onclick="toggleStrengthPopup('${esc(e.map)}')">
    ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
    <div class="map-str-chip-name">${e.map}</div>
    ${hasData ? `<div class="map-str-chip-score">${label}</div>` : ''}
  </div>`;
}

/**
 * Открывает/закрывает inline-попап оценки для карты.
 * Повторный клик по той же карте закрывает попап.
 */
function toggleStrengthPopup(mapName){
  _strengthActivePopup = (_strengthActivePopup === mapName) ? null : mapName;
  _renderStrengthPopup();
}

function _closeStrengthPopup(){
  const el = document.getElementById('mapStrScorePopup');
  if(el) el.remove();
}

/**
 * Рендерит единственный shared-попап (#mapStrScorePopup) с
 * диамант-рейтингом ATK/DEF (или «Сила» для Control/Flashpoint)
 * для карты _strengthActivePopup. Позиционируется через CSS
 * (centered overlay) — см. strength.css.
 */
function _renderStrengthPopup(){
  _closeStrengthPopup();
  if(!_strengthActivePopup) return;
  const e = heroStrengthEdits.find(x => x.map === _strengthActivePopup);
  if(!e) return;
  const noAD = NO_ATKDEF.includes(e.type);

  const popup = document.createElement('div');
  popup.id = 'mapStrScorePopup';
  popup.className = 'hs-popup';
  popup.innerHTML = `
    <div class="map-str-popup-title">${e.map}</div>
    ${_strengthPopupRow(e.map,'atk',e.atk, noAD?'Сила':'ATK')}
    ${noAD ? '' : _strengthPopupRow(e.map,'def',e.def,'DEF')}
    <button class="btn" style="margin-top:8px;width:100%"
            onclick="toggleStrengthPopup('${esc(e.map)}')">Готово</button>
  `;
  const box = document.querySelector('#mapStrPickerOverlay .picker-box');
  if(box) box.appendChild(popup);
}

function _strengthPopupRow(mapName, field, val, label){
  const dots = Array.from({length:10}, (_,k) => {
    const v = k+1; const filled = v <= val;
    const color = v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
    return`<span onclick="setStrengthDot('${esc(mapName)}','${field}',${v})"
      style="cursor:pointer;font-size:15px;color:${filled?color:'var(--border2)'};line-height:1">◆</span>`;
  }).join('');
  return`<div class="map-str-score-row">
    <span class="map-str-score-label">${label}</span>
    <div class="map-str-dots">${dots}</div>
    <span class="strength-val" style="margin-left:4px">${val||0}</span>
  </div>`;
}

/**
 * Устанавливает оценку ATK/DEF для карты.
 * Повторный клик по уже выставленному значению уменьшает на 1
 * (стандартный паттерн «toggle off» для диамант-рейтингов).
 */
function setStrengthDot(mapName, field, val){
  const entry = heroStrengthEdits.find(e => e.map === mapName);
  if(!entry) return;
  entry[field] = (entry[field] === val) ? val-1 : val;
  renderHeroStrengthGrid();
  updateMapStrCount();
}

/**
 * Компактный превью в самой модалке героя — только карты с оценкой.
 * Клик по чипу открывает полный редактор (openMapStrPicker).
 */
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

// Закрываем оверлей по клику на фон
document.addEventListener('DOMContentLoaded', () => {
  const ov = document.getElementById('mapStrPickerOverlay');
  if(ov) ov.addEventListener('click', e => { if(e.target === ov) closeMapStrPicker(); });
});
