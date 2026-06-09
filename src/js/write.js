// ════ WRITE HEROES ════
async function saveHero(){
  const name=document.getElementById('hName').value.trim(),role=document.getElementById('hRole').value;
  if(!name||!role){toast('Заполни имя и роль','err');return}
  // build counters string from counterPickerSelected
  const countersStr=counterPickerSelected.map(c=>`${c.name}:${c.score}`).join(',');
  const row=[name,role,
    document.getElementById('hSub').value.trim(),
    document.getElementById('hPrio').value,
    document.getElementById('hBanned').checked?'TRUE':'FALSE',
    document.getElementById('hNotes').value.trim(),
    countersStr,
    mapPickerSelected.heroStrong.join(','),
    mapPickerSelected.heroWeak.join(',')
  ];
  const er=document.getElementById('heroEditRow').value;
  try{
    if(er)await sUp(`Heroes!A${er}:I${er}`,[row]);else await sApp('Heroes',[row]);
    toast(er?'Обновлено ✓':'Добавлено ✓','ok');closeModal('heroModal');await loadHeroes();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
async function deleteHero(){
  const er=parseInt(document.getElementById('heroEditRow').value);if(!er)return;
  if(!confirm('Удалить героя?'))return;
  try{const g=await sGid('Heroes');await sDelRow(g,er-1);toast('Удалено','ok');closeModal('heroModal');await loadHeroes();renderCurrentView()}catch(e){toast('Ошибка: '+e.message,'err')}
}

// ════ WRITE MAPS ════
async function saveMap(){
  const name=document.getElementById('mName').value.trim(),type=document.getElementById('mType').value;
  if(!name||!type){toast('Заполни название и тип','err');return}
  const er=document.getElementById('mapEditRow').value;
  const oldName=er?(maps.find(m=>m.rowIndex==er)||{}).name:null;
  const noAD=NO_ATKDEF.includes(type);
  const row=[name,type,document.getElementById('mTier').value,document.getElementById('mPrio').value,
    noAD?'':document.getElementById('mAtk').value,
    noAD?'':document.getElementById('mDef').value,
    noAD?document.getElementById('mDif').value:'',
    document.getElementById('mNotes').value.trim()];
  const pref=pickerSelected.preferred;
  const bans=pickerSelected.bans;
  const comp=pickerSelected.comp.map(n=>({hero:n,role:(heroMap[n]||{}).role||''}));
  const counters=(document.getElementById('mCounters').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  try{
    if(er)await sUp(`Maps!A${er}:H${er}`,[row]);else await sApp('Maps',[row]);
    await rewrite('MapPreferred',oldName||name,name,pref.map(h=>[name,h]));
    await rewrite('MapBans',oldName||name,name,bans.map(h=>[name,h]));
    await rewrite('Compositions',oldName||name,name,comp.map(c=>[name,c.hero,c.role]));
    await rewrite('MapCounters',oldName||name,name,counters.map(h=>[name,h]));
    toast(er?'Карта обновлена ✓':'Карта добавлена ✓','ok');closeModal('mapModal');await loadMaps();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}

async function rewrite(sheet,oldN,newN,rows){
  const all=await sGet(sheet+'!A:C');
  if(!all.length){if(rows.length)await sApp(sheet,rows);return}
  const h=all[0],others=all.slice(1).filter(r=>r[0]!==oldN&&r[0]!==newN);
  const combined=[h,...others,...rows];
  await sUp(sheet+'!A1:C'+combined.length,combined);
  if(combined.length<all.length)await sClear(sheet+'!A'+(combined.length+1)+':C'+all.length);
}

async function deleteMap(){
  const er=parseInt(document.getElementById('mapEditRow').value);
  const mn=(maps.find(m=>m.rowIndex==er)||{}).name;
  if(!er||!mn)return;
  if(!confirm(`Удалить "${mn}"?`))return;
  try{
    const g=await sGid('Maps');await sDelRow(g,er-1);
    await rewrite('MapPreferred',mn,mn,[]);await rewrite('MapBans',mn,mn,[]);
    await rewrite('Compositions',mn,mn,[]);await rewrite('MapCounters',mn,mn,[]);
    toast('Удалено','ok');closeModal('mapModal');await loadMaps();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}

// ════ WRITE PLAYERS ════
async function savePlayer(){
  const name=document.getElementById('pName').value.trim();
  const mainRole=document.getElementById('pMainRole').value;
  if(!name||!mainRole){toast('Заполни никнейм и основную роль','err');return}
  const er=document.getElementById('playerEditRow').value;
  const oldName=er?(players.find(p=>p.rowIndex==er)||{}).name:null;
  const row=[name,
    document.getElementById('pBtag').value.trim(),
    mainRole,
    document.getElementById('pOffRole').value,
    document.getElementById('pRankTank').value.trim(),
    document.getElementById('pRankDmg').value.trim(),
    document.getElementById('pRankSup').value.trim(),
    document.getElementById('pNotes').value.trim()
  ];

  // collect heroes from per-role pools
  const isFlex=mainRole==='Flex';
  const offRole=document.getElementById('pOffRole').value;
  let roles=isFlex?['Tank','Damage','Support']:[mainRole];
  if(!isFlex&&offRole&&offRole!==mainRole)roles.push(offRole);

  // mainHeroes = top-5 from main role (or combined top for Flex)
  let mainH=[];
  if(isFlex){
    // first heroes from each role up to total 5
    roles.forEach(r=>{const k=`playerRole_${r}`;(pickerSelected[k]||[]).forEach(h=>{if(!mainH.includes(h)&&mainH.length<5)mainH.push(h)});});
  } else {
    mainH=(pickerSelected[`playerRole_${mainRole}`]||[]).slice(0,5);
  }
  // poolH = all selected heroes from all roles
  let poolH=[];
  roles.forEach(r=>{const k=`playerRole_${r}`;(pickerSelected[k]||[]).forEach(h=>{if(!poolH.includes(h))poolH.push(h);});});

  try{
    if(er)await sUp(`Players!A${er}:H${er}`,[row]);else await sApp('Players',[row]);
    const allPH=await sGet('PlayerHeroes!A:C');
    const header=allPH.length?allPH[0]:[['player','hero','type']];
    const others=allPH.length>1?allPH.slice(1).filter(r=>r[0]!==oldName&&r[0]!==name):[];
    const newRows=[
      ...mainH.map(h=>[name,h,'main']),
      ...poolH.filter(h=>!mainH.includes(h)).map(h=>[name,h,'pool'])
    ];
    const combined=[header,...others,...newRows];
    await sUp('PlayerHeroes!A1:C'+combined.length,combined);
    if(combined.length<allPH.length)await sClear('PlayerHeroes!A'+(combined.length+1)+':C'+allPH.length);
    toast(er?'Игрок обновлён ✓':'Игрок добавлен ✓','ok');closeModal('playerModal');await loadPlayers();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}

async function deletePlayer(){
  const er=parseInt(document.getElementById('playerEditRow').value);if(!er)return;
  if(!confirm('Удалить игрока?'))return;
  try{
    const g=await sGid('Players');await sDelRow(g,er-1);
    toast('Удалено','ok');closeModal('playerModal');await loadPlayers();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
