// @hash 17480375 2026-07-13T20:44
// ════ MODAL — HERO MAP STRENGTH ════
// Оценка силы героя на картах: редактор (mapStrPickerOverlay) + превью в модалке.
// Данные: heroStrengthEdits = [{map, type, atk, def}] — инициализируется в modal-hero.js (openHeroModal)

let heroStrengthEdits=[];   // [{map, type, atk, def}]

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
  const dots = renderScoreDots({
    value: val,
    onValue: v => `setStrengthDot('${esc(mapName)}','${field}',${v})`,
  });
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
    const color = scoreColor(e.atk);
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
