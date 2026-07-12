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
      return`<div class="sel-hero-chip ${chipClass}" style="border-left:2px solid ${color};cursor:pointer"
                  onclick="openScoreChipPopup('${kind}',${i},this)">
        ${src?`<img src="${src}" onerror="this.style.display='none'" class="icon-sm">`:`<div class="sel-hero-chip-ph">${item.name[0]}</div>`}
        <span>${item.name}</span>
        <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);font-weight:700;color:${color};margin-left:2px">${item.score}</span>
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
  // а не в центре модалки
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

document.addEventListener('click',e=>{
  if(!e.target.closest('.ctr-chip')&&!e.target.closest('.syn-chip')&&!e.target.closest('#scoreChipPopup'))
    _closeScoreChipPopup();
});
