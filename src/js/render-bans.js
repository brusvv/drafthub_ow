// ════ BANS — по ролям ════
function renderBans(){
  const bg=document.getElementById('bansGrid');
  const banned=heroes.filter(h=>h.banned);
  const highCounters=heroes.filter(h=>!h.banned&&h.counters&&h.counters.some(c=>c.score>=8));

  function buildRoleGroups(heroList,chipStyle){
    const byRole={Tank:[],Damage:[],Support:[]};
    heroList.forEach(h=>{if(byRole[h.role])byRole[h.role].push(h)});
    return['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
      <div class="ban-role-group">
        <div class="ban-role-header">
          ${roleIcon(r,14)}
          <span class="ban-role-title" style="color:${rc[r]}">${r}</span>
        </div>
        <div class="ban-role-heroes">
          ${byRole[r].map(h=>{const src=portrait(h.name);return`<div class="ban-chip" style="${chipStyle||''}">
            ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-chip-ph">${h.name[0]}</div>`}
            <span class="ban-chip-name">${h.name}</span>
          </div>`;}).join('')}
        </div>
      </div>`).join('');
  }
 
  let html='';
  if(banned.length){
    html+=`<div style="margin-bottom:1.5rem">
      <div class="section-lbl" style="margin-bottom:.75rem">Текущие баны команды</div>
      ${buildRoleGroups(banned,'')}
    </div>`;
  }
  if(highCounters.length){
    html+=`<div>
      <div class="section-lbl" style="margin-bottom:.75rem">Рекомендуется к бану (контрпики ≥8)</div>
      ${buildRoleGroups(highCounters,'background:rgba(240,160,48,.06);border-color:rgba(240,160,48,.25)')}
    </div>`;
  }
  bg.innerHTML=html||'<div class="empty">Нет активных банов и контрпиков</div>';
}
