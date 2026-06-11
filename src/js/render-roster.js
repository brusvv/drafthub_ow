// ════════════════════════════════════════════════════════════
// render-roster.js — вкладка «Состав»
//
// Все визуальные стили → players.css (секция ROSTER).
// Inline style остаётся только для:
//   • rc[role] — динамический цвет роли
//   • transform:rotate — стрелка раскрытия
//   • border-color ban-карточки (high/med)
// ════════════════════════════════════════════════════════════

// ── Store proxies ─────────────────────────────────────────────
Object.defineProperties(window, {
  rosterPlayers:  { get(){ return store.get('rosterPlayers');  }, set(v){ store.set('rosterPlayers',v);  }, configurable:true },
  rosterRoles:    { get(){ return store.get('rosterRoles');    }, set(v){ store.set('rosterRoles',v);    }, configurable:true },
  rosterRoleOpen: { get(){ return store.get('rosterRoleOpen'); }, set(v){ store.set('rosterRoleOpen',v); }, configurable:true },
  openBanDetail:  { get(){ return store.get('openBanDetail');  }, set(v){ store.set('openBanDetail',v);  }, configurable:true },
});

// ── Role helpers ──────────────────────────────────────────────
function getRosterRole(name){ return rosterRoles[name]||null; }

function setRosterRole(pname,role){
  const limits={Tank:1,Damage:2,Support:2};
  const used={Tank:0,Damage:0,Support:0};
  rosterPlayers.forEach(pl=>{
    if(pl.name===pname)return;
    const r=getRosterRole(pl.name);
    if(r&&used[r]!==undefined)used[r]++;
  });
  if(limits[role]!==undefined&&used[role]>=limits[role]){
    toast(`Роль ${role} уже занята (лимит ${limits[role]})`,'err');return;
  }
  rosterRoles[pname]=role; rosterRoleOpen[pname]=false; renderRoster();
}
function clearRosterRole(pname){ delete rosterRoles[pname]; rosterRoleOpen[pname]=true; renderRoster(); }
function toggleBanDetail(name){ openBanDetail=openBanDetail===name?null:name; renderRoster(); }
function getBanVictims(n){ return getBanVictims_scoring(n,rosterPlayers,getHeroesForRoster,heroMap); }
function getHeroesForRoster(p){
  const sel=getRosterRole(p.name);
  const all=[...new Set([...p.mainHeroes,...p.poolHeroes])];
  return sel?all.filter(n=>{const h=heroMap[n];return h&&h.role===sel;}):all;
}
function computeRosterRecs(){ return computeRosterRecs_scoring(rosterPlayers,getHeroesForRoster,maps,heroMap); }

// ════════════════════════════════════════════════════════════
// MAIN RENDER
// ════════════════════════════════════════════════════════════
function renderRoster(){
  const el=document.getElementById('rosterContent'); if(!el)return;
  if(!rosterPlayers.length){
    el.innerHTML=`<div class="empty-state">
      <div class="empty-icon">🎮</div>
      <div class="empty-title">Состав не собран</div>
      <div class="empty-desc">Добавь игроков для анализа банов и предпочтительных карт</div>
      <button class="btn btn-primary" onclick="openRosterPlayerPicker()" style="margin-top:12px">+ Добавить игрока</button>
    </div>`;
    return;
  }
  const recs=computeRosterRecs();
  const avoidBlock=recs.avoid.length?`
    <div class="d-card-title" style="margin-top:14px;border:none;padding:0 0 8px">⚠ Избегать</div>
    <div class="roster-map-list">${recs.avoid.map(m=>_mapRow(m,'bad')).join('')}</div>`:'';

  el.innerHTML=`
    <div class="roster-player-list">${rosterPlayers.map(_playerRow).join('')}</div>
    <div class="detail-grid">
      <div class="d-card">
        <div class="d-card-title">🔴 Рекомендованные баны</div>
        <div class="d-card-hint">Контрпики нескольких игроков — нажми чтобы раскрыть</div>
        <div class="roster-ban-list">
          ${recs.bans.length?recs.bans.map(_banRow).join(''):'<div class="empty">Нет данных</div>'}
        </div>
      </div>
      <div class="d-card">
        <div class="d-card-title">✅ Предпочтительные карты</div>
        <div class="d-card-hint">По сильным картам всех игроков</div>
        <div class="roster-map-list">
          ${recs.maps.length?recs.maps.map(m=>_mapRow(m,'good')).join(''):'<div class="empty">Добавь героев игрокам</div>'}
        </div>
        ${avoidBlock}
      </div>
    </div>`;
}

// ── Player row ────────────────────────────────────────────────
function _playerRow(p){
  const sel=getRosterRole(p.name);
  const isOpen=rosterRoleOpen[p.name]||false;
  const availRoles=['Tank','Damage','Support'].filter(r=>{
    return [...new Set([...p.mainHeroes,...p.poolHeroes])].some(n=>{const h=heroMap[n];return h&&h.role===r;});
  });
  const displayH=sel?[
    ...p.mainHeroes.filter(n=>{const h=heroMap[n];return h&&h.role===sel;}),
    ...p.poolHeroes.filter(n=>{const h=heroMap[n];return h&&h.role===sel&&!p.mainHeroes.includes(n);}),
  ].slice(0,5):p.mainHeroes.slice(0,5);

  const rolePicker=sel&&!isOpen
    ?`<div class="roster-role-selected" data-pname="${esc(p.name)}" onclick="clearRosterRole(this.dataset.pname)" title="Сменить роль">
        ${roleIcon(sel,18)}<span class="roster-role-label" style="color:${rc[sel]||'var(--text)'}">${sel}</span>
      </div>`
    :`<div class="roster-role-picker">${availRoles.map(r=>`
        <div class="roster-role-btn${sel===r?' active':''}"
             style="opacity:${!sel||sel===r?1:0.45}"
             data-pname="${esc(p.name)}" data-role="${r}"
             onclick="setRosterRole(this.dataset.pname,this.dataset.role)" title="${r}">
          ${roleIcon(r,18)}
        </div>`).join('')}</div>`;

  const heroChips=displayH.map(n=>{
    const src=portrait(n);
    return src
      ?`<img src="${src}" title="${n}" class="roster-hero-av" onerror="this.style.display='none'">`
      :`<div class="roster-hero-av roster-hero-av-ph">${n[0]}</div>`;
  }).join('');

  return`<div class="roster-player-row">
    <div class="roster-player-info">${rolePicker}<span class="roster-player-name">${p.name}</span></div>
    <div class="roster-hero-strip">${heroChips}</div>
    <button class="btn btn-danger roster-remove-btn" data-pname="${esc(p.name)}" onclick="removeRosterPlayer(this.dataset.pname)">✕</button>
  </div>`;
}

// ── Ban row ───────────────────────────────────────────────────
function _banRow(b){
  const src=portrait(b.name); const h=heroMap[b.name]||{};
  const isOpen=openBanDetail===b.name;
  const high=b.avg>=8;
  const color=high?'var(--damage)':'var(--accent)';
  const bdr=high?`rgba(224,85,85,${isOpen?.6:.35})`:`rgba(240,160,48,${isOpen?.5:.25})`;
  const portrait_el=src
    ?`<img src="${src}" class="roster-ban-portrait" onerror="this.style.display='none'">`
    :`<div class="roster-ban-portrait roster-ban-portrait-ph">${b.name[0]}</div>`;
  const sub=h.role
    ?`<div class="roster-ban-subrole">${roleIcon(h.role,12)}<span class="roster-ban-subrole-text">${h.subrole||h.role}</span></div>`:'';
  const detail=isOpen?_banDetail(b.name):'';
  return`<div class="roster-ban-card" style="border-color:${bdr}">
    <div class="roster-ban-header" data-bname="${esc(b.name)}" onclick="toggleBanDetail(this.dataset.bname)">
      ${portrait_el}
      <div class="roster-ban-body"><div class="roster-ban-name">${b.name}</div>${sub}</div>
      <span class="roster-ban-count" style="color:${color}">${heroesCountLabel(b.count)}</span>
      <span class="roster-ban-arrow" style="transform:rotate(${isOpen?90:0}deg)">›</span>
    </div>
    ${detail?`<div class="roster-ban-detail">${detail}</div>`:''}
  </div>`;
}

function _banDetail(banName){
  const victims=getBanVictims(banName);
  if(!victims.length)return'<div class="roster-ban-detail-empty">Нет пересечений с пулом</div>';
  const byPlayer={};
  victims.forEach(v=>{if(!byPlayer[v.player])byPlayer[v.player]=[];byPlayer[v.player].push(v);});
  return`<div class="roster-ban-detail-inner">
    <div class="roster-ban-detail-label">Контрит ваших героев</div>
    ${Object.entries(byPlayer).map(([pname,vics])=>`
      <div class="roster-victim-row">
        <span class="roster-victim-player">${pname}</span>
        <div class="roster-victim-heroes">${vics.map(v=>{
          const vsrc=portrait(v.hero);
          const sc=v.score>=8?'var(--damage)':v.score>=5?'var(--accent)':'var(--text3)';
          const bdr=v.isMain?'var(--accent)':'var(--border)';
          const img=vsrc
            ?`<img src="${vsrc}" class="roster-victim-av" style="border-color:${bdr}" onerror="this.style.display='none'">`
            :`<div class="roster-victim-av roster-victim-av-ph" style="border-color:${bdr}">${v.hero[0]}</div>`;
          return`<div class="roster-victim-chip">${img}<span class="roster-victim-score" style="color:${sc}">${v.score}</span></div>`;
        }).join('')}</div>
      </div>`).join('')}
  </div>`;
}

// ── Map row ───────────────────────────────────────────────────
function _mapRow(m,type){
  const good=type==='good';
  const dot=good?'var(--support)':'var(--damage)';
  const score=good
    ?`<span class="roster-map-score roster-map-score-good">+${m.score}</span>`
    :`<span class="roster-map-score roster-map-score-bad">−${Math.abs(m.score)}</span>`;
  return`<div class="roster-map-row${good?' roster-map-row-good':''}">
    <div class="roster-map-dot" style="background:${dot}"></div>
    <span class="roster-map-name">${m.name}</span>
    ${good?`<span class="roster-map-type">${m.type}</span>`:''}
    ${good?`<div class="tier-badge tier-${m.tier}">${m.tier}</div>`:''}
    ${score}
  </div>`;
}

// ── Player picker popup ───────────────────────────────────────
function openRosterPlayerPicker(){
  const avail=players.filter(p=>!rosterPlayers.find(r=>r.name===p.name));
  if(!avail.length){toast('Все игроки уже добавлены','err');return;}
  document.body.insertAdjacentHTML('beforeend',`
    <div class="roster-picker-overlay" id="rosterPickerBg"
         onclick="if(event.target.id==='rosterPickerBg')this.remove()">
      <div class="roster-picker-modal">
        <div class="roster-picker-title">Выбери игрока</div>
        <div class="roster-picker-list">
          ${avail.map(p=>`
            <div class="roster-picker-item" data-pname="${esc(p.name)}" onclick="addRosterPlayer(this.dataset.pname)">
              <div class="roster-picker-av">${p.name[0].toUpperCase()}</div>
              <span class="roster-picker-name">${p.name}</span>
              ${p.mainRole?`<span class="role-tag ${p.mainRole}">${p.mainRole}</span>`:''}
            </div>`).join('')}
        </div>
      </div>
    </div>`);
}

function addRosterPlayer(name){
  const bg=document.getElementById('rosterPickerBg'); if(bg)bg.remove();
  const p=players.find(x=>x.name===name);
  if(!p||rosterPlayers.find(r=>r.name===name))return;
  const limits={Tank:1,Damage:2,Support:2};
  const activeRoles=pl=>{
    const sel=getRosterRole(pl.name);
    if(sel)return[sel];
    if(pl.mainRole&&pl.mainRole!=='Flex')return[pl.mainRole];
    if(pl.mainRole==='Flex')return['Tank','Damage','Support'];
    return[];
  };
  const counts={Tank:0,Damage:0,Support:0};
  rosterPlayers.forEach(pl=>activeRoles(pl).forEach(r=>{if(counts[r]!==undefined)counts[r]++;}));
  const newR=activeRoles(p);
  if(!newR.some(r=>!limits[r]||counts[r]<limits[r])){
    toast(`Нельзя добавить — лимиты ролей заполнены (${newR.map(r=>`${r}:${counts[r]}/${limits[r]||'∞'}`).join(', ')})`,'err');
    return;
  }
  rosterPlayers.push(p); renderRoster();
}
function removeRosterPlayer(name){ rosterPlayers=rosterPlayers.filter(p=>p.name!==name); renderRoster(); }
