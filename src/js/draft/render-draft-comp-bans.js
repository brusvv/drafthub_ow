// @hash 483df7cd 2026-07-16T00:44
// ════ RENDER — DRAFT COMP: ФАЗА 2 (БАНЫ) ════
// Вынесено из render-draft-comp.js (16.07, AUDIT-A3-попутный split — файл
// перевалил за 260 строк). Граница по фазам, не механически: state
// (draftState) и оркестратор (renderDraftComp) остаются в исходном файле,
// эта фаза самодостаточна (свой render + свои обработчики пикера).

// ── Фаза 2: вводим баны обеих команд ──
function _renderDraftBans(){
  const allBanned=[...draftState.ourBans,...draftState.enemyBans];
  return`<div class="ban-panel">
    <div class="ban-panel-head">
      <div class="ban-panel-title">Введи итоговые баны</div>
      <div class="ban-panel-hint">0–2 бана с каждой стороны. Максимум 2 героя одной роли суммарно на всю игру.</div>
      <button class="btn" onclick="draftState.phase='pick';renderDraftComp()" style="margin-top:6px;font-size:10px">← Назад</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${_renderBanSlots('ourBans','Наши баны','var(--tank)')}
      ${_renderBanSlots('enemyBans','Баны врагов','var(--damage)')}
    </div>
    ${allBanned.length?`<div class="mono-hint-lg mb-12">
      Забанено: ${allBanned.map(n=>`<span style="color:var(--damage)">${n}</span>`).join(', ')}
    </div>`:''}
    <button class="btn btn-primary btn-lg" onclick="draftState.phase='result';renderDraftComp()">
      Показать рекомендации →
    </button>
  </div>`;
}

function _renderBanSlots(key,label,color){
  const bans=draftState[key];
  return`<div>
    <div style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:6px">${label}</div>
    ${[0,1].map(i=>{
      const name=bans[i];
      const src=name?portrait(name):null;
      return`<button type="button" class="draft-ban-slot${name?' filled':''} mb-5 btn-reset"
        onclick="openDraftBanPicker('${key}',${i})">
        ${name
          ?`${src?`<img src="${src}" class="draft-thumb-sm">`:''}
             <span style="font-size:12px;font-weight:600">${name}</span>
             <span onclick="event.stopPropagation();removeDraftBan('${key}',${i})"
               style="margin-left:auto;cursor:pointer;color:var(--text3)">×</span>`
          :`<span class="mono-hint-lg">+ Бан ${i+1}</span>`
        }</button>`;
    }).join('')}
  </div>`;
}

function openDraftBanPicker(key,idx){
  pickerMode=`draft_${key}_${idx}`;pickerMax=1;pickerRoleFilter='all';
  pickerSelected[pickerMode]=[draftState[key][idx]].filter(Boolean);
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>{b.style.display='';b.classList.toggle('active',i===0);});
  document.getElementById('pickerTitle').textContent='Выбери забаненного героя';
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function removeDraftBan(key,idx){
  draftState[key].splice(idx,1);
  renderDraftComp();
}

// Обработчик банов: draft_ourBans_N и draft_enemyBans_N
// Регистрируется как префиксный — confirmPicker направляет сюда
// всё что начинается на 'draft_' (кроме 'draftOur', см. render-draft-comp.js)
registerPickerHandler('__draft_prefix__', function(){
  const m=pickerMode;
  // Разбираем 'draft_ourBans_0' → key='ourBans', idx=0
  const parts=m.slice('draft_'.length).split('_');
  const idx=parseInt(parts[parts.length-1]);
  const key=parts.slice(0,-1).join('_'); // ourBans или enemyBans
  const sel=pickerSelected[m]||[];
  // Проверка лимита ролей: не более 2 банов одной роли суммарно
  const all=[...draftState.ourBans,...draftState.enemyBans].filter((_,i)=>{
    if(key==='ourBans')return i!==draftState.ourBans.indexOf(draftState[key]?.[idx]);
    return true;
  });
  if(sel[0]){
    const h=heroMap[sel[0]];
    if(h){
      const roleCount=all.filter(n=>(heroMap[n]||{}).role===h.role).length;
      if(roleCount>=2){toast(`Максимум 2 бана роли ${h.role}`,'err');return;}
    }
    if(!draftState[key])draftState[key]=[];
    draftState[key][idx]=sel[0];
  }
  closePicker();renderDraftComp();
});
