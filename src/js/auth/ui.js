// ════ AUTH — UI ════
// Рендер форм входа, выбора команды, настроек + админка ролей.
// Новая схема: roles, role_permissions, permissions, user_roles
//
// Зависимости: session.js, team.js

function renderAuthUI(state) {
  const authScreen = document.getElementById('authScreen');
  const appEl      = document.getElementById('app');
  if(!authScreen || !appEl) return;

  if(state === 'app') {
    // Возврат из публичного режима (Фаза 3) — снимаем класс,
    // который прячет Настройки/Sync/Выйти и т.д. (см. base.css)
    document.body.classList.remove('public-mode');
    authScreen.style.display = 'none';
    appEl.style.display = '';
    _renderHeader();
    return;
  }
  authScreen.style.display = '';
  appEl.style.display = 'none';
  if(state === 'login')    authScreen.innerHTML = _renderLoginForm();
  if(state === 'register') authScreen.innerHTML = _renderRegisterForm();
  if(state === 'no-teams') authScreen.innerHTML = _renderNoTeams();
}

// ── Формы входа/регистрации/no-teams — без изменений от прошлой версии ──
function _renderLoginForm() {
  return `
  <div class="auth-screen">
    <div class="auth-logo">Draft Hub<div class="auth-sub">Team Analyst</div></div>
    <div class="auth-card">
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <button class="oauth-btn discord" onclick="signInWithProvider('discord')">Войти через Discord</button>
        <button class="oauth-btn google" onclick="signInWithProvider('google')">Войти через Google</button>
      </div>
      <div class="auth-divider">или</div>
      <form onsubmit="event.preventDefault();_submitLogin()">
        <div class="form-group"><input class="form-input" id="loginEmail" type="email" placeholder="Email" required></div>
        <div class="form-group"><input class="form-input" id="loginPassword" type="password" placeholder="Пароль" required></div>
        <button type="submit" class="btn btn-primary" style="width:100%;padding:10px">Войти</button>
      </form>
      <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text3)">
        Нет аккаунта? <span class="link-btn" onclick="renderAuthUI('register')">Зарегистрироваться</span>
      </div>
    </div>
  </div>`;
}

function _renderRegisterForm() {
  return `
  <div class="auth-screen">
    <div class="auth-logo">Draft Hub</div>
    <div class="auth-card">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Создать аккаунт</div>
      <form onsubmit="event.preventDefault();_submitRegister()">
        <div class="form-group"><input class="form-input" id="regEmail" type="email" placeholder="Email" required></div>
        <div class="form-group"><input class="form-input" id="regPassword" type="password" placeholder="Пароль (мин. 8 символов)" minlength="8" required></div>
        <div class="form-group"><input class="form-input" id="regPassword2" type="password" placeholder="Повтори пароль" required></div>
        <button type="submit" class="btn btn-primary" style="width:100%;padding:10px">Создать аккаунт</button>
      </form>
      <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text3)">
        Уже есть аккаунт? <span class="link-btn" onclick="renderAuthUI('login')">Войти</span>
      </div>
    </div>
  </div>`;
}

function _renderNoTeams() {
  return `
  <div class="auth-screen">
    <div class="auth-logo">Draft Hub</div>
    <div class="auth-card">
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">Выбери команду</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">У тебя пока нет команд. Создай новую или попроси инвайт у тренера.</p>
      <button class="btn btn-primary" style="width:100%;padding:9px;margin-bottom:8px" onclick="_showCreateTeamForm()">+ Создать команду</button>
      <div id="createTeamForm" style="display:none;margin-top:12px">
        <form onsubmit="event.preventDefault();_submitCreateTeam()">
          <div class="form-group"><input class="form-input" id="newTeamName" placeholder="Название команды" required></div>
          <div class="form-group"><input class="form-input" id="newTeamDesc" placeholder="Описание (опционально)"></div>
          <button type="submit" class="btn btn-primary" style="width:100%;padding:9px">Создать</button>
        </form>
      </div>
      <button class="btn" style="width:100%;padding:9px;margin-top:6px" onclick="signOut()">Выйти</button>
    </div>
  </div>`;
}

function _renderHeader() {
  const team = currentTeam(); const role = currentRole(); const user = currentUser();
  const teamSel = document.getElementById('headerTeamName');
  const roleBdg = document.getElementById('headerRoleBadge');
  const userEl  = document.getElementById('userName');
  if(teamSel) teamSel.textContent = team?.name ?? '';
  if(roleBdg) {
    roleBdg.textContent = role?.label?.toUpperCase() ?? '';
    roleBdg.style.color = role?.key==='manager' ? 'var(--damage)'
      : role?.key==='coach'   ? 'var(--accent)'
      : role?.key==='captain' ? 'var(--support)'
      : role?.key==='player'  ? 'var(--text2)'
      : 'var(--text3)';
  }
  if(userEl) userEl.textContent = user?.email?.split('@')[0] ?? 'Пользователь';

  // Фаза 7: вкладка «Админ» — только для admin/superadmin (app_metadata),
  // независимо от роли в текущей команде.
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin() ? '' : 'none';
  });

  renderAppModeSwitcher();
}

async function renderTeamSwitcher() {
  if(!isLoggedIn()) return;   // публичный режим — переключателя команд нет
  const teams = await loadUserTeams();
  if(teams.length <= 1) return;
  const el = document.getElementById('teamSwitcherPopup'); if(!el) return;
  el.innerHTML = teams.map(t => `
    <div class="team-switcher-item${t.id===currentTeam()?.id?' active':''}" onclick="switchTeam('${t.id}')">
      <span>${t.name}</span><span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${t.role?.label||''}</span>
    </div>`).join('');
}

// ════ ПАНЕЛЬ НАСТРОЕК — участники + роли + инвайты ════
let _settingsTab = 'members'; // 'members' | 'roles' | 'invites' | 'sheets'

async function renderTeamSettings() {
  const el = document.getElementById('view-settings'); if(!el) return;
  const team = currentTeam();
  el.innerHTML = `
    <div style="max-width:680px">
      ${canManageRoles() ? `
      <div class="role-card" style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text2)">Настройки команды</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input" id="teamNameInput" value="${team?.name ?? ''}"
            placeholder="Название команды" style="flex:1;font-size:13px"
            onkeydown="if(event.key==='Enter')_submitRenameTeam()">
          <button class="btn btn-primary" onclick="_submitRenameTeam()" style="font-size:11px">Сохранить</button>
        </div>
      </div>` : ''}
      <div class="settings-tabs" style="display:flex;gap:6px;margin-bottom:16px">
        <button class="f-btn${_settingsTab==='members'?' active':''}" onclick="_switchSettingsTab('members')">Участники</button>
        ${canManageRoles()   ? `<button class="f-btn${_settingsTab==='roles'  ?' active':''}" onclick="_switchSettingsTab('roles')">Роли</button>`            : ''}
        ${canManageInvites() ? `<button class="f-btn${_settingsTab==='invites'?' active':''}" onclick="_switchSettingsTab('invites')">Инвайты</button>`        : ''}
        ${canExportSheets()  ? `<button class="f-btn${_settingsTab==='sheets' ?' active':''}" onclick="_switchSettingsTab('sheets')">Sheets экспорт</button>`  : ''}
      </div>
      <div id="settingsTabContent"></div>
    </div>`;
  await _renderSettingsTabContent();
}

function _switchSettingsTab(tab){ _settingsTab = tab; _renderSettingsTabContent(); }

async function _renderSettingsTabContent(){
  const el = document.getElementById('settingsTabContent'); if(!el) return;
  if(_settingsTab === 'members') return _renderMembersTab(el);
  if(_settingsTab === 'roles')   return _renderRolesTab(el);
  if(_settingsTab === 'invites') return _renderInvitesTab(el);
  if(_settingsTab === 'sheets')  { el.innerHTML = '<div id="sheetsExportPanel"></div>'; return renderSheetsExportPanel(); }
}

// ── Участники ──
async function _renderMembersTab(el){
  const [members, roles] = await Promise.all([loadTeamMembers(), loadTeamRoles()]);
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${members.map(m => {
        const name  = m.users?.raw_user_meta_data?.full_name ?? m.users?.email ?? '—';
        const email = m.users?.email ?? '';
        const isSelf= m.users?.id === currentUser()?.id;
        const roleLabel = m.roles?.label || '—';
        return `<div class="member-row">
          <div class="member-av">${name[0]?.toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${name}${isSelf?' (вы)':''}</div>
            <div style="font-size:11px;color:var(--text3)">${email}</div>
          </div>
          ${canManageRoles() && !isSelf ? `
            <select class="form-select" style="width:130px;font-size:11px" onchange="setMemberRole('${m.id}',this.value)">
              ${roles.map(r=>`<option value="${r.id}"${r.id===m.role_id?' selected':''}>${r.label}</option>`).join('')}
            </select>
            <button class="btn btn-danger" style="font-size:10px;padding:3px 8px" onclick="removeMember('${m.id}','${m.users?.id}')">✕</button>
          ` : `<span class="role-tag" style="font-size:10px">${roleLabel}</span>`}
        </div>`;
      }).join('')}
    </div>`;
}

// ── Роли (админка) ──
async function _renderRolesTab(el){
  const [roles, allPerms] = await Promise.all([loadTeamRoles(), loadPermissions()]);
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      ${roles.map(r => `
        <div class="role-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:13px;font-weight:700">${r.label}</span>
              ${r.is_system?'<span class="role-tag" style="font-size:9px">встроенная</span>':''}
            </div>
            ${!r.is_system?`<button class="btn btn-danger" style="font-size:9px;padding:3px 8px" onclick="deleteCustomRole('${r.id}')">Удалить</button>`:''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${allPerms.map(p => `
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);
                ${r.is_system?'opacity:.5;cursor:not-allowed':'cursor:pointer'}">
                <input type="checkbox" data-perm="${p.key}" ${r.permKeys.has(p.key)?'checked':''} ${r.is_system?'disabled':''}
                  onchange="_toggleRolePerm('${r.id}',this)">
                ${p.label}
              </label>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <button class="btn btn-primary" onclick="_showCreateRoleForm()" style="font-size:11px">+ Создать роль</button>
    <div id="createRoleForm" style="display:none;margin-top:12px" class="role-card">
      <div class="form-group"><input class="form-input" id="newRoleLabel" placeholder="Название роли (напр. Аналитик)"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${allPerms.map(p=>`
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
            <input type="checkbox" name="newRolePerm" value="${p.key}">
            ${p.label}
          </label>`).join('')}
      </div>
      <button class="btn btn-primary" style="font-size:11px" onclick="_submitCreateRole()">Создать</button>
    </div>`;
}

// Переключение одного права у существующей роли — читаем permission key
// прямо из data-perm на чекбоксе и пересохраняем весь набор прав роли
async function _toggleRolePerm(roleId, checkbox){
  const permKey = checkbox.dataset.perm;
  if(!permKey) return;
  const roles = await loadTeamRoles();
  const role  = roles.find(r => r.id === roleId);
  if(!role) return;

  const perms = new Set(role.permKeys);
  if(checkbox.checked) perms.add(permKey);
  else perms.delete(permKey);

  await updateRolePermissions(roleId, [...perms]);
}

function _showCreateRoleForm(){
  const el = document.getElementById('createRoleForm');
  if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
}

async function _submitCreateRole(){
  const label = document.getElementById('newRoleLabel')?.value;
  if(!label?.trim()) { toast('Укажи название роли', 'err'); return; }
  const checkedPerms = [...document.querySelectorAll('[name="newRolePerm"]:checked')].map(cb => cb.value);
  await createCustomRole({ label, permissionKeys: checkedPerms });
  document.getElementById('newRoleLabel').value = '';
  _renderSettingsTabContent();
}

// ── Инвайты ──
async function _renderInvitesTab(el){
  const [invites, roles] = await Promise.all([loadTeamInvites(), loadTeamRoles()]);
  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <select class="form-select" id="inviteRoleSelect" style="width:160px;font-size:11px">
        ${roles.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}
      </select>
      <button class="btn btn-primary" style="font-size:11px" onclick="_submitCreateInvite()">+ Создать инвайт</button>
    </div>
    ${invites.length ? `
      <div style="display:flex;flex-direction:column;gap:5px">
        ${invites.map(inv => `
          <div class="member-row" style="gap:6px;font-size:11px">
            <code style="font-family:var(--mono);font-size:10px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">/join/${inv.token}</code>
            <span style="color:var(--text3)">${inv.roles?.label||''}</span>
            <span style="color:var(--text3)">${inv.uses}${inv.max_uses?'/'+inv.max_uses:''}</span>
            <button class="btn btn-danger" style="font-size:9px;padding:2px 6px" onclick="deleteInvite('${inv.id}')">✕</button>
          </div>`).join('')}
      </div>` : '<div class="empty">Нет активных инвайтов</div>'}`;
}

async function _submitCreateInvite(){
  const roleId = document.getElementById('inviteRoleSelect')?.value;
  if(!roleId) return;
  await createInvite({ roleId });
  _renderSettingsTabContent();
}

// ── Обработчики форм входа/регистрации/команды ──
async function _submitLogin() {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  if(!email || !password) return;
  await signInWithEmail(email, password);
}
async function _submitRegister() {
  const email = document.getElementById('regEmail')?.value;
  const p1 = document.getElementById('regPassword')?.value;
  const p2 = document.getElementById('regPassword2')?.value;
  if(p1 !== p2) { toast('Пароли не совпадают', 'err'); return; }
  await signUpWithEmail(email, p1);
}
async function _submitCreateTeam() {
  const name = document.getElementById('newTeamName')?.value;
  const desc = document.getElementById('newTeamDesc')?.value;
  await createTeam(name, desc);
}
function _showCreateTeamForm() {
  const el = document.getElementById('createTeamForm');
  if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
}

async function _submitRenameTeam() {
  const name = document.getElementById('teamNameInput')?.value;
  await updateTeamSettings(name);
}
