// @hash 9d571e75 2026-06-23T10:40
// ════ RENDER — ADMIN (Фаза 7) ════
// Глобальная админ-панель: список команд, пользователи + назначение
// глобальных ролей, ссылка на редактирование глобального тир-листа.
//
// Сам редактор глобального тир-листа — НЕ отдельный UI, а обычная
// вкладка Tier List в режиме «Глобальный»: saveTierOrder() уже пишет
// в global_tier_data при tierViewMode==='global' (db-write.js),
// а _canEditCurrentTier() уже разрешает это только isSuperAdmin()
// (см. render-tiers.js). Здесь только команды + пользователи/роли.
//
// Вкладка видна при isAdmin() (см. auth/ui.js _renderHeader →
// .admin-only). Назначение ролей (set_app_role RPC) — только
// isSuperAdmin(), на уровне и UI, и базы (002/006 SQL).
//
// Зависимости: session.js (isAdmin, isSuperAdmin), auth.js (_sb),
//              render-nav.js (toast, esc), render-tiers.js (switchTierMode)

let _adminTab = 'teams'; // 'teams' | 'users' | 'tiers'

async function renderAdmin(){
  const el = document.getElementById('view-admin'); if(!el) return;
  if(!isAdmin()){
    el.innerHTML = '<div class="empty">Нет доступа</div>';
    return;
  }
  el.innerHTML = `
    <div style="max-width:760px">
      <div class="settings-tabs" style="display:flex;gap:6px;margin-bottom:16px">
        <button class="f-btn${_adminTab==='teams'?' active':''}" onclick="_switchAdminTab('teams')">Команды</button>
        <button class="f-btn${_adminTab==='users'?' active':''}" onclick="_switchAdminTab('users')">Пользователи</button>
        <button class="f-btn${_adminTab==='tiers'?' active':''}" onclick="_switchAdminTab('tiers')">Глобальный тир-лист</button>
      </div>
      <div id="adminTabContent"></div>
    </div>`;
  await _renderAdminTabContent();
}

function _switchAdminTab(tab){ _adminTab = tab; _renderAdminTabContent(); }

async function _renderAdminTabContent(){
  const el = document.getElementById('adminTabContent'); if(!el) return;
  if(_adminTab === 'teams') return _renderAdminTeamsTab(el);
  if(_adminTab === 'users') return _renderAdminUsersTab(el);
  if(_adminTab === 'tiers') return _renderAdminTiersTab(el);
}

// ── Команды — admin/superadmin видят все через RLS (teams: members read) ──
async function _renderAdminTeamsTab(el){
  el.innerHTML = '<div class="empty">Загрузка...</div>';
  const { data, error } = await _sb.from('teams')
    .select('id, name, slug, description, created_at')
    .order('created_at', { ascending:false });
  if(error){ el.innerHTML = `<div class="error-state">⚠ ${error.message}</div>`; return; }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${(data||[]).map(t => `
        <div class="member-row">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${esc(t.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${esc(t.slug || '')}${t.description ? ' · ' + esc(t.description) : ''}</div>
          </div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${new Date(t.created_at).toLocaleDateString('ru-RU')}</span>
        </div>`).join('') || '<div class="empty">Команд пока нет</div>'}
    </div>`;
}

// ── Пользователи / глобальные роли ──
async function _renderAdminUsersTab(el){
  el.innerHTML = '<div class="empty">Загрузка...</div>';
  const { data, error } = await _sb.rpc('list_app_users');
  if(error){ el.innerHTML = `<div class="error-state">⚠ ${error.message}</div>`; return; }

  const canAssign = isSuperAdmin();
  el.innerHTML = `
    ${!canAssign
      ? `<div class="admin-warning">Назначать роли может только superadmin — у тебя доступ только на просмотр.</div>`
      : `<div class="admin-warning">Изменение применится у пользователя после обновления токена (обычно в течение часа) или повторного входа — не сразу.</div>`}
    <div style="display:flex;flex-direction:column;gap:6px">
      ${(data||[]).map(u => `
        <div class="member-row">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${esc(u.email || '—')}</div>
            <div style="font-size:11px;color:var(--text3)">с ${new Date(u.created_at).toLocaleDateString('ru-RU')}${u.last_sign_in_at ? ' · был(а) ' + new Date(u.last_sign_in_at).toLocaleDateString('ru-RU') : ''}</div>
          </div>
          ${canAssign ? `
            <select class="form-select" style="width:140px;font-size:11px" onchange="_setUserAppRole('${u.id}',this.value)">
              <option value=""${!u.app_role?' selected':''}>— нет —</option>
              <option value="admin"${u.app_role==='admin'?' selected':''}>Admin</option>
              <option value="superadmin"${u.app_role==='superadmin'?' selected':''}>Superadmin</option>
            </select>
          ` : `<span class="role-tag" style="font-size:10px">${esc(u.app_role || '—')}</span>`}
        </div>`).join('') || '<div class="empty">Пользователей нет</div>'}
    </div>`;
}

async function _setUserAppRole(userId, role){
  if(!confirm(role ? `Назначить роль "${role}"?` : 'Снять глобальную роль?')) { _renderAdminTabContent(); return; }
  try {
    const { error } = await _sb.rpc('set_app_role', { p_user_id: userId, p_role: role || null });
    if(error) throw error;
    toast('Роль обновлена ✓', 'ok');
  } catch(e) {
    toast('Ошибка: ' + e.message, 'err');
  }
  _renderAdminTabContent();
}

// ── Глобальный тир-лист — переход на существующую вкладку Tier List ──
function _renderAdminTiersTab(el){
  el.innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;max-width:480px">
      Глобальный тир-лист редактируется прямо во вкладке <b>Tier List</b> —
      переключи режим на «🌐 Глобальный»: если ты superadmin, перетаскивание
      карт/героев между тирами сохраняется в <code>global_tier_data</code>
      и сразу видно всем пользователям и анонимным посетителям.
    </div>
    <button class="btn btn-primary" onclick="_goToGlobalTierList()">Открыть Tier List → Глобальный</button>`;
}

function _goToGlobalTierList(){
  showView('tiers', document.getElementById('navTiersBtn'));
  switchTierMode('global');
}
