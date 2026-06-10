// ════ HEROES — подклассы новой строкой ════
function renderHeroes(){
  const pool=document.getElementById('heroPool');
  const roles=heroFilter==='all'?['Tank','Damage','Support']:[heroFilter];
  pool.innerHTML=roles.map(role=>{
    const h=heroes.filter(x=>x.role===role).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    if(!h.length)return'';
 
    // Группировка по подклассу
    const subroleOrder={
      Tank:['Initiator','Bruiser','Stalwart'],
      Damage:['Sharpshooter','Flanker','Recon','Specialist'],
      Support:['Tactician','Medic','Survivor']
    };
    const order=subroleOrder[role]||[];
    const bySubrole={};
    h.forEach(hero=>{
      const sub=hero.subrole||'Other';
      if(!bySubrole[sub])bySubrole[sub]=[];
      bySubrole[sub].push(hero);
    });
    const sortedSubs=[...new Set([...order,...Object.keys(bySubrole)])].filter(s=>bySubrole[s]);
 
    const subroleGroups=sortedSubs.map(sub=>`
      <div class="subrole-group">
        <div class="subrole-lbl">${subroleIcon(role,sub,14)} ${sub}</div>
        <div class="hero-grid">${bySubrole[sub].map(hero=>{
          const src=portrait(hero.name);
          // Top counters (up to 3) with portrait + score
          const topC=(hero.counters||[]).slice().sort((a,b)=>b.score-a.score).slice(0,3);
          const counterChips=topC.map(c=>{
            const csrc=portrait(c.name);
            const cc=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';
            return`<div class="h-counter-icon">
              ${csrc?`<img src="${csrc}" alt="${c.name}" onerror="this.style.display='none'">`:`<div class="h-counter-icon-ph">${c.name[0]}</div>`}
              <div class="h-counter-score" style="color:${cc}">${c.score}</div>
            </div>`;
          }).join('');
          return`<div class="h-card ${hero.banned?'banned':''}" onclick="openHeroModal(heroes.find(x=>x.name==='${esc(hero.name)}'))">
            <div class="h-card-accent" style="background:${rc[hero.role]}"></div>
            ${src?`<img src="${src}" class="h-card-img" alt="${hero.name}" onerror="this.outerHTML='<div class=h-card-img-ph>${hero.name[0]}</div>'">`:`<div class="h-card-img-ph">${hero.name[0]}</div>`}
            ${hero.banned?'<div class="banned-tag">БАН</div>':''}
            <div class="h-card-body">
              <div class="h-card-name">${hero.name}</div>
              ${topC.length?`<div class="h-counter-list">${counterChips}</div>`:''}
            </div>
          </div>`;
        }).join('')}</div>
      </div>`).join('');

    return`<div class="role-section">
      <div class="role-header">
        ${roleIcon(role,18)}
        <span class="role-title">${role}</span>
        <span class="role-cnt">${heroesCountLabel(h.length)}</span>
      </div>
      ${subroleGroups}
    </div>`;
  }).join('')||'<div class="empty">Нет героев.</div>';
}

function filterHeroes(role,btn){heroFilter=role;document.querySelectorAll('#heroFilters .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderHeroes()}

