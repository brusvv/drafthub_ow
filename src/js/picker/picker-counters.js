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
function confirmCounterPicker(){store.set('synergyExclude','');closeCounterPicker();renderCounterSelPreview();renderCounterScores();}

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
  el.innerHTML=counterPickerSelected.map(({name,score})=>{
    const src=portrait(name);
    const color=score>=8?'var(--damage)':score>=6?'var(--accent)':'var(--text3)';
    return`<div class="sel-hero-chip" style="border-left:2px solid ${color}">
      ${src?`<img src="${src}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${name[0]}</div>`}
      ${name}<span style="font-family:var(--mono);font-size:9px;color:${color};margin-left:2px">${score}</span>
    </div>`;
  }).join('')+'<span class="sel-edit-hint" style="margin-left:auto">✎</span>';
}

function renderCounterScores(){
  const block=document.getElementById('counterScoresBlock');
  const list=document.getElementById('counterScoresList');
  if(!block||!list)return;
  if(!counterPickerSelected.length){block.style.display='none';return}
  block.style.display='block';
  list.innerHTML=counterPickerSelected.map((c,i)=>{
    const dots=Array.from({length:10},(_,k)=>{
      const val=k+1;const filled=val<=c.score;
      const color=val>=8?'var(--damage)':val>=5?'var(--accent)':'var(--text3)';
      return`<span onclick="setCounterScore(${i},${val})" style="cursor:pointer;font-size:14px;line-height:1;color:${filled?color:'var(--border2)'}">◆</span>`;
    }).join('');
    const lc=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';
    return`<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
      <span style="font-size:12px;font-weight:600;flex:1;min-width:80px">${c.name}</span>
      <div style="display:flex;gap:2px;align-items:center">${dots}</div>
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${lc};min-width:16px;text-align:right">${c.score}</span>
    </div>`;
  }).join('');
}

function setCounterScore(idx,val){
  if(!counterPickerSelected[idx])return;
  counterPickerSelected[idx].score=val;
  renderCounterScores();renderCounterSelPreview();
}

// ── Map type filter helper ──
function onMapTypeChange(){
  const t=document.getElementById('mType').value;
  const noAD=NO_ATKDEF.includes(t);
  document.getElementById('mAtkDefBlock').style.display=noAD?'none':'grid';
  document.getElementById('mDifBlock').style.display=noAD?'block':'none';
}
