// @hash bd274829 2026-06-14T08:30
// ════ WRITE — HEROES ════

async function saveHero(){
  const name=document.getElementById('hName').value.trim();
  const role=document.getElementById('hRole').value;
  if(!name||!role){toast('Заполни имя и роль','err');return}
  const countersStr=counterPickerSelected.map(c=>`${c.name}:${c.score}`).join(',');
  // Heroes колонки: name|role|subrole|priority|banned|notes|counters
  const row=[
    name,role,
    document.getElementById('hSub').value.trim(),
    document.getElementById('hPrio').value,
    document.getElementById('hBanned').checked?'TRUE':'FALSE',
    document.getElementById('hNotes').value.trim(),
    countersStr
  ];
  const er=document.getElementById('heroEditRow').value;
  try{
    if(er)await sUp(`Heroes!A${er}:G${er}`,[row]);
    else await sApp('Heroes',[row]);
    // Сохраняем силу героя на картах
    await saveHeroMapStrength(name);
    // Сохраняем синергии
    await saveHeroSynergy(name);
    toast(er?'Обновлено ✓':'Добавлено ✓','ok');
    closeModal('heroModal');
    await loadHeroes();
    await loadHeroMapStrength();
    await loadHeroSynergy();
    renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}

/**
 * Сохраняет строки HeroMapStrength для героя.
 * heroStrengthEdits = [ {map, atk, def} ] — из UI модалки.
 */
async function saveHeroMapStrength(heroName){
  if(!heroStrengthEdits||!heroStrengthEdits.length)return;
  // Читаем весь лист
  const all=await sGet('HeroMapStrength!A:D');
  const header=all.length?all[0]:['hero','map','atk','def'];
  // Убираем старые строки этого героя
  const others=all.slice(1).filter(r=>r[0]!==heroName);
  // Новые строки
  const newRows=heroStrengthEdits
    .filter(e=>e.atk||e.def)
    .map(e=>[heroName,e.map,e.atk||'',e.def||'']);
  const combined=[header,...others,...newRows];
  await sUp('HeroMapStrength!A1:D'+combined.length,combined);
  if(combined.length<all.length)
    await sClear('HeroMapStrength!A'+(combined.length+1)+':D'+all.length);
}

/**
 * Сохраняет синергии героя.
 * heroSynergyEdits = [ {name, score} ] — из UI модалки.
 */
async function saveHeroSynergy(heroName){
  if(!heroSynergyEdits)return;
  const all=await sGet('HeroSynergy!A:C');
  const header=all.length?all[0]:['hero','synergy_hero','score'];
  const others=all.slice(1).filter(r=>r[0]!==heroName&&r[1]!==heroName);
  const newRows=heroSynergyEdits
    .filter(e=>e.score>=1)
    .map(e=>[heroName,e.name,e.score]);
  const combined=[header,...others,...newRows];
  await sUp('HeroSynergy!A1:C'+combined.length,combined);
  if(combined.length<all.length)
    await sClear('HeroSynergy!A'+(combined.length+1)+':C'+all.length);
}

async function deleteHero(){
  const er=parseInt(document.getElementById('heroEditRow').value);if(!er)return;
  if(!confirm('Удалить героя?'))return;
  try{
    const g=await sGid('Heroes');await sDelRow(g,er-1);
    toast('Удалено','ok');closeModal('heroModal');
    await loadHeroes();renderCurrentView();
  }catch(e){toast('Ошибка: '+e.message,'err')}
}
