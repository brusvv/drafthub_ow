// ════ DRAFT BAN ASSIST ════

let banDraftMap = '';
let banDraftHeroes = [];  // имена выбранных своих героев

// ── Инициализация переопределения confirmPicker для режима banHeroes ──
const _confirmPickerPreBans = window.confirmPicker || (()=>{});
window.confirmPicker = function(){
  if(pickerMode === 'banHeroes'){
    banDraftHeroes = [...(pickerSelected.banHeroes || [])];
    closePicker();
    _refreshBanDraft();
  } else {
    _confirmPickerPreBans();
  }
};

function _refreshBanDraft(){
  const chips = document.querySelector('.ban-hero-selector');
  if(chips) chips.innerHTML = _buildHeroChips() + '<span class="ban-hero-edit">✎</span>';
  const recs = document.getElementById('banRecsContainer');
  if(recs) recs.innerHTML = _renderBanRecs(computeBanRecs());
}

function renderBans(){
  const bg = document.getElementById('bansGrid');
  if(!bg) return;
  const currentBanned = heroes.filter(h => h.banned);
  bg.innerHTML = `
    ${currentBanned.length ? `
      <div style="margin-bottom:1.75rem">
        <div class="section-lbl" style="margin-bottom:.75rem">Активные баны</div>
        ${_buildCurrentBanGroups(currentBanned)}
      </div>` : ''}

    <div class="ban-draft-panel">
      <div class="ban-draft-header">
        <div class="ban-draft-title">Ассистент банов</div>
        <div class="ban-draft-hint">Укажи карту и своих героев — система покажет приоритеты для банов</div>
      </div>

      <div class="ban-draft-controls">
        <div class="ban-draft-ctrl">
          <div class="ban-draft-lbl">Карта</div>
          <select class="form-select" id="banMapSelect" onchange="onBanMapChange(this.value)" style="font-size:13px">
            <option value="">— не выбрана —</option>
            ${maps.sort((a,b)=>a.name.localeCompare(b.name)).map(m=>
              `<option value="${esc(m.name)}"${banDraftMap===m.name?' selected':''}>${m.name} (${m.type})</option>`
            ).join('')}
          </select>
        </div>
        <div class="ban-draft-ctrl" style="flex:1">
          <div class="ban-draft-lbl">Ваши герои <span style="opacity:.45">(до 5)</span></div>
          <div class="ban-hero-selector" onclick="openPicker('banHeroes',5)">
            ${_buildHeroChips()}
            <span class="ban-hero-edit">✎</span>
          </div>
        </div>
      </div>

      <div id="banRecsContainer">${_renderBanRecs(computeBanRecs())}</div>
    </div>`;
}

function _buildCurrentBanGroups(banned){
  const byRole={Tank:[],Damage:[],Support:[]};
  banned.forEach(h=>{if(byRole[h.role])byRole[h.role].push(h);});
  return ['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div class="ban-role-group">
      <div class="ban-role-header">${roleIcon(r,14)}<span class="ban-role-title" style="color:${rc[r]}">${r}</span></div>
      <div class="ban-role-heroes">
        ${byRole[r].map(h=>{const src=portrait(h.name);return`<div class="ban-chip">
          ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-chip-ph">${h.name[0]}</div>`}
          <span class="ban-chip-name">${h.name}</span>
        </div>`;}).join('')}
      </div>
    </div>`).join('');
}

function _buildHeroChips(){
  if(!banDraftHeroes.length) return '<span class="ban-hero-placeholder">Нажми чтобы выбрать...</span>';
  return banDraftHeroes.map(n=>{
    const src=portrait(n);
    return`<div class="ban-draft-chip" title="${n}">
      ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-draft-chip-ph">${n[0]}</div>`}
      <span>${n}</span>
      <span class="ban-draft-chip-remove" onclick="event.stopPropagation();removeBanDraftHero('${esc(n)}')">×</span>
    </div>`;
  }).join('');
}

function onBanMapChange(val){
  banDraftMap = val;
  document.getElementById('banRecsContainer').innerHTML = _renderBanRecs(computeBanRecs());
}

function removeBanDraftHero(name){
  banDraftHeroes = banDraftHeroes.filter(n=>n!==name);
  pickerSelected.banHeroes = [...banDraftHeroes];
  _refreshBanDraft();
}

// ────────────────────────────────────────────────
// АЛГОРИТМ СКОРИНГА
// ────────────────────────────────────────────────
// Итоговый балл состоит из:
//   A) Угроза контрпика: сумма counter.score за каждый
//      выбранный нами герой, у которого этот кандидат
//      записан в counters. Вес x2.5.
//      Бонус +3 если кандидат ЕЩЁТАКЖЕ силён на карте.
//   B) Сила на карте: +5 если в strongMaps кандидата.
//      -3 если в weakMaps (штраф, не показывается).
//      +2 если стоит в map.counters карты.
//   C) Мета-приоритет: priority * 0.6 (фоновый весовой).
// ────────────────────────────────────────────────
function computeBanRecs(){
  if(!banDraftMap && !banDraftHeroes.length) return [];
  const selectedMap = maps.find(m=>m.name===banDraftMap);
  return heroes
    .filter(h=>!h.banned)
    .map(h=>_scoreBan(h, selectedMap))
    .filter(r=>r.score > 3)
    .sort((a,b)=>b.score-a.score)
    .slice(0, 8);
}

function _scoreBan(hero, mapObj){
  let score = 0;
  const reasons = [];

  // A) Угроза контрпика
  let counterWeight = 0;
  const paired = [];
  banDraftHeroes.forEach(hn=>{
    const our = heroMap[hn]; if(!our) return;
    const c = (our.counters||[]).find(x=>x.name===hero.name);
    if(c){ counterWeight += c.score; paired.push({hero:hn, score:c.score}); }
  });
  if(counterWeight > 0){
    score += counterWeight * 2.5;
    const top = paired.slice().sort((a,b)=>b.score-a.score).slice(0,2);
    reasons.push({
      type:'counter',
      text:'Контрит: ' + top.map(p=>`${p.hero} ×${p.score}`).join(', ')
    });
  }

  // B) Сила на карте
  if(mapObj){
    const isStrong = (hero.strongMaps||[]).includes(mapObj.name);
    const isWeak   = (hero.weakMaps||[]).includes(mapObj.name);
    if(isStrong){
      score += 5;
      if(counterWeight > 0) score += 3;  // двойная угроза
      reasons.push({type:'mapStrong', text:`Силён на ${mapObj.name}`});
    }
    if(isWeak) score -= 3;
    if((mapObj.counters||[]).includes(hero.name)){
      score += 2;
      reasons.push({type:'mapBan', text:'В бан-листе карты'});
    }
  }

  // C) Мета
  score += hero.priority * 0.6;
  if(hero.priority >= 8) reasons.push({type:'meta', text:`Мета ${hero.priority}/10`});

  return { hero, score:Math.round(score), reasons };
}

function _renderBanRecs(recs){
  if(!banDraftMap && !banDraftHeroes.length){
    return`<div class="ban-recs-empty">Выбери карту или своих героев — появятся рекомендации</div>`;
  }
  if(!recs.length){
    return`<div class="ban-recs-empty">Нет ярко выраженных кандидатов на бан</div>`;
  }
  const maxScore = recs[0].score;
  const tagStyle = {
    counter: 'background:rgba(224,85,85,.12);border-color:rgba(224,85,85,.35);color:var(--damage)',
    mapStrong:'background:rgba(74,158,224,.1);border-color:rgba(74,158,224,.3);color:var(--tank)',
    mapBan:   'background:rgba(240,160,48,.1);border-color:rgba(240,160,48,.3);color:var(--accent)',
    meta:     'background:rgba(43,189,142,.1);border-color:rgba(43,189,142,.25);color:var(--support)',
  };

  return `<div class="ban-recs-header">
    <span class="ban-recs-title">Рекомендации</span>
    <span class="ban-recs-algo-hint">A = угроза контрпика · B = сила на карте · C = мета</span>
  </div>
  <div class="ban-recs-grid">
    ${recs.map((r,i)=>{
      const pct = Math.min(100, Math.round((r.score/maxScore)*100));
      const barColor = pct>70?'var(--damage)':pct>40?'var(--accent)':'var(--text3)';
      const urgTag = pct>70?['HIGH','var(--damage)']:pct>40?['MED','var(--accent)']:['LOW','var(--text3)'];
      const src = portrait(r.hero.name);
      const tags = r.reasons.map(rs=>
        `<span class="ban-rec-tag" style="${tagStyle[rs.type]||tagStyle.meta}">${rs.text}</span>`
      ).join('');
      return`<div class="ban-rec-card${pct>70?' ban-rec-high':''}">
        <div class="ban-rec-rank">${i+1}</div>
        <div class="ban-rec-portrait">
          ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-rec-ph">${r.hero.name[0]}</div>`}
        </div>
        <div class="ban-rec-body">
          <div class="ban-rec-name">${r.hero.name}</div>
          <div class="ban-rec-sub">${roleIcon(r.hero.role,11)} <span>${r.hero.subrole||r.hero.role}</span></div>
          <div class="ban-rec-bar-wrap">
            <div class="ban-rec-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>
          ${tags?`<div class="ban-rec-tags">${tags}</div>`:''}
        </div>
        <div class="ban-rec-urgency" style="color:${urgTag[1]}">${urgTag[0]}</div>
      </div>`;
    }).join('')}
  </div>`;
}
