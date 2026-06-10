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
 
// ════ NAV ════
function showView(v,btn){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  if(btn)btn.classList.add('active');
  renderCurrentView();
}
 
function showLoading(id){const el=document.getElementById(id);if(el)el.innerHTML='<div class="loading-state"><div class="spinner"></div><br>Загрузка...</div>'}
function showError(id,msg){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="error-state">⚠ ${msg}</div>`}
let toastT;
function toast(msg,type='ok'){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3000)}
function esc(s){return(s||'').replace(/'/g,"\\'")}
 
if(!getClientId())document.getElementById('authConfigBanner').style.display='block';
 
