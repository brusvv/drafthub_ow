// @hash 4f0dba03 2026-06-20T08:48
// ════ AUTH — TEAM & ROLES ════
// Управление командами, инвайтами и кастомными ролями.
// Зависимости: auth.js (_sb), session.js (currentUser, currentTeam, canManageRoles)

// ── Загрузка команд пользователя ─────────────────────────────
async function loadUserTeams() {
  const { data, error } = await _sb.from('team_members')
    .select('teams(id, name, slug, description), team_roles(key, label)')
    .eq('user_id', currentUser().id);
  if(error) throw error;
  return (data || []).map(r => ({ ...r.teams, role: r.team_roles }));
}

// ── Создание команды ──────────────────────────────────────────
// Триггер БД (003_custom_roles.sql) автоматически создаёт 4 системные роли
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
    const msg = e.message?.includes('23505') ? 'Команда с таким именем уже существует' : e.message;
    toast('Ошибка: ' + msg, 'err');
    return null;
  }
}

// ════ ROLES — управление ════

// Все роли команды (для управления — включая скрытые, если есть право)
async function loadTeamRoles() {
  const { data, error } = await _sb.from('team_roles')
    .select('*').eq('team_id', currentTeam().id).order('sort_order');
  if(error) throw error;
  return data || [];
}

// Создать кастомную роль
async function createCustomRole({ label, permissions = {}, isHidden = false }) {
  if(!canManageRoles()) { toast('Нет прав на управление ролями', 'err'); return null; }
  const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20) + '_' + Date.now().toString(36).slice(-4);
  try {
    const role = await dbInsert('team_roles', {
      team_id: currentTeam().id,
      key, label: label.trim(),
      can_read_game_data: permissions.can_read_game_data ?? true,
      can_read_roster:    permissions.can_read_roster ?? true,
      can_write_data:      permissions.can_write_data ?? false,
      can_manage_roles:    permissions.can_manage_roles ?? false,
      can_manage_invites:  permissions.can_manage_invites ?? false,
      can_export_sheets:   permissions.can_export_sheets ?? false,
      can_delete_team:     false,             // кастомные роли никогда не могут удалить команду
      is_hidden: isHidden,
      is_system: false,
    });
    toast(`Роль "${role.label}" создана ✓`, 'ok');
    return role;
  } catch(e) { toast('Ошибка: ' + e.message, 'err'); return null; }
}

// Обновить права существующей кастомной роли (системные роли защищены RLS-политикой)
async function updateRolePermissions(roleId, permissions) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  try {
    await dbUpdate('team_roles', roleId, permissions);
    toast('Права обновлены ✓', 'ok');
    renderRolesAdminPanel();
  } catch(e) {
    const msg = e.message.includes('is_system') ? 'Системные роли нельзя менять' : e.message;
    toast('Ошибка: ' + msg, 'err');
  }
}

async function deleteCustomRole(roleId) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  // Проверяем что роль не назначена никому
  const { count } = await _sb.from('team_members')
    .select('id', { count:'exact', head:true }).eq('role_id', roleId);
  if(count > 0) { toast(`Роль назначена ${count} участникам — сначала смени им роль`, 'err'); return; }

  if(!confirm('Удалить роль?')) return;
  try { await dbDelete('team_roles', roleId); toast('Роль удалена', 'ok'); renderRolesAdminPanel(); }
  catch(e) { toast('Ошибка: ' + e.message, 'err'); }
}

// ════ MEMBERS ════
async function loadTeamMembers() {
  const { data, error } = await _sb.from('team_members')
    .select(`id, joined_at, role_id, team_roles(id,key,label,is_hidden), users:user_id(id,email,raw_user_meta_data)`)
    .eq('team_id', currentTeam().id).order('joined_at');
  if(error) throw error;
  return data || [];
}

async function setMemberRole(memberId, roleId) {
  if(!canManageRoles()) { toast('Нет прав', 'err'); return; }
  // Не даём оставить команду без управляющих ролью ролей (can_manage_roles)
  const members = await loadTeamMembers();
  const managers = members.filter(m => m.team_roles?.key === 'admin' || m.team_roles?.can_manage_roles);
  const target   = members.find(m => m.id === memberId);
  const newRole  = (await loadTeamRoles()).find(r => r.id === roleId);
  if(target?.team_roles?.key === 'admin' && !newRole?.can_manage_roles && managers.length === 1) {
    toast('Нельзя оставить команду без управляющей роли', 'err'); return;
  }

  await dbUpdate('team_members', memberId, { role_id: roleId });
  toast('Роль обновлена ✓', 'ok');
  renderTeamSettingsPanel();
}

async function removeMember(memberId, userId) {
  if(!canManageRoles() && userId !== currentUser().id) { toast('Нет прав', 'err'); return; }
  if(!confirm('Удалить участника из команды?')) return;
  await dbDelete('team_members', memberId);
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
  const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();
  const { data, error } = await _sb.from('team_invites')
    .insert({ team_id: currentTeam().id, role_id: roleId, max_uses: maxUses, expires_at: expiresAt, created_by: currentUser().id })
    .select('token').single();
  if(error) { toast('Ошибка создания инвайта', 'err'); return null; }

  const link = `${window.location.origin}/join/${data.token}`;
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована ✓', 'ok'); }
  catch { toast(link, 'ok'); }
  return link;
}

async function loadTeamInvites() {
  const { data, error } = await _sb.from('team_invites')
    .select('id, token, max_uses, uses, expires_at, created_at, team_roles(label)')
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
  await dbUpdate('teams', currentTeam().id, { name, description });
  _currentTeam = { ..._currentTeam, name };
  toast('Настройки сохранены ✓', 'ok');
  renderTeamSettingsPanel();
}

function renderTeamSettingsPanel(){ renderTeamSettings?.(); }
function renderRolesAdminPanel(){ renderTeamSettings?.(); }
