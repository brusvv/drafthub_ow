// @hash 0d50c314 2026-07-15T04:45
// ════ MODAL — HERO CHIPS ════
// Унифицированные чипы + попап оценки для контрпиков и синергий.
// Используется обоими блоками heroCounterBlock / heroSynergyBlock.
//
// Источники данных:
//   counterPickerSelected — [{name, score}]  (контрпики, picker-counters.js)
//   heroSynergyEdits      — [{name, score}]  (синергии, modal-hero.js)
//
// colorFn:
//   _ctrColor — для контрпиков (>=8 красный «бан»)
//   _synColor — для синергий   (>=8 зелёный «сильная связка»)

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
      return`<button type="button" class="sel-hero-chip ${chipClass} btn-reset" style="border-left:2px solid ${color};cursor:pointer"
                  data-chip-action="open" data-chip-kind="${kind}" data-chip-idx="${i}">
        ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${item.name[0]}</div>`}
        <span>${item.name}</span>
        <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);font-weight:700;color:${color};margin-left:2px">${item.score}</span>
        <span data-chip-action="remove" data-chip-kind="${kind}" data-chip-idx="${i}" style="cursor:pointer;color:var(--text3);margin-left:4px;font-size:11px">×</span>
      </button>`;
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

/** Рендерит блок контрпиков героя (#heroCounterBlock). */
function renderHeroCounterBlock(){
  _renderScoreChipBlock('heroCounterBlock',counterPickerSelected,_ctrColor,'ctr-chip','counter');
}

// ════════════════════════════════════════════════════════════
// ЕДИНЫЙ INLINE-ПОПАП ОЦЕНКИ (position:fixed, анкер — чип)
// ════════════════════════════════════════════════════════════
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

  // position:fixed относительно чипа — попап появляется рядом с конкретным чипом,
  // а не в центре модалки. Расчёт вынесен в render-utils.js (AUDIT-A4) — тот же
  // helper использует modal-hero-strength.js в 'absolute'-режиме.
  const popupW=230, popupH=130;
  const pos=computePopupAnchorPosition({anchorEl:chipEl,popupW,popupH,mode:'fixed'});

  popup.style.cssText=`position:${pos.position};z-index:9999;top:${pos.top}px;left:${pos.left}px;width:${popupW}px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.7)`;
  popup.innerHTML=`
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">${item.name}</div>
    <div style="display:flex;gap:3px;align-items:center;margin-bottom:8px">
      ${renderScoreDots({
        value: item.score,
        high: accent,
        size: 16,
        onValue: v => `setScoreChipValue(${idx},${v})`,
      })}
    </div>
    <button class="btn" style="width:100%;font-size:10px" data-chip-action="close-popup">Готово</button>`;
  document.body.appendChild(popup);
  popup.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('[data-chip-action="close-popup"]'))_closeScoreChipPopup();
  });
}

function setScoreChipValue(idx,val){
  if(!_scoreChipPopupState)return;
  const {kind}=_scoreChipPopupState;
  const items=kind==='counter'?counterPickerSelected:heroSynergyEdits;
  if(!items[idx])return;
  // Повторный клик на ту же точку — уменьшает на 1 (toggle off)
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

// Единый делегированный обработчик — раньше open/remove висели как inline
// onclick="..." прямо в разметке чипов (см. историю в CHANGELOG.md), теперь
// вся маршрутизация здесь по data-chip-action/data-chip-kind/data-chip-idx.
document.addEventListener('click',e=>{
  const removeEl=e.target.closest('[data-chip-action="remove"]');
  if(removeEl){
    removeScoreChip(removeEl.dataset.chipKind,Number(removeEl.dataset.chipIdx));
    return;
  }
  const openEl=e.target.closest('[data-chip-action="open"]');
  if(openEl){
    openScoreChipPopup(openEl.dataset.chipKind,Number(openEl.dataset.chipIdx),openEl);
    return;
  }
  if(!e.target.closest('.ctr-chip')&&!e.target.closest('.syn-chip')&&!e.target.closest('#scoreChipPopup'))
    _closeScoreChipPopup();
});
