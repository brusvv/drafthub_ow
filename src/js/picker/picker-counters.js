// ════ PICKER — COUNTERS & MAP PICKER ════

// ── Counter picker ──
let counterPickerRoleFilter='all';
let counterPickerSelected=[];

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
    return`<div class="p-hero${entry?' selected':''}" onclick="toggleCounterHero('${esc(h.name)}')">
      ${src?`<img src="${src}" class="p-hero-img" alt="${h.name}" onerror="this.outerHTML='<div class=p-hero-img-ph>${h.name[0]}</div>'">`:`<div class="p-hero-img-ph">${h.name[0]}</div>`}
      <div class="p-hero-name">${h.name}</div>
      ${entry?`<div style="position:absolute;bottom:2px;right:3px;font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:700">${entry.score}</div>`:''}
    </div>`;
  }).join('');
}

function renderCounterSelPreview(){
  const el=document.getElementById('selHeroCounters');if(!el)return;
  if(!counterPickerSelected.length){el.innerHTML='<span class="sel-empty">Нажми чтобы выбрать</span><span class="sel-edit-hint">✎</span>';return}
  el.innerHTML=counterPickerSelected.map(({name,score},i)=>{
    const src=portrait(name);
    const color=score>=8?'var(--damage)':score>=6?'var(--accent)':'var(--text3)';
    return`<div class="sel-hero-chip counter-chip" style="border-left:2px solid ${color};cursor:pointer" onclick="openCounterScorePopup(${i},this)">
      ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:4px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
      <span>${name}</span><span style="font-family:var(--mono);font-size:9px;font-weight:700;color:${color};margin-left:2px">${score}</span>
    </div>`;
  }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
}

let _cntPopupIdx=null;
function openCounterScorePopup(idx,chipEl){
  _closeCounterPopup();
  if(_cntPopupIdx===idx){_cntPopupIdx=null;return;}
  _cntPopupIdx=idx;
  const c=counterPickerSelected[idx];if(!c)return;
  const popup=document.createElement('div');
  popup.id='counterScorePopup';
  popup.style.cssText='position:absolute;z-index:300;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:12px 14px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.6)';
  popup.innerHTML=`
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">${c.name}</div>
    <div style="display:flex;gap:3px;align-items:center;margin-bottom:8px">
      ${Array.from({length:10},(_,k)=>{
        const v=k+1;const filled=v<=c.score;
        const color=v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
        return`<span onclick="setCounterScore(${idx},${v})" style="cursor:pointer;font-size:16px;color:${filled?color:'var(--border2)'};line-height:1">◆</span>`;
      }).join('')}
      <span id="cntPopVal" style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--damage);margin-left:6px">${c.score}</span>
    </div>
    <button class="btn" style="width:100%;font-size:10px" onclick="_closeCounterPopup()">Готово</button>`;
  const rect=chipEl.getBoundingClientRect();
  const modal=chipEl.closest('.modal');
  const mRect=modal?modal.getBoundingClientRect():{left:0,top:0};
  popup.style.left=(rect.left-mRect.left)+'px';
  popup.style.top=(rect.bottom-mRect.top+4)+'px';
  const container=modal||document.body;
  container.style.position=container.style.position||'relative';
  container.appendChild(popup);
  popup.addEventListener('click',e=>e.stopPropagation());
}
function _closeCounterPopup(){
  document.getElementById('counterScorePopup')?.remove();
  _cntPopupIdx=null;
}
function setCounterScore(idx,val){
  if(!counterPickerSelected[idx])return;
  counterPickerSelected[idx].score=(counterPickerSelected[idx].score===val)?val-1:val;
  _closeCounterPopup();
  renderCounterSelPreview();
  // Переоткрываем попап
  setTimeout(()=>{
    const chips=document.querySelectorAll('.counter-chip');
    if(chips[idx])openCounterScorePopup(idx,chips[idx]);
  },10);
}
// Закрываем по клику вне
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('heroModal')?.addEventListener('click',e=>{
    if(!e.target.closest('.counter-chip')&&!e.target.closest('#counterScorePopup'))
      _closeCounterPopup();
  });
});

// ── Map type filter helper ──
function onMapTypeChange(){
  const t=document.getElementById('mType').value;
  const noAD=NO_ATKDEF.includes(t);
  document.getElementById('mAtkDefBlock').style.display=noAD?'none':'block';
  document.getElementById('mDifBlock').style.display=noAD?'block':'none';
}
