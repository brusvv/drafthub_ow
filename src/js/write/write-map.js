// ════ WRITE — MAPS ════

async function saveMap(){
  const name=document.getElementById('mName').value.trim();
  const type=document.getElementById('mType').value;
  if(!name||!type){toast('Заполни название и тип','err');return}
  const er=document.getElementById('mapEditRow').value;
  const oldName=er?(maps.find(m=>m.rowIndex==er)||{}).name:null;
  const noAD=NO_ATKDEF.includes(type);
  const inPool=document.getElementById('mInPool').checked?'TRUE':'FALSE';
  const row=[name,type,
    document.getElementById('mTier').value,
    document.getElementById('mPrio').value,
    noAD?'':document.getElementById('mAtk').value,
    noAD?'':document.getElementById('mDef').value,
    noAD?document.getElementById('mDif').value:'',
    document.getElementById('mNotes').value.trim(),
    inPool
  ];
  const bans=pickerSelected.bans||[];
  const comp=compSlots.filter(s=>s.hero).map(s=>({
    hero:s.hero,playerRole:s.role,role:(heroMap[s.hero]||{}).role||''
  }));
  const counters=(document.getElementById('mCounters').value||'')
    .split(',').map(s=>s.trim()).filter(Boolean);
  // preferredHeroes теперь вычисляются автоматически из HeroMapStrength
  // но пользователь может переопределить вручную
  const pref=pickerSelected.preferred||[];
  try{
    if(er)await sUp(`Maps!A${er}:H${er}`,[row]);
    else await sApp('Maps',[row]);
    await rewrite('MapPreferred',oldName||name,name,pref.map(h=>[name,h]));
    await rewrite('MapBans',oldName||name,name,bans.map(h=>[name,h]));
    await rewrite('Compositions',oldName||name,name,
      comp.map(c=>[name,c.hero,c.role,c.playerRole||c.role]));
    await rewrite('MapCounters',oldName||name,name,counters.map(h=>[name,h]));
    toast(er?'Карта обновлена ✓':'Карта добавлена ✓','ok');
    closeModal('mapModal');
    await loadMaps();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}

async function rewrite(sheet, oldN, newN, rows){
  const all=await sGet(sheet+'!A:D');
  if(!all.length){if(rows.length)await sApp(sheet,rows);return}
  const h=all[0];
  const others=all.slice(1).filter(r=>r[0]!==oldN&&r[0]!==newN);
  const combined=[h,...others,...rows];
  await sUp(sheet+'!A1:D'+combined.length,combined);
  if(combined.length<all.length)
    await sClear(sheet+'!A'+(combined.length+1)+':D'+all.length);
}

async function deleteMap(){
  const er=parseInt(document.getElementById('mapEditRow').value);
  const mn=(maps.find(m=>m.rowIndex==er)||{}).name;
  if(!er||!mn)return;
  if(!confirm(`Удалить "${mn}"?`))return;
  try{
    const g=await sGid('Maps');await sDelRow(g,er-1);
    await rewrite('MapPreferred',mn,mn,[]);
    await rewrite('MapBans',mn,mn,[]);
    await rewrite('Compositions',mn,mn,[]);
    await rewrite('MapCounters',mn,mn,[]);
    toast('Удалено','ok');closeModal('mapModal');
    await loadMaps();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
