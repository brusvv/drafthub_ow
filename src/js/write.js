// ════ WRITE HEROES ════
async function saveHero(){
  const name=document.getElementById('hName').value.trim(),role=document.getElementById('hRole').value;
  if(!name||!role){toast('Заполни имя и роль','err');return}
  const row=[name,role,document.getElementById('hSub').value.trim(),document.getElementById('hPrio').value,document.getElementById('hBanned').checked?'TRUE':'FALSE',document.getElementById('hNotes').value.trim()];
  const er=document.getElementById('heroEditRow').value;
  try{
    if(er)await sUp(`Heroes!A${er}:F${er}`,[row]);else await sApp('Heroes',[row]);
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
  try{
    if(er)await sUp(`Maps!A${er}:H${er}`,[row]);else await sApp('Maps',[row]);
    await rewrite('MapPreferred',oldName||name,name,pref.map(h=>[name,h]));
    await rewrite('MapBans',oldName||name,name,bans.map(h=>[name,h]));
    await rewrite('Compositions',oldName||name,name,comp.map(c=>[name,c.hero,c.role]));
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
    await rewrite('MapPreferred',mn,mn,[]);await rewrite('MapBans',mn,mn,[]);await rewrite('Compositions',mn,mn,[]);
    toast('Удалено','ok');closeModal('mapModal');await loadMaps();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
