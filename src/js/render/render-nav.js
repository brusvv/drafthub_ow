// @hash 5d0dbf78 2026-06-14T08:30

// ── Store proxies ──
Object.defineProperties(window, {
  toastT: { get(){ return store.get('toastT'); }, set(v){ store.set('toastT',v); }, configurable:true },
});
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
// [store] toastT → store.state
function toast(msg,type='ok'){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3000)}
function esc(s){return(s||'').replace(/'/g,"\\'")}
 
if(!getClientId())document.getElementById('authConfigBanner').style.display='block';
 
