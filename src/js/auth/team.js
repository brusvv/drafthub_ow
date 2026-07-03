// @hash 0056805c 2026-07-03T08:51
// ════ AUTH — TEAM & ROLES ════
// Управление командами, участниками, ролями, инвайтами.
// Новая схема: user_roles, roles, role_permissions, permissions
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete),
//              session.js (currentUser, currentTeam, canManageRoles, canManageInvites)

// ── Загрузка команд пользователя ─────────────────────────────
async function loadUserTeams() {
  const { data, error } = await _sb.from('user_roles')
    .select('teams(id, name, slug, description), roles(key, label)')
    .eq('user_id', currentUser().id)
    .not('team_id', 'is', null);  // исключаем глобальные роли (superadmin/admin)
  if(error) throw error;
  return (data || []).map(r => ({ ...r.teams, role: r.roles }));
}

// ── Создание команды ──────────────────────────────────────────
// SECURITY DEFINER RPC — атомарно создаёт команду, роли и добавляет создателя как manager
async function createTeam(name, description = '') {
  if(!name?.trim()) { toast('Укажи название команды', 'err'); return null; }
  try {
    const { data, error } = await _sb.rpc('create_team', {
      p_name: name.trim(),
      p_description: description,
    });
    if(error) throw error;
    const team = typeof data === 'string' ? JSON.parse(data) : data;
    toast(`Команда "${team.name}" создана ✓`, 'ok');
    await switchTeam(team.id);
    return team;
  } catch(e) {
    handleError(e, e.message?.includes('23505') ? 'Команда с таким именем уже существует' : '');
    return null;
  }
}

// ════ ROLES — управление ════

// Все роли команды, включая их права
// Два запроса вместо трёхуровневого JOIN (role_permissions→permissions)
// который ненадёжно работает в PostgREST
async function loadTeamRoles() {
  const { data: roles, error } = await _sb.from('roles')
    .select('id, key, label, is_system, max_per_team, sort_order')
    .eq('team_id', currentTeam().id)
    .order('sort_order');
  if(error) throw error;
  if(!roles?.length) return [];

  // Загружаем права для всех ролей одним запросом
  const roleIds = roles.map(r => r.id);
  const { data: rpRows, error: rpErr } = await _sb.from('role_permissions')
    .select('role_id, permissions(key, label)')
    .in('role_id', roleIds);
  if(rpErr) throw rpErr;

  // Группируем права по role_id
  const permsByRole = {};
  (rpRows || []).forEach(rp => {
    if(!permsByRole[rp.role_id]) permsByRole[rp.role_id] = [];
    if(rp.permissions) permsByRole[rp.role_id].push(rp.permissions);
  });

  return roles.map(r => ({
    ...r,
    permKeys: new Set((permsByRole[r.id] || []).map(p => p.key)),
    permList: permsByRole[r.id] || [],
  }));
}

// Все доступные права (справочник)
async function loadPermissions() {
  const { data, error } = await _sb.from('permissions').select('*').order('category');
  if(error) throw error;
  return data || [];
}

// Создать кастомную роль
// DEDUPE-1: было продублировано почти дословно в createCustomRole() и
// updateRolePermissions() (разница только role.id/roleId) — резолв ключей
// прав в id + insert в role_permissions. Общий хелпер, вызывающий код сам
// решает нужно ли предварительно делать DELETE (updateRolePermissions делает,
// createCustomRole — нет, роль только что создана, старых прав быть не может).
async function _assignRolePermissions(roleId, permissionKeys){
  if(!permissionKeys.length) return;
  const { data: perms } = await _sb.from('permissions')
    .select('id').in('key', permissionKeys);
  if(perms?.length){
    await _sb.from('role_permissions').insert(
      perms.map(p => ({ role_id: roleId, permission_id: p.id }))
    );
  }
}

async function createCustomRole({ label, permissionKeys = [] }) {
  if(!canManageRoles()) { toast('Нет прав на управление ролями', 'err'); return null; }
  const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20) + '_' + Date.now().toString(36).slice(-4);
  try {
    // Создаём роль
    const role = await dbInsert('roles', {
      team_id: currentTeam().id,
      key, label: label.trim(),
      is_system: false,
      sort_order: 99,
    });
    await _assignRolePermissions(role.id, permissionKeys);
    toast(`Роль "${role.label}" создана ✓`, 'ok');
    return role;
  } catch(e) { handleError(e); return null; }
}

// Обновить права роли — заменяем весь набор целиком
async function updateRolePermissions(roleId, permissionKeys = []) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  try {
    // Удаляем старые права
    await _sb.from('role_permissions').delete().eq('role_id', roleId);
    await _assignRolePermissions(roleId, permissionKeys);
    toast('Права обновлены ✓', 'ok');
    renderRolesAdminPanel();
  } catch(e) { handleError(e); }
}

async function deleteCustomRole(roleId) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  // Проверяем что роль не назначена никому
  const { count } = await _sb.from('user_roles')
    .select('id', { count:'exact', head:true }).eq('role_id', roleId);
  if(count > 0) { toast(`Роль назначена ${count} участникам — сначала смени им роль`, 'err'); return; }

  if(!confirm('Удалить роль?')) return;
  try { await dbDelete('roles', roleId); toast('Роль удалена', 'ok'); renderRolesAdminPanel(); }
  catch(e) { handleError(e); }
}

// ════ MEMBERS ════
async function loadTeamMembers() {
  // user_roles.user_id → auth.users (не public) — прямой PostgREST join невозможен.
  // Используем RPC get_team_members (SECURITY DEFINER) которая читает auth.users напрямую.
  const { data, error } = await _sb.rpc('get_team_members', { p_team_id: currentTeam().id });
  if(error) throw error;
  return data || [];
}

async function setMemberRole(userRoleId, newRoleId) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  // Не даём оставить команду без менеджера
  const members  = await loadTeamMembers();
  const managers = members.filter(m => m.roles?.key === 'manager');
  const target   = members.find(m => m.id === userRoleId);
  const newRole  = (await loadTeamRoles()).find(r => r.id === newRoleId);
  if(target?.roles?.key === 'manager' && newRole?.key !== 'manager' && managers.length === 1) {
    toast('Нельзя оставить команду без менеджера', 'err'); return;
  }

  await dbUpdate('user_roles', userRoleId, { role_id: newRoleId });
  toast('Роль обновлена ✓', 'ok');
  renderTeamSettingsPanel();
}

async function removeMember(userRoleId, userId) {
  if(!canManageRoles() && userId !== currentUser().id) { toast('Нет прав', 'err'); return; }
  if(!confirm('Удалить участника из команды?')) return;
  await dbDelete('user_roles', userRoleId);
  toast('Участник удалён', 'ok');
  if(userId === currentUser().id) {
    _currentTeam = null;
    const teams = await loadUserTeams();
    if(teams.length) await switchTeam(teams[0].id);
    else renderAuthUI('no-teams');
  } else renderTeamSettingsPanel();
}

// ════ INVITES ════
async function createInvite({ roleId, maxUses = null, expiresInDays = 7 }) {
  if(!canManageInvites()) { toast('Нет прав на создание инвайта', 'err'); return null; }
  const { data, error } = await _sb.rpc('create_invite_link', {
    p_team_id: currentTeam().id,
    p_role_id: roleId,
    p_max_uses: maxUses,
    p_expires_in_days: expiresInDays,
  });
  if(error) { handleError(error, 'Ошибка создания инвайта'); return null; }

  // RPC возвращает токен напрямую как text
  const token = typeof data === 'string' ? data : data?.token;
  const link = `${window.location.origin}${BASE_PATH}/join/${token}`;
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована ✓', 'ok'); }
  catch { toast(link, 'ok'); }
  return link;
}

async function loadTeamInvites() {
  const { data, error } = await _sb.from('team_invites')
    .select('id, token, max_uses, uses, expires_at, created_at, roles(label)')
    .eq('team_id', currentTeam().id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending:false });
  if(error) throw error;
  return data || [];
}

async function deleteInvite(inviteId) {
  if(!canManageInvites()) { toast('Нет прав', 'err'); return; }
  await dbDelete('team_invites', inviteId);
  toast('Инвайт удалён', 'ok');
  renderTeamSettingsPanel();
}

async function updateTeamSettings(name, description) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  const trimmed = name?.trim();
  if(!trimmed) { toast('Укажи название команды', 'err'); return; }
  const { data, error } = await _sb.rpc('rename_team', {
    p_team_id: currentTeam().id,
    p_name:    trimmed,
  });
  if(error || !data?.ok) { handleError(error || new Error(data?.error)); return; }
  _currentTeam = { ..._currentTeam, name: trimmed };
  document.getElementById('headerTeamName').textContent = trimmed;
  toast('Название команды обновлено ✓', 'ok');
  renderTeamSettingsPanel();
}

function renderTeamSettingsPanel(){ renderTeamSettings?.(); }
function renderRolesAdminPanel(){ renderTeamSettings?.(); }
