// ════ DOT RATING ════
function setDotRating(inputId, dotsId, val){
  document.getElementById(inputId).value=val;
  const dots=document.querySelectorAll(`#${dotsId} .dot-rating-dot`);
  dots.forEach(d=>{
    const dv=parseInt(d.dataset.v);
    d.classList.toggle('filled',dv<=val);
  });
}
function initDotRating(inputId, dotsId){
  const val=parseInt(document.getElementById(inputId).value)||3;
  setDotRating(inputId, dotsId, val);
}

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
  // counters via icon picker
  counterPickerSelected=hero?(hero.counters.map(c=>({name:c.name,score:c.score!==undefined?c.score:5}))):[];
  document.getElementById('heroDeleteBtn').style.display=hero?'inline-flex':'none';
  mapPickerSelected={heroStrong:hero?[...hero.strongMaps]:[],heroWeak:hero?[...hero.weakMaps]:[]};
  renderCounterSelPreview();
  renderCounterScores();
  renderMapSelPreview();
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
  document.getElementById('mCounters').value=map?(map.counters||[]).join(', '):'';
  document.getElementById('mapDeleteBtn').style.display=map?'inline-flex':'none';
  onMapTypeChange();
  pickerSelected={
    ...pickerSelected,
    preferred:map?[...map.preferredHeroes]:[],
    bans:map?[...map.bans]:[],
    comp:map?map.comp.map(c=>c.hero):[]
  };
  renderSelPreview();
  initCompSlots(map);
  setTimeout(()=>initDotRating('mDif','mDifDots'),0);
  document.getElementById('mapModal').classList.remove('hidden');
}

function closeModal(id){document.getElementById(id).classList.add('hidden')}
document.querySelectorAll('.modal-overlay,.picker-overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.add('hidden')}));

function openPlayerModal(player){
  document.getElementById('playerModalTitle').textContent=player?'Редактировать игрока':'Добавить игрока';
  document.getElementById('playerEditRow').value=player?player.rowIndex:'';
  document.getElementById('pName').value=player?player.name:'';
  document.getElementById('pBtag').value=player?player.btag:'';
  document.getElementById('pMainRole').value=player?player.mainRole:'';
  document.getElementById('pOffRole').value=player?player.offRole:'';
  _syncOffRoleVisibility();
  document.getElementById('pRankTank').value=player?player.rankTank:'';
  document.getElementById('pRankDmg').value=player?player.rankDmg:'';
  document.getElementById('pRankSup').value=player?player.rankSup:'';
  document.getElementById('pNotes').value=player?player.notes:'';
  document.getElementById('playerDeleteBtn').style.display=player?'inline-flex':'none';

  // init per-role hero pools from existing data
  if(player){
    const allHeroes=[...player.mainHeroes,...player.poolHeroes.filter(h=>!player.mainHeroes.includes(h))];
    // distribute to roles
    ['Tank','Damage','Support'].forEach(role=>{
      const key=`playerRole_${role}`;
      pickerSelected[key]=allHeroes.filter(n=>{const h=heroMap[n];return h&&h.role===role;}).slice(0,5);
    });
    // Flex: all of the above combined
    pickerSelected['playerRole_Flex']=[...player.mainHeroes].slice(0,5);
  } else {
    ['Tank','Damage','Support','Flex'].forEach(role=>{pickerSelected[`playerRole_${role}`]=[];});
  }

  onPlayerRoleChange();
  document.getElementById('playerModal').classList.remove('hidden');
}
