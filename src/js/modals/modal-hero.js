// ════ MODAL — HERO (core) ════
// Содержит: открытие модалки героя, синергия-пикер.
// Зависимости:
//   modal-hero-chips.js    — _renderScoreChipBlock, renderHeroCounterBlock,
//                             renderHeroSynergyBlock, openScoreChipPopup,
//                             counterPickerSelected (из picker-counters.js)
//   modal-hero-strength.js — heroStrengthEdits, renderStrengthPreview

let heroSynergyEdits=[];    // [{name, score}] — синергии текущего героя

// ════════════════════════════════════════════════════════════
// ОТКРЫТИЕ МОДАЛКИ ГЕРОЯ
// ════════════════════════════════════════════════════════════
function openHeroModal(hero){
  document.getElementById('heroModalTitle').textContent=hero?'Редактировать героя':'Добавить героя';
  document.getElementById('heroEditRow').value=hero?.id??'';
  document.getElementById('hName').value=hero?hero.name:'';
  document.getElementById('hRole').value=hero?hero.role:'';
  document.getElementById('hSub').value=hero?hero.subrole:'';
  document.getElementById('hPrio').value=hero?hero.priority:'5';
  document.getElementById('hBanned').checked=hero?hero.banned:false;
  document.getElementById('hNotes').value=hero?hero.notes:'';

  // Контрпики: counterPickerSelected живёт в picker-counters.js
  counterPickerSelected=hero?(hero.counters.map(c=>({name:c.name,score:c.score!==undefined?c.score:5}))):[];
  document.getElementById('heroDeleteBtn').style.display=hero?'inline-flex':'none';

  // Сила на картах: heroStrengthEdits живёт в modal-hero-strength.js
  heroStrengthEdits=maps.map(m=>{
    const entry=(heroMapStrength[hero?hero.name:'']||{})[m.name]||{};
    return{map:m.name,type:m.type,atk:entry.atk||0,def:entry.def||0};
  });

  // Синергии
  heroSynergyEdits=hero?(heroSynergy[hero.name]||[]).map(s=>({...s})):[];

  renderHeroCounterBlock();    // modal-hero-chips.js
  renderStrengthPreview();     // modal-hero-strength.js
  renderHeroSynergyBlock();

  // ── Режим Глобальный/Личный (см. db-load.js tierViewMode) — в этих
  // режимах редактируются ТОЛЬКО контрпики (hero_counters), остальные
  // поля героя (роль/приоритет/синергии/сила на картах) всегда командные
  // и поэтому блокируются, чтобы не создавать иллюзию что они сохранятся.
  const isTeamMode = tierViewMode === 'team';
  ['hName','hRole','hSub','hPrio','hBanned','hNotes'].forEach(id => {
    document.getElementById(id).disabled = !isTeamMode;
  });
  document.getElementById('heroDeleteBtn').style.display = (hero && isTeamMode) ? 'inline-flex' : 'none';
  document.getElementById('hSynergyAddBtn').disabled  = !isTeamMode;
  document.getElementById('hStrengthAddBtn').disabled = !isTeamMode;

  const note = document.getElementById('heroModeNote');
  if(note){
    if(isTeamMode){ note.style.display = 'none'; }
    else {
      note.style.display = '';
      note.textContent = tierViewMode === 'global'
        ? '🌐 Режим «Глобальный»: сохранится только блок «Контрпики» — в общий список для всех команд.'
        : '👤 Режим «Личный»: сохранится только блок «Контрпики» — в твою личную версию для этого героя.';
    }
  }

  document.getElementById('heroModal').classList.remove('hidden');
}

// ════════════════════════════════════════════════════════════
// SYNERGY BLOCK + PICKER
// ════════════════════════════════════════════════════════════

// Синергии используют унифицированный чип из modal-hero-chips.js
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
    closePicker();
    renderHeroSynergyBlock();
    return;
  }
  _heroModalConfirm();
};
