// ════ MODALS ════
function openHeroModal(hero){
  document.getElementById('heroModalTitle').textContent=hero?'Редактировать героя':'Добавить героя';
  document.getElementById('heroEditRow').value=hero?hero.rowIndex:'';
  document.getElementById('hName').value=hero?hero.name:'';
  document.getElementById('hRole').value=hero?hero.role:'';
  document.getElementById('hSub').value=hero?hero.subrole:'';
  document.getElementById('hPrio').value=hero?hero.priority:'5';
  document.getElementById('hBanned').checked=hero?hero.banned:false;
  document.getElementById('hNotes').value=hero?hero.notes:'';
  document.getElementById('heroDeleteBtn').style.display=hero?'inline-flex':'none';
  document.getElementById('heroModal').classList.remove('hidden');
}

function openMapModal(map){
  document.getElementById('mapModalTitle').textContent=map?'Редактировать карту':'Добавить карту';
  document.getElementById('mapEditRow').value=map?map.rowIndex:'';
  document.getElementById('mName').value=map?map.name:'';
  document.getElementById('mType').value=map?map.type:'';
  document.getElementById('mTier').value=map?map.tier:'B';
  document.getElementById('mPrio').value=map?map.priority:'5';
  document.getElementById('mAtk').value=map?map.atk:'3';
  document.getElementById('mDef').value=map?map.def:'3';
  document.getElementById('mDif').value=map?map.dif:'3';
  document.getElementById('mNotes').value=map?map.notes:'';
  document.getElementById('mapDeleteBtn').style.display=map?'inline-flex':'none';
  onMapTypeChange();
  // init picker state
  pickerSelected={
    preferred:map?[...map.preferredHeroes]:[],
    bans:map?[...map.bans]:[],
    comp:map?map.comp.map(c=>c.hero):[]
  };
  renderSelPreview();
  document.getElementById('mapModal').classList.remove('hidden');
}

function closeModal(id){document.getElementById(id).classList.add('hidden')}
document.querySelectorAll('.modal-overlay,.picker-overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.add('hidden')}));

