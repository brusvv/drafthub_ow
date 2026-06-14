// @hash 6620e1a2 2026-06-14T08:30
// ════ WRITE — PLAYERS ════

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
  const isFlex=mainRole==='Flex';
  const offRole=document.getElementById('pOffRole').value;
  let roles=isFlex?['Tank','Damage','Support']:[mainRole];
  if(!isFlex&&offRole&&offRole!==mainRole)roles.push(offRole);
  let mainH=[];
  if(isFlex){
    roles.forEach(r=>{
      (pickerSelected[`playerRole_${r}`]||[]).forEach(h=>{
        if(!mainH.includes(h)&&mainH.length<5)mainH.push(h);
      });
    });
  }else{
    mainH=(pickerSelected[`playerRole_${mainRole}`]||[]).slice(0,5);
  }
  let poolH=[];
  roles.forEach(r=>{
    (pickerSelected[`playerRole_${r}`]||[]).forEach(h=>{
      if(!poolH.includes(h))poolH.push(h);
    });
  });
  try{
    if(er)await sUp(`Players!A${er}:H${er}`,[row]);
    else await sApp('Players',[row]);
    const allPH=await sGet('PlayerHeroes!A:C');
    const header=allPH.length?allPH[0]:['player','hero','type'];
    const others=allPH.length>1
      ?allPH.slice(1).filter(r=>r[0]!==oldName&&r[0]!==name):[];
    const newRows=[
      ...mainH.map(h=>[name,h,'main']),
      ...poolH.filter(h=>!mainH.includes(h)).map(h=>[name,h,'pool'])
    ];
    const combined=[header,...others,...newRows];
    await sUp('PlayerHeroes!A1:C'+combined.length,combined);
    if(combined.length<allPH.length)
      await sClear('PlayerHeroes!A'+(combined.length+1)+':C'+allPH.length);
    toast(er?'Игрок обновлён ✓':'Игрок добавлен ✓','ok');
    closeModal('playerModal');
    await loadPlayers();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err');console.error(e)}
}

async function deletePlayer(){
  const er=parseInt(document.getElementById('playerEditRow').value);if(!er)return;
  if(!confirm('Удалить игрока?'))return;
  try{
    const g=await sGid('Players');await sDelRow(g,er-1);
    toast('Удалено','ok');closeModal('playerModal');
    await loadPlayers();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
