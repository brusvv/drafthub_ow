// @hash 8119b9d2 2026-06-13
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


// ════ HERO INFO POPUP ════
let _heroInfoExpanded=false;

// ── Универсальный чип героя: портрет + скор + tooltip + клик → карточка ──
const _synColor = s => s>=8?'var(--support)':s>=5?'var(--accent)':'var(--text3)';
const _ctrColor = s => s>=8?'var(--damage)' :s>=5?'var(--accent)':'var(--text3)';

function _heroScoreChip(name, score, colorFn, size=36){
  const src=portrait(name);
  const color=colorFn(score);
  const r=Math.round(size*0.18);
  const img=src
    ?`<img src="${src}" style="width:${size}px;height:${size}px;border-radius:${r}px;object-fit:cover;border:2px solid ${color};display:block" onerror="this.style.display='none'">`
    :`<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.3)}px;font-weight:800;color:var(--text3);border:2px solid ${color}">${name[0]}</div>`;
  return`<div title="${esc(name)}" style="position:relative;cursor:pointer;flex-shrink:0"
              onclick="event.stopPropagation();closeTierPreview();openHeroInfoPopup('${esc(name)}')">
    ${img}
    <div style="position:absolute;bottom:-3px;right:-3px;font-family:var(--mono);font-size:8px;font-weight:700;background:${color};color:#000;border-radius:3px;padding:0 3px;line-height:1.5">${score}</div>
  </div>`;
}

function openHeroInfoPopup(name){
  _heroInfoExpanded=false;
  _buildHeroInfoPopup(name);
}


function _scoreColor(v){
  if(v<=0)  return 'var(--text3)';
  if(v<=4)  return `hsl(${Math.round(0+(v-1)*5)},70%,50%)`;
  if(v===5) return 'var(--text3)';
  if(v<=7)  return `hsl(${Math.round(38+(v-6)*12)},80%,52%)`;
  if(v===8) return 'hsl(145,50%,50%)';
  if(v===9) return 'hsl(135,65%,45%)';
  return 'hsl(128,75%,40%)';
}

function _buildHeroInfoPopup(name){
  const hero=heroes.find(h=>h.name===name);if(!hero)return;
  const src=portrait(hero.name);
  const strengthEntries=Object.entries(heroMapStrength[hero.name]||{});
  const allStrong=strengthEntries.filter(([,v])=>v.avg>=7).sort((a,b)=>b[1].avg-a[1].avg);
  const allWeak  =strengthEntries.filter(([,v])=>v.avg<=4).sort((a,b)=>a[1].avg-b[1].avg);
  const strongMaps=_heroInfoExpanded?allStrong:allStrong.slice(0,5);
  const weakMaps  =_heroInfoExpanded?allWeak  :allWeak.slice(0,5);

  const _mapRow=([mName,v],showFull)=>{
    const m=maps.find(x=>x.name===mName);
    const ms=mapImg(mName);
    const noAD=m?NO_ATKDEF.includes(m.type):false;
    const scoreHtml=showFull&&!noAD
      // Иконки ATK/DEF вместо текстовых подписей
      ?`${ICON_ATK}<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${_scoreColor(v.atk)}">${v.atk}</span>
        ${ICON_DEF}<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${_scoreColor(v.def)}">${v.def}</span>`
      :`<span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${_scoreColor(noAD?v.atk:v.avg)}">${noAD?v.atk:v.avg}</span>`;
    return`<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;background:var(--bg3);border:1px solid var(--border)">
      ${m?mapTypeIcon(m.type,18):''}
      ${ms?`<img src="${ms}" style="width:60px;height:36px;object-fit:cover;border-radius:5px;flex-shrink:0" onerror="this.style.display='none'">`:'' }
      <span style="font-size:13px;font-weight:600;flex:1">${mName}</span>
      ${scoreHtml}
    </div>`;
  };

  const hasMore=(!_heroInfoExpanded&&(allStrong.length>5||allWeak.length>5));
  const mapsHtml=(allStrong.length===0&&allWeak.length===0)
    ?'<div class="empty" style="font-size:12px">Нет данных о силе на картах</div>'
    :`${strongMaps.length?`<div style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--support);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Силён</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">${strongMaps.map(e=>_mapRow(e,_heroInfoExpanded)).join('')}</div>`:''}
     ${weakMaps.length?`<div style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--damage);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Слаб</div>
      <div style="display:flex;flex-direction:column;gap:5px">${weakMaps.map(e=>_mapRow(e,_heroInfoExpanded)).join('')}</div>`:''}
     ${hasMore?`<button class="btn" onclick="_toggleHeroInfoExpand('${esc(name)}')" style="margin-top:8px;font-size:11px;width:100%">Подробнее ↓</button>`:''}
     ${_heroInfoExpanded?`<button class="btn" onclick="_toggleHeroInfoExpand('${esc(name)}')" style="margin-top:8px;font-size:11px;width:100%">Свернуть ↑</button>`:''}`;

  // Синергии по ролям
  const syns=heroSynergy[hero.name]||[];
  const synByRole={Tank:[],Damage:[],Support:[]};
  syns.forEach(s=>{const h=heroMap[s.name];if(h&&synByRole[h.role])synByRole[h.role].push(s);});
  const synHtml=(_heroInfoExpanded||!syns.length)?(['Tank','Damage','Support'].filter(r=>synByRole[r].length).map(role=>`
    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px">
      ${roleIcon(role,16)}
      ${synByRole[role].sort((a,b)=>b.score-a.score).map(s=>{
        const sp=portrait(s.name);
        const color=s.score>=8?'var(--support)':s.score>=5?'var(--accent)':'var(--text3)';
        return _heroScoreChip(s.name,s.score,_synColor,40);
      }).join('')}
    </div>`).join('')||'<div class="empty" style="font-size:12px">Нет данных</div>')
    :'';
  const synSection=syns.length?`<div style="margin-bottom:16px">
    <div class="tier-preview-section-title" style="font-size:12px;margin-bottom:8px">Синергии</div>
    ${_heroInfoExpanded?synHtml:`<div style="display:flex;flex-wrap:wrap;gap:5px">${syns.slice(0,6).map(s=>_heroScoreChip(s.name,s.score,_synColor,30)).join('')}</div>`}
  </div>`:'';

  const topCounters=(hero.counters||[]).sort((a,b)=>b.score-a.score).slice(0,_heroInfoExpanded?12:6);
  const countersSection=topCounters.length?`<div style="margin-bottom:16px">
    <div class="tier-preview-section-title" style="font-size:12px;margin-bottom:8px">Контрпики</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px">${topCounters.map(c=>_heroScoreChip(c.name,c.score,_ctrColor,36)).join('')}</div>
  </div>`:'';

  const body=`
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start">
      ${src?`<img src="${src}" style="width:96px;height:96px;object-fit:cover;border-radius:12px;flex-shrink:0;border:2px solid ${rc[hero.role]||'var(--border2)'}" onerror="this.style.display='none'">`:''}
      <div style="flex:1">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="font-size:24px;font-weight:800;letter-spacing:-.02em">${hero.name}</div>
          <button class="tier-preview-close" onclick="closeTierPreview()" style="flex-shrink:0;margin-top:2px">×</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          ${roleIcon(hero.role,18)}
          <span style="font-family:var(--mono);font-size:12px;color:${rc[hero.role]||'var(--text2)'};text-transform:uppercase;font-weight:700">${hero.role}</span>
          ${hero.subrole?`<span style="color:var(--border2)">·</span>${subroleIcon(hero.role,hero.subrole,16)}<span style="font-family:var(--mono);font-size:12px;color:var(--text2);text-transform:uppercase">${hero.subrole}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:3px;margin-bottom:8px">
          ${Array.from({length:10},(_,k)=>`<span style="font-size:13px;color:${k<hero.priority?'var(--accent)':'var(--border2)'}">◆</span>`).join('')}
          <span style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:5px">${hero.priority}/10</span>
        </div>
        ${hero.banned?'<div style="font-family:var(--mono);font-size:10px;background:rgba(224,85,85,.15);color:var(--damage);border-radius:5px;padding:3px 9px;display:inline-block">В текущем бане</div>':''}
      </div>
    </div>
    ${synSection}
    <div style="margin-bottom:16px">
      <div class="tier-preview-section-title" style="font-size:12px;margin-bottom:8px">Сила на картах</div>
      ${mapsHtml}
    </div>
    ${countersSection}
    ${hero.notes?`<div style="font-size:13px;color:var(--text2);line-height:1.7;margin-top:4px">${hero.notes}</div>`:''}`;

  const actions=`<button class="btn" onclick="closeTierPreview();openHeroModal(heroes.find(h=>h.name==='${esc(hero.name)}'))">✎ Редактировать</button>`;
  // Используем широкий класс
  _openHeroTierPreview(hero.name, body, actions);
}

function _toggleHeroInfoExpand(name){
  _heroInfoExpanded=!_heroInfoExpanded;
  closeTierPreview();
  _buildHeroInfoPopup(name);
}

// Открываем попап в увеличенном варианте
function _openHeroTierPreview(title, body, actions){
  document.getElementById('tierPreviewOverlay')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="tier-preview-overlay" id="tierPreviewOverlay" onclick="if(event.target.id==='tierPreviewOverlay')closeTierPreview()">
    <div class="tier-preview-box hero-preview-box">
      <div class="tier-preview-head" style="display:none"></div>
      <div class="tier-preview-body">${body}</div>
      ${actions?`<div class="tier-preview-actions">${actions}</div>`:''}
    </div>
  </div>`);
}
