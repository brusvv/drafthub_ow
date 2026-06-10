// ════ RENDER ════
function renderCurrentView(){
  const a=document.querySelector('.view.active');if(!a)return;
  const id=a.id;
  if(id==='view-maps')renderMaps();
  if(id==='view-heroes')renderHeroes();
  if(id==='view-tiers')renderTiers();
  if(id==='view-bans')renderBans();
  if(id==='view-players')renderPlayers();
  if(id==='view-roster')renderRoster();
}

function dots5(val,type,max=5){
  let h='<div class="dots">';
  for(let i=1;i<=max;i++)h+=`<div class="dot ${i<=val?type:''}"></div>`;
  return h+'</div>';
}

const ruPluralRules=new Intl.PluralRules('ru-RU');
function pluralRu(count,forms){
  const category=ruPluralRules.select(Math.abs(count));
  return forms[category]||forms.other;
}
function heroesCountLabel(count){return `${count} ${pluralRu(count,{one:'герой',few:'героя',many:'героев',other:'героя'})}`}

