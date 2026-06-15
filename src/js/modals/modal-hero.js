// @hash f3685816 2026-06-15T04:40
// ════ MODAL — HERO ════
let heroStrengthEdits=[];   // [{map, type, atk, def}]
let heroSynergyEdits=[];    // [{name, score}]

// ════════════════════════════════════════════════════════════
// УНИФИЦИРОВАННЫЕ ЧИПЫ: Контрпики + Синергии
//
// Обе секции (heroCounterBlock / heroSynergyBlock) используют
// один и тот же визуальный компонент — чип с портретом, именем,
// оценкой (◆ score) и крестиком удаления. Клик по чипу открывает
// единый inline-попап с 10-точечной шкалой.
//
// Источники данных:
//   counterPickerSelected — [{name, score}]  (контрпики)
//   heroSynergyEdits      — [{name, score}]  (синергии)
//
// colorFn:
//   _ctrColor — для контрпиков (>=8 красный «бан»)
//   _synColor — для синергий   (>=8 зелёный «сильная связка»)
// ════════════════════════════════════════════════════════════

/**
 * Рендерит блок чипов героев с оценкой (используется для
 * контрпиков и синергий — один код для обоих).
 * @param {string} containerId — id контейнера (#heroCounterBlock / #heroSynergyBlock)
 * @param {Array<{name,score}>} items — список героев с оценкой
 * @param {Function} colorFn — (score) => CSS color
 * @param {string} chipClass — доп. класс чипа ('ctr-chip' | 'syn-chip')
 * @param {string} kind — 'counter' | 'synergy' — для роутинга кликов
 */
function _renderScoreChipBlock(containerId, items, colorFn, chipClass, kind){
  const el=document.getElementById(containerId);if(!el)return;
  if(!items.length){
    el.innerHTML='<span class="sel-empty">Нажми «+» чтобы выбрать</span>';
    return;
  }
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:5px">
    ${items.map((item,i)=>{
      const src=portrait(item.name);
      const color=colorFn(item.score);
      return`<div class="sel-hero-chip ${chipClass}" style="border-left:2px solid ${color};cursor:pointer"
                  onclick="openScoreChipPopup('${kind}',${i},this)">
        ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${item.name[0]}</div>`}
        <span>${item.name}</span>
        <span style="font-family:var(--mono);font-size:9px;font-weight:700;color:${color};margin-left:2px">${item.score}</span>
        <span onclick="event.stopPropagation();removeScoreChip('${kind}',${i})" style="cursor:pointer;color:var(--text3);margin-left:4px;font-size:11px">×</span>
      </div>`;
    }).join('')}
  </div>`;
}

/** Удаляет элемент из списка контрпиков/синергий по индексу. */
function removeScoreChip(kind,idx){
  if(kind==='counter'){
    counterPickerSelected.splice(idx,1);
    renderHeroCounterBlock();
  }else{
    heroSynergyEdits.splice(idx,1);
    renderHeroSynergyBlock();
  }
}

// ── Единый inline-попап оценки (position:fixed, анкер — чип) ──
let _scoreChipPopupState=null; // {kind, idx}

function openScoreChipPopup(kind,idx,chipEl){
  _closeScoreChipPopup();
  if(_scoreChipPopupState&&_scoreChipPopupState.kind===kind&&_scoreChipPopupState.idx===idx){
    _scoreChipPopupState=null;return;
  }
  _scoreChipPopupState={kind,idx};
  const items=kind==='counter'?counterPickerSelected:heroSynergyEdits;
  const item=items[idx];if(!item)return;
  const accent=kind==='counter'?'var(--damage)':'var(--support)';

  const popup=document.createElement('div');
  popup.id='scoreChipPopup';

  // position:fixed относительно чипа — попап появляется рядом с конкретной картой/героем,
  // а не в центре модалки (старый баг с #mapStrScorePopup был именно в этом)
  const rect=chipEl.getBoundingClientRect();
  const popupW=230;
  const left=rect.right+popupW>window.innerWidth?Math.max(8,rect.right-popupW):rect.left;
  const spaceBelow=window.innerHeight-(rect.bottom+8);
  const top=spaceBelow<120?Math.max(8,rect.top-130):rect.bottom+6;

  popup.style.cssText=`position:fixed;z-index:9999;top:${top}px;left:${left}px;width:${popupW}px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.7)`;
  popup.innerHTML=`
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">${item.name}</div>
    <div style="display:flex;gap:3px;align-items:center;margin-bottom:8px">
      ${Array.from({length:10},(_,k)=>{
        const v=k+1;const filled=v<=item.score;
        const color=v>=8?accent:v>=5?'var(--accent)':'var(--text3)';
        return`<span onclick="setScoreChipValue(${idx},${v})" style="cursor:pointer;font-size:16px;color:${filled?color:'var(--border2)'};line-height:1">◆</span>`;
      }).join('')}
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${accent};margin-left:6px">${item.score}</span>
    </div>
    <button class="btn" style="width:100%;font-size:10px" onclick="_closeScoreChipPopup()">Готово</button>`;
  document.body.appendChild(popup);
  popup.addEventListener('click',e=>e.stopPropagation());
}

function setScoreChipValue(idx,val){
  if(!_scoreChipPopupState)return;
  const {kind}=_scoreChipPopupState;
  const items=kind==='counter'?counterPickerSelected:heroSynergyEdits;
  if(!items[idx])return;
  items[idx].score=(items[idx].score===val)?val-1:val;
  _closeScoreChipPopup();
  if(kind==='counter')renderHeroCounterBlock();else renderHeroSynergyBlock();
  // Переоткрываем попап для того же чипа после перерисовки
  const selector=kind==='counter'?'.ctr-chip':'.syn-chip';
  setTimeout(()=>{
    const chips=document.querySelectorAll(selector);
    if(chips[idx])openScoreChipPopup(kind,idx,chips[idx]);
  },10);
}

function _closeScoreChipPopup(){
  document.getElementById('scoreChipPopup')?.remove();
  _scoreChipPopupState=null;
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.ctr-chip')&&!e.target.closest('.syn-chip')&&!e.target.closest('#scoreChipPopup'))
    _closeScoreChipPopup();
});

/** Рендерит блок контрпиков героя (#heroCounterBlock). */
function renderHeroCounterBlock(){
  _renderScoreChipBlock('heroCounterBlock',counterPickerSelected,_ctrColor,'ctr-chip','counter');
}


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
  heroStrengthEdits=maps.map(m=>{
    const entry=(heroMapStrength[hero?hero.name:'']||{})[m.name]||{};
    return{map:m.name,type:m.type,atk:entry.atk||0,def:entry.def||0};
  });
  heroSynergyEdits=hero?(heroSynergy[hero.name]||[]).map(s=>({...s})):[];
  renderHeroCounterBlock();
  renderStrengthPreview();
  renderHeroSynergyBlock();
  document.getElementById('heroModal').classList.remove('hidden');
}

// ── Synergy block (использует унифицированный _renderScoreChipBlock) ──
function renderHeroSynergyBlock(){
  _renderScoreChipBlock('heroSynergyBlock',heroSynergyEdits,_synColor,'syn-chip','synergy');
}

function openSynergyPicker(){
  const selfName=document.getElementById('hName').value.trim();
  const selfRole=document.getElementById('hRole').value;
  pickerMode='synergy';pickerMax=10;pickerRoleFilter='all';
  pickerSelected['synergy']=heroSynergyEdits.map(s=>s.name);
  store.set('synergyExclude', selfName);
  store.set('synergyRoleExclude', selfRole==='Tank'?'Tank':'');
  document.getElementById('pickerTitle').textContent='Синергирует с';
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>{
    b.style.display='';b.classList.toggle('active',i===0);
  });
  // Скрываем кнопку фильтра Tank если герой-танк
  if(selfRole==='Tank'){
    document.querySelectorAll('#pickerOverlay .f-btn').forEach(b=>{
      if((b.getAttribute('onclick')||'').includes("'Tank'"))b.style.display='none';
    });
  }
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

// Override confirmPicker для синергий
const _heroModalConfirm=window.confirmPicker||(()=>{});
window.confirmPicker=function(){
  if(pickerMode==='synergy'){
    const sel=pickerSelected['synergy']||[];
    sel.forEach(name=>{if(!heroSynergyEdits.find(s=>s.name===name))heroSynergyEdits.push({name,score:7});});
    heroSynergyEdits=heroSynergyEdits.filter(s=>sel.includes(s.name));
    store.set('synergyExclude','');
    // Открываем попап для каждого нового добавленного (только первый новый)
    closePicker();
    renderHeroSynergyBlock();
    return;
  }
  _heroModalConfirm();
};

// ── Map Strength Picker ────────────────────────────────────────
let _mapStrTypeFilter      = 'all';
let _strengthShowOnlyRated = false;
let _strengthActivePopup   = null;

function openMapStrPicker(){
  _mapStrTypeFilter      = 'all';
  _strengthShowOnlyRated = false;
  _strengthActivePopup   = null;
  const heroName = document.getElementById('hName').value.trim();
  const sub = document.getElementById('mapStrPickerHeroName');
  if(sub) sub.textContent = heroName || '';
  document.querySelectorAll('#mapStrPickerOverlay .picker-filters .f-btn')
    .forEach((b,i) => b.classList.toggle('active', i===0));
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
  if(_strengthActivePopup && !entries.find(e => e.map === _strengthActivePopup))
    _strengthActivePopup = null;
  _renderStrengthPopup();
}

function _mapStrengthChip(e){
  const src    = mapImg(e.map);
  const noAD   = NO_ATKDEF.includes(e.type);
  const hasData= e.atk>0 || (!noAD && e.def>0);
  const label  = noAD ? `${e.atk||0}` : `${e.atk||0}/${e.def||0}`;
  const isOpen = _strengthActivePopup === e.map;
  return `<div class="map-str-chip${hasData?' has-data':''}${isOpen?' is-open':''}"
               data-map="${esc(e.map)}"
               onclick="toggleStrengthPopup('${esc(e.map)}')">
    ${src ? `<img src="${src}" onerror="this.style.display='none'">` : ''}
    <div class="map-str-chip-name">${e.map}</div>
    ${hasData ? `<div class="map-str-chip-score">${label}</div>` : ''}
  </div>`;
}

function toggleStrengthPopup(mapName){
  _strengthActivePopup = (_strengthActivePopup === mapName) ? null : mapName;
  _renderStrengthPopup();
  // Обновляем чип (is-open класс)
  document.querySelectorAll('.map-str-chip').forEach(chip=>{
    chip.classList.toggle('is-open', chip.dataset.map === _strengthActivePopup);
  });
}

function _closeStrengthPopup(){
  const el = document.getElementById('mapStrScorePopup');
  if(el) el.remove();
}

// ATK/DEF иконки
const _ICON_ATK_SM = `<svg width="11" height="11" viewBox="0 0 100 100" fill="currentColor" style="color:var(--damage);flex-shrink:0"><g transform="rotate(-45 50 50)"><rect x="46" y="4" width="8" height="54" rx="2"/><polygon points="50,2 43,14 57,14"/><rect x="32" y="55" width="36" height="7" rx="3"/><rect x="45" y="62" width="10" height="18" rx="3"/><circle cx="50" cy="86" r="7"/></g><g transform="rotate(45 50 50)"><rect x="46" y="4" width="8" height="54" rx="2"/><polygon points="50,2 43,14 57,14"/><rect x="32" y="55" width="36" height="7" rx="3"/><rect x="45" y="62" width="10" height="18" rx="3"/><circle cx="50" cy="86" r="7"/></g></svg>`;
const _ICON_DEF_SM = `<svg width="11" height="12" viewBox="0 0 100 112" fill="currentColor" style="color:var(--tank);flex-shrink:0"><path d="M50 3 L7 22 L7 54 C7 79 26 101 50 109 C74 101 93 79 93 54 L93 22 Z"/><path fill="white" d="M33 87 L67 87 L67 78 L62 78 L62 47 L68 47 L68 36 L60 36 L60 41 L55 41 L55 36 L45 36 L45 41 L40 41 L40 36 L32 36 L32 47 L38 47 L38 78 L33 78 Z M36 90 L64 90 L64 87 L36 87 Z"/></svg>`;
const _ICON_STR_SM = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="color:var(--accent);flex-shrink:0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

function _strengthPopupRow(mapName, field, val, label, iconHtml){
  const dots = Array.from({length:10}, (_,k) => {
    const v = k+1; const filled = v <= val;
    const color = v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
    return`<span onclick="setStrengthDot('${esc(mapName)}','${field}',${v})"
      style="cursor:pointer;font-size:15px;color:${filled?color:'var(--border2)'};line-height:1">◆</span>`;
  }).join('');
  return`<div class="map-str-score-row">
    <span class="map-str-score-label" style="display:flex;align-items:center;gap:3px">${iconHtml}</span>
    <div class="map-str-dots">${dots}</div>
    <span class="strength-val" style="margin-left:4px">${val||0}</span>
  </div>`;
}

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
    ${noAD
      ? _strengthPopupRow(e.map,'atk',e.atk,_ICON_STR_SM,_ICON_STR_SM)
      : _strengthPopupRow(e.map,'atk',e.atk,'ATK',_ICON_ATK_SM)+
        _strengthPopupRow(e.map,'def',e.def,'DEF',_ICON_DEF_SM)
    }
    <button class="btn" style="margin-top:8px;width:100%"
            onclick="toggleStrengthPopup('${esc(e.map)}')">Готово</button>
  `;

  // backdrop-filter на .picker-overlay создаёт stacking context —
  // position:fixed в body рендерится ПОД оверлеем.
  // Решение: position:absolute внутри .picker-box (position:relative).
  const box = document.querySelector('#mapStrPickerOverlay .picker-box');
  if(!box) return;
  box.style.position = 'relative';

  // Экранируем спецсимволы CSS-селектора: " и ' (King's Row и т.п.)
  const _sel=e.map.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/'/g,"\\'");
  const chipEl=document.querySelector(`.map-str-chip[data-map="${_sel}"]`);
  const popupW=240;

  if(chipEl){
    const chipRect  = chipEl.getBoundingClientRect();
    const boxRect   = box.getBoundingClientRect();
    // Скроллится picker-grid-wrap, не picker-box
    const scrollEl  = document.querySelector('#mapStrPickerOverlay .picker-grid-wrap');
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;

    // left в координатах box
    const popupW2 = popupW;
    let left = chipRect.left - boxRect.left;
    left = Math.min(Math.max(8, left), boxRect.width - popupW2 - 8);

    const popupH = 170;

    // Место снизу до края видимой области scrollEl в viewport
    const scrollBottom = scrollEl
      ? Math.min(scrollEl.getBoundingClientRect().bottom, window.innerHeight)
      : window.innerHeight;
    const spaceBelow = scrollBottom - chipRect.bottom - 8;

    // top в координатах box (position:absolute)
    // scrollEl начинается на scrollEl.getBoundingClientRect().top - boxRect.top от начала box
    const scrollOffsetInBox = scrollEl
      ? scrollEl.getBoundingClientRect().top - boxRect.top
      : 0;
    const chipBottomInBox = chipRect.bottom - boxRect.top + scrollOffsetInBox + scrollTop
                          - scrollOffsetInBox; // упрощается:
    // Итого: chip bottom в абс. координатах box = chipRect.bottom - boxRect.top + scrollTop
    // (scrollTop добавляет сдвиг из-за прокрутки внутри scrollEl)
    const absBottom = chipRect.bottom - boxRect.top + scrollTop;
    const absTop    = chipRect.top    - boxRect.top + scrollTop;

    const top = spaceBelow >= popupH
      ? absBottom + 6          // открыть вниз
      : absTop - popupH - 6;  // открыть вверх

    popup.style.cssText=`position:absolute;z-index:100;top:${Math.max(8,top)}px;left:${left}px;width:${popupW}px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.7)`;
  }else{
    // Фоллбек — центр box
    popup.style.cssText=`position:absolute;z-index:100;top:50%;left:50%;transform:translate(-50%,-50%);width:${popupW}px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.7)`;
  }
  box.appendChild(popup);
}

function setStrengthDot(mapName, field, val){
  const entry = heroStrengthEdits.find(e => e.map === mapName);
  if(!entry) return;
  entry[field] = (entry[field] === val) ? val-1 : val;
  renderHeroStrengthGrid();
  updateMapStrCount();
}

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



document.addEventListener('DOMContentLoaded', () => {
  const ov = document.getElementById('mapStrPickerOverlay');
  if(ov) ov.addEventListener('click', e => { if(e.target === ov) closeMapStrPicker(); });
});
