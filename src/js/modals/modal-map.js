// ════ MODAL — MAP ════

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
  document.getElementById('mInPool').checked=map?map.inPool!==false:true;
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
  // Показываем авто-preferred из HeroMapStrength
  renderMapAutoPreferred(map);
  setTimeout(()=>{
    initDotRating('mAtk','mAtkDots');
    initDotRating('mDef','mDefDots');
    initDotRating('mDif','mDifDots');
  },0);
  document.getElementById('mapModal').classList.remove('hidden');
}

/**
 * Показывает топ героев для карты (авто из HeroMapStrength).
 * Не записывается в БД — только подсказка.
 */
function renderMapAutoPreferred(map){
  const el=document.getElementById('mAutoPreferred');if(!el)return;
  if(!map){el.innerHTML='';return;}
  const noAD=NO_ATKDEF.includes(map.type);
  const topAtk=topHeroesForMap(map,'atk',3);
  const topDef=noAD?[]:topHeroesForMap(map,'def',3);
  const chipHtml=(arr,label,color)=>{
    if(!arr.length)return'';
    return`<div style="margin-bottom:6px">
      <div style="font-family:var(--mono);font-size:8px;text-transform:uppercase;color:${color};margin-bottom:4px">${label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${arr.map(x=>{const src=portrait(x.name);return`<div class="sel-hero-chip ${x.role}">
          ${src?`<img src="${src}" style="width:18px;height:18px;border-radius:3px;object-fit:cover">`:`<div class="sel-hero-chip-ph">${x.name[0]}</div>`}
          ${x.name}<span style="font-family:var(--mono);font-size:9px;color:${color};margin-left:2px">${x.score}</span>
        </div>`;}).join('')}
      </div>
    </div>`;
  };
  if(!topAtk.length&&!topDef.length){el.innerHTML='<div style="font-size:11px;color:var(--text3)">Нет данных о силе героев на этой карте</div>';return;}
  el.innerHTML=
    chipHtml(topAtk,noAD?'Топ по силе':'Топ в атаке','var(--damage)')+
    chipHtml(topDef,'Топ в защите','var(--tank)');
}

// ── Player modal ──
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
  if(player){
    const allH=[...player.mainHeroes,...player.poolHeroes.filter(h=>!player.mainHeroes.includes(h))];
    ['Tank','Damage','Support'].forEach(role=>{
      pickerSelected[`playerRole_${role}`]=allH.filter(n=>{const h=heroMap[n];return h&&h.role===role;}).slice(0,5);
    });
    pickerSelected['playerRole_Flex']=[...player.mainHeroes].slice(0,5);
  }else{
    ['Tank','Damage','Support','Flex'].forEach(role=>{pickerSelected[`playerRole_${role}`]=[];});
  }
  onPlayerRoleChange();
  document.getElementById('playerModal').classList.remove('hidden');
}

function _syncOffRoleVisibility(){
  const mainRole=document.getElementById('pMainRole')?.value;
  const offGroup=document.getElementById('pOffRole')?.closest('.form-group');
  if(!offGroup)return;
  if(mainRole==='Flex'){
    offGroup.style.display='none';
    const sel=document.getElementById('pOffRole');if(sel)sel.value='';
  }else{
    offGroup.style.display='';
  }
}

function onPlayerRoleChange(){
  _syncOffRoleVisibility();
  const mainRole=document.getElementById('pMainRole')?.value;
  const offRole=document.getElementById('pOffRole')?.value;
  const block=document.getElementById('playerHeroPoolsBlock');
  if(!block)return;
  let roles=[];
  if(mainRole==='Flex')roles=['Tank','Damage','Support'];
  else if(mainRole){
    roles=[mainRole];
    if(offRole&&offRole!==mainRole)roles.push(offRole);
  }
  if(!roles.length){block.innerHTML='';return;}
  block.innerHTML=roles.map(role=>`
    <div class="form-group">
      <label class="form-label">Герои ${role} (до 5)</label>
      <div class="sel-heroes" id="selPlayer_${role}" onclick="openPicker('playerRole_${role}',5)">
        <span class="sel-empty">Нажми чтобы выбрать (до 5)</span><span class="sel-edit-hint">✎</span>
      </div>
    </div>`).join('');
  renderRolePoolPreviews();
}

// ── Dot rating (shared) ──
function setDotRating(inputId,dotsId,val){
  document.getElementById(inputId).value=val;
  document.querySelectorAll(`#${dotsId} .dot-rating-dot`).forEach(d=>{
    d.classList.toggle('filled',parseInt(d.dataset.v)<=val);
  });
}
function initDotRating(inputId,dotsId){
  const val=parseInt(document.getElementById(inputId).value)||3;
  setDotRating(inputId,dotsId,val);
}

function closeModal(id){document.getElementById(id).classList.add('hidden')}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.modal-overlay,.picker-overlay').forEach(el=>
    el.addEventListener('click',e=>{if(e.target===el)el.classList.add('hidden');}));
});
