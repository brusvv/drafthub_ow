// ════════════════════════════════════════════════════════════
// render-players.js — вкладка «Игроки»
//
// Все визуальные стили → players.css (секция PLAYERS DETAIL).
// Inline style остаётся только для динамических значений:
//   • rc[role] — цвет роли из runtime-объекта
//   • border-color героя в пуле (основной vs пул)
//   • цвет score-метки бана (avg>=8 / avg>=6)
// ════════════════════════════════════════════════════════════

// ── Scoring delegation ────────────────────────────────────────
function computePlayerRecs(p){ return computePlayerRecs_scoring(p, maps, heroMap); }

// ── Rank helpers ──────────────────────────────────────────────
const RANK_ORDER = ['Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Champion'];
const DIV_ORDER  = [5,4,3,2,1];

function parseRank(str){
  if(!str) return -1;
  const parts = str.trim().split(/\s+/);
  const tier  = RANK_ORDER.indexOf(parts[0]);
  if(tier < 0) return -1;
  const div      = parseInt(parts[1]);
  const divScore = Number.isFinite(div) ? DIV_ORDER.indexOf(div) : 0;
  return tier * 10 + (divScore >= 0 ? divScore : 0);
}

// Для Flex выбирает топ-5 по формуле 2+2+1, приоритет по рангу
function flexTop5(p){
  const rankScores = { Tank: parseRank(p.rankTank), Damage: parseRank(p.rankDmg), Support: parseRank(p.rankSup) };
  const sorted     = ['Tank','Damage','Support'].sort((a,b) => rankScores[b] - rankScores[a]);

  function heroesForRole(role){
    const tierVal = {S:5,A:4,B:3,C:2,D:1};
    const tierOf  = n => { for(const [t,ns] of Object.entries(tierOrderHeroes)){ if(ns.includes(n)) return tierVal[t]||0; } return 0; };
    return [...new Set([...p.mainHeroes,...p.poolHeroes])]
      .filter(n => { const h=heroMap[n]; return h && h.role===role; })
      .sort((a,b) => tierOf(b) - tierOf(a));
  }

  const result = [];
  [2,2,1].forEach((quota,i) => result.push(...heroesForRole(sorted[i]).slice(0,quota)));
  return result.slice(0,5);
}

// ════════════════════════════════════════════════════════════
// GRID VIEW
// ════════════════════════════════════════════════════════════

function renderPlayers(){
  const grid   = document.getElementById('playerGrid');   if(!grid) return;
  const detail = document.getElementById('playerDetail');
  detail.classList.remove('show'); detail.innerHTML = '';

  if(!players.length){
    grid.innerHTML = renderEmptyState({
      icon: '👥',
      title: 'Состав пуст',
      desc: 'Добавь игроков чтобы анализировать баны, карты и состав',
    });
    return;
  }

  grid.innerHTML = players.map((p, idx) => {
    const isFlex = p.mainRole === 'Flex';
    const hasOff = p.offRole && p.offRole !== p.mainRole;
    const mainH  = isFlex ? flexTop5(p) : p.mainHeroes.slice(0,5);

    let roleBlock = '';
    if(isFlex)         roleBlock = `<div class="player-role-icon flex">${roleIcon(p.mainRole,48)}</div>`;
    else if(hasOff)    roleBlock = `<div class="player-role-icon two">${roleIcon(p.mainRole,28)}${roleIcon(p.offRole,22)}</div>`;
    else if(p.mainRole)roleBlock = `<div class="player-role-icon one">${roleIcon(p.mainRole,36)}</div>`;

    const heroes = mainH.map(n => {
      const src = portrait(n);
      return src
        ? `<img src="${src}" class="mini-av" title="${n}" onerror="this.outerHTML='<div class=mini-av-ph>${n[0]}</div>'">`
        : `<div class="mini-av-ph">${n[0]}</div>`;
    }).join('');

    return `<button type="button" class="player-card btn-reset" style="--card-i:${Math.min(idx,12)}" data-name="${esc(p.name)}" onclick="showPlayerDetail(this.dataset.name)">
      <div class="player-card-top">
        <div class="player-av">${p.name[0].toUpperCase()}</div>
        <div><div class="player-name">${p.name}</div><div class="player-btag">${p.btag||'—'}</div></div>
        ${roleBlock}
      </div>
      <div class="player-card-heroes">
        ${heroes}
        ${!mainH.length ? '<span class="player-no-heroes">Герои не указаны</span>' : ''}
      </div>
    </button>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════
// DETAIL VIEW
// ════════════════════════════════════════════════════════════

function showPlayerDetail(name){
  const p = players.find(x => x.name === name); if(!p) return;
  document.getElementById('playerGrid').innerHTML = '';
  const detail = document.getElementById('playerDetail');
  detail.classList.add('show');
  detail.innerHTML = _buildDetailHtml(p);
}

function backToPlayers(){
  document.getElementById('playerDetail').classList.remove('show');
  document.getElementById('playerDetail').innerHTML = '';
  renderPlayers();
}

// ── Detail sections ───────────────────────────────────────────

function _buildDetailHtml(p){
  const recs = computePlayerRecs(p);
  return `
    ${_detailHeader(p)}
    <div class="detail-grid" style="margin-top:10px">
      <div class="d-card full">
        <div class="d-card-title">
          Пул героев
          <span class="pd-pool-legend">● Основные</span>
        </div>
        ${_poolSection(p)}
      </div>
      <div class="d-card">
        <div class="d-card-title">🔴 Рекомендованные баны</div>
        <div class="pd-list">${_bansSection(recs.recBans)}</div>
      </div>
      <div class="d-card">
        <div class="d-card-title">✅ Предпочтительные карты</div>
        <div class="pd-list">${_mapsSection(recs.recMaps)}</div>
        ${recs.avoidMaps.length ? `
          <div class="d-card-title pd-avoid-title">⚠ Сложные карты</div>
          <div class="pd-list">${_avoidSection(recs.avoidMaps)}</div>` : ''}
      </div>
      ${p.notes ? `<div class="d-card full"><div class="d-card-title">Заметки</div><div class="notes-text">${p.notes}</div></div>` : ''}
    </div>
    <button class="back-btn" onclick="backToPlayers()" style="margin-top:10px">← Назад к игрокам</button>`;
}

function _detailHeader(p){
  const ranks  = [
    p.rankTank && {role:'Tank',   val:p.rankTank},
    p.rankDmg  && {role:'Damage', val:p.rankDmg},
    p.rankSup  && {role:'Support',val:p.rankSup},
  ].filter(Boolean);
  const isFlex = p.mainRole === 'Flex';
  const hasOff = p.offRole && p.offRole !== p.mainRole;

  let roleBlock = '';
  if(isFlex)
    roleBlock = `<div class="pd-role-block">${roleIcon('Flex',56)}<span class="pd-role-label" style="color:var(--accent)">Flex</span></div>`;
  else if(hasOff)
    roleBlock = `<div class="pd-role-block">${roleIcon(p.mainRole,40)}${roleIcon(p.offRole,28)}</div>`;
  else if(p.mainRole)
    roleBlock = `<div class="pd-role-block">${roleIcon(p.mainRole,44)}<span class="pd-role-label" style="color:${rc[p.mainRole]||'var(--accent)'}"> ${p.mainRole}</span></div>`;

  const rankBadges = ranks.length
    ? `<div class="pd-ranks">${ranks.map(r => `
        <div class="pd-rank-badge">
          <div class="pd-rank-role">${r.role}</div>
          <div class="pd-rank-val" style="color:${rc[r.role]}">${r.val}</div>
        </div>`).join('')}</div>`
    : '';

  return `<div class="pd-header-card">
    <div class="pd-header-top">
      <div class="pd-header-left">
        <div class="pd-avatar">${p.name[0].toUpperCase()}</div>
        <div>
          <div class="pd-name">${p.name}</div>
          <div class="pd-btag">${p.btag||'Battle.net tag не указан'}</div>
          <div class="pd-role-tags">
            ${p.mainRole ? `<span class="role-tag ${p.mainRole}">Основная: ${p.mainRole}</span>` : ''}
            ${p.offRole  ? `<span class="role-tag ${p.offRole}">Офф: ${p.offRole}</span>`  : ''}
          </div>
        </div>
        <div class="pd-role-icon">${roleBlock}</div>
      </div>
      <button class="btn"
              data-name="${esc(p.name)}"
              onclick="openPlayerModal(players.find(x=>x.name===this.dataset.name))">
        ✎ Редактировать
      </button>
    </div>
    ${rankBadges}
  </div>`;
}

function _poolSection(p){
  const isFlex = p.mainRole === 'Flex';
  const pool   = [...new Set([...p.mainHeroes,...p.poolHeroes])];
  const byRole = {Tank:[],Damage:[],Support:[]};
  pool.forEach(n => {
    const h = heroMap[n];
    if(h && byRole[h.role]) byRole[h.role].push({name:n, isMain:!isFlex&&p.mainHeroes.includes(n)});
  });

  const blocks = ['Tank','Damage','Support'].filter(r => byRole[r].length).map(r => {
    const chips = byRole[r].map(({name:n, isMain}) => {
      const src    = portrait(n);
      const border = isMain ? 'var(--accent)' : 'var(--border)';
      const img    = src
        ? `<img src="${src}" title="${n}" class="pd-pool-av" style="border-color:${border}"
                onerror="this.outerHTML='<div class=pd-pool-av-ph style=border-color:${border}>${n[0]}</div>'">`
        : `<div class="pd-pool-av-ph" style="border-color:${border}">${n[0]}</div>`;
      return `<div class="pd-pool-chip">
        ${img}
        <div class="pd-pool-dot" style="background:${isMain?'var(--accent)':'transparent'}"></div>
      </div>`;
    }).join('');

    return `<div class="pd-pool-role-block">
      <div class="pd-pool-role-label" style="color:${rc[r]}">${r}</div>
      <div class="pd-pool-heroes">${chips}</div>
    </div>`;
  }).join('');

  return blocks || '<div class="empty">Герои не указаны</div>';
}

function _bansSection(recBans){
  if(!recBans.length) return '<div class="empty">Нет данных</div>';
  return recBans.map(b => {
    const src   = portrait(b.name);
    const h     = heroMap[b.name] || {};
    const avg   = Math.round(b.score / b.count);
    const color = scoreColor(avg,{ midAt:6 });
    const high  = avg >= 8;
    const img   = src
      ? `<img src="${src}" class="pd-ban-av" onerror="this.style.display='none'">`
      : `<div class="pd-ban-av pd-ban-av-ph">${b.name[0]}</div>`;
    const sub   = h.role
      ? `<div class="pd-ban-sub">
           ${roleIcon(h.role,16)}${subroleIcon(h.role,h.subrole,16)}
           <span class="pd-ban-subrole">${h.subrole||''}</span>
         </div>`
      : '';
    return `<div class="pd-ban-row${high?' pd-ban-row-high':''}">
      ${img}
      <span class="pd-ban-name">${b.name}</span>
      ${sub}
    </div>`;
  }).join('');
}

function _mapsSection(recMaps){
  if(!recMaps.length) return '<div class="empty">Нет данных о картах героев</div>';
  return recMaps.map(m => `
    <div class="pd-map-row pd-map-row-good">
      <div class="pd-map-dot pd-map-dot-good"></div>
      <span class="pd-map-name">${m.name}</span>
      <span class="pd-map-type">${m.type}</span>
      <div class="tier-badge tier-${m.tier}">${m.tier}</div>
    </div>`).join('');
}

function _avoidSection(avoidMaps){
  return avoidMaps.map(m => `
    <div class="pd-map-row pd-map-row-bad">
      <div class="pd-map-dot pd-map-dot-bad"></div>
      <span class="pd-map-name">${m.name}</span>
      <span class="pd-map-type">${m.type}</span>
      <span class="pd-map-score-bad">−${Math.abs(m.score)}</span>
    </div>`).join('');
}
