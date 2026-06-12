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
          return`<div class="h-card ${hero.banned?'banned':''}" onclick="openHeroInfoPopup('${esc(hero.name)}')">
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


// ════ HERO INFO POPUP (tier-preview style) ════
function openHeroInfoPopup(name){
  const hero=heroes.find(h=>h.name===name);if(!hero)return;
  const src=portrait(hero.name);

  // Сильные/слабые карты из heroMapStrength
  const strengthEntries=Object.entries(heroMapStrength[hero.name]||{});
  const strongMaps=strengthEntries.filter(([,v])=>v.avg>=7).sort((a,b)=>b[1].avg-a[1].avg).slice(0,4);
  const weakMaps =strengthEntries.filter(([,v])=>v.avg<=4).sort((a,b)=>a[1].avg-b[1].avg).slice(0,4);

  const _mapChip=([mName,v])=>{
    const m=maps.find(x=>x.name===mName);
    const ms=mapImg(mName);
    const noAD=m?NO_ATKDEF.includes(m.type):false;
    const label=noAD?`${v.atk}`:`${v.atk}/${v.def}`;
    return`<div style="display:flex;align-items:center;gap:5px;padding:3px 6px;border-radius:6px;background:var(--bg3);border:1px solid var(--border)">
      ${ms?`<img src="${ms}" style="width:32px;height:20px;object-fit:cover;border-radius:3px" onerror="this.style.display='none'">`:''}
      <span style="font-size:11px;font-weight:600;flex:1">${mName}</span>
      <span style="font-family:var(--mono);font-size:9px;color:var(--accent)">${label}</span>
      ${m?mapTypeIcon(m.type,10):''}
    </div>`;
  };

  const mapsHtml=(!strongMaps.length&&!weakMaps.length)
    ?'<div class="empty" style="font-size:11px">Нет данных о силе на картах</div>'
    :`${strongMaps.length?`<div style="font-family:var(--mono);font-size:9px;color:var(--support);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Силён</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">${strongMaps.map(_mapChip).join('')}</div>`:''}
     ${weakMaps.length?`<div style="font-family:var(--mono);font-size:9px;color:var(--damage);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Слаб</div>
      <div style="display:flex;flex-direction:column;gap:4px">${weakMaps.map(_mapChip).join('')}</div>`:''}`;

  // Синергии по ролям
  const syns=heroSynergy[hero.name]||[];
  const synByRole={Tank:[],Damage:[],Support:[]};
  syns.forEach(s=>{const h=heroMap[s.name];if(h&&synByRole[h.role])synByRole[h.role].push(s);});
  const synHtml=['Tank','Damage','Support'].filter(r=>synByRole[r].length).map(role=>`
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
      ${roleIcon(role,14)}
      ${synByRole[role].sort((a,b)=>b.score-a.score).map(s=>{
        const sp=portrait(s.name);
        const color=s.score>=8?'var(--support)':s.score>=5?'var(--accent)':'var(--text3)';
        return`<div title="${s.name} — ${s.score}/10" style="position:relative;cursor:default">
          ${sp?`<img src="${sp}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;border:1px solid ${color}" onerror="this.style.display='none'">`
            :`<div style="width:28px;height:28px;border-radius:5px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--text3);border:1px solid ${color}">${s.name[0]}</div>`}
          <div style="position:absolute;bottom:-2px;right:-2px;font-family:var(--mono);font-size:7px;font-weight:700;background:${color};color:#000;border-radius:3px;padding:0 2px;line-height:1.4">${s.score}</div>
        </div>`;
      }).join('')}
    </div>`).join('');

  // Контрпики
  const topCounters=(hero.counters||[]).sort((a,b)=>b.score-a.score).slice(0,6);
  const countersHtml=topCounters.length
    ?`<div style="display:flex;flex-wrap:wrap;gap:5px">${topCounters.map(c=>{
        const cp=portrait(c.name);const color=c.score>=8?'var(--damage)':c.score>=5?'var(--accent)':'var(--text3)';
        return`<div style="display:flex;align-items:center;gap:4px;padding:2px 6px 2px 4px;border-radius:5px;background:var(--bg3);border:1px solid ${color}22">
          ${cp?`<img src="${cp}" style="width:20px;height:20px;border-radius:3px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:20px;height:20px;border-radius:3px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800">${c.name[0]}</div>`}
          <span style="font-size:11px;font-weight:600">${c.name}</span>
          <span style="font-family:var(--mono);font-size:9px;color:${color}">${c.score}</span>
        </div>`;
      }).join('')}</div>`
    :'<div class="empty" style="font-size:11px">Не указаны</div>';

  const body=`
    <div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">
      ${src?`<img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0" onerror="this.style.display='none'">`:''}
      <div>
        <div style="font-size:20px;font-weight:800;margin-bottom:4px">${hero.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          ${roleIcon(hero.role,16)}
          <span style="font-family:var(--mono);font-size:10px;color:${rc[hero.role]||'var(--text2)'};text-transform:uppercase">${hero.role}</span>
          ${hero.subrole?`${subroleIcon(hero.role,hero.subrole,14)}<span style="font-family:var(--mono);font-size:10px;color:var(--text2);text-transform:uppercase">${hero.subrole}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          ${Array.from({length:10},(_,k)=>`<span style="font-size:10px;color:${k<hero.priority?'var(--accent)':'var(--border2)'}">◆</span>`).join('')}
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-left:4px">${hero.priority}/10</span>
        </div>
        ${hero.banned?'<div style="margin-top:6px;font-family:var(--mono);font-size:9px;background:rgba(224,85,85,.15);color:var(--damage);border-radius:4px;padding:2px 7px;display:inline-block">В текущем бане</div>':''}
      </div>
    </div>

    ${syns.length?`<div style="margin-bottom:14px">
      <div class="tier-preview-section-title">Синергии</div>
      ${synHtml||'<div class="empty" style="font-size:11px">Нет данных</div>'}
    </div>`:''}

    <div style="margin-bottom:14px">
      <div class="tier-preview-section-title">Сила на картах</div>
      ${mapsHtml}
    </div>

    ${topCounters.length?`<div>
      <div class="tier-preview-section-title">Контрпики</div>
      ${countersHtml}
    </div>`:''}

    ${hero.notes?`<div style="margin-top:12px;font-size:12px;color:var(--text2);line-height:1.7">${hero.notes}</div>`:''}`;

  const actions=`<button class="btn" onclick="closeTierPreview();openHeroModal(heroes.find(h=>h.name==='${esc(hero.name)}'))">✎ Редактировать</button>`;
  openTierPreview(hero.name, body, actions);
}
