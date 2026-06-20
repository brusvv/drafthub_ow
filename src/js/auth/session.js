// @hash 2256366d 2026-06-20T14:11
// ════ AUTH — SESSION ════
// Управляет сессией пользователя, активной командой и её правами.
// Также обрабатывает /tier/TOKEN (просмотр публичных тир-листов БЕЗ авторизации)
// и /join/TOKEN (принятие инвайта ПОСЛЕ авторизации).
//
// Зависимости: auth.js (_sb), team.js (loadUserTeams),
//              render-tiers.js (handleSharedTierUrl)

let _session     = null;   // Supabase Session | null
let _currentTeam = null;   // { id, name, slug, role:{key,label,...permissions} } | null

const currentUser = () => _session?.user ?? null;
const currentTeam = () => _currentTeam;
const isLoggedIn  = () => !!_session;

const currentRole       = () => _currentTeam?.role ?? null;
const currentRoleLabel  = () => _currentTeam?.role?.label ?? '';
const canWrite          = () => !!_currentTeam?.role?.can_write_data;
const canReadGameData   = () => !!_currentTeam?.role?.can_read_game_data;
const canReadRoster     = () => !!_currentTeam?.role?.can_read_roster;
const canManageRoles    = () => !!_currentTeam?.role?.can_manage_roles;
const canManageInvites  = () => !!_currentTeam?.role?.can_manage_invites;
const canExportSheets   = () => !!_currentTeam?.role?.can_export_sheets;
const canDeleteTeam     = () => !!_currentTeam?.role?.can_delete_team;
const isViewer          = () => !canReadGameData() && !canReadRoster();

// ── Инициализация ─────────────────────────────────────────────
async function initSession() {
  // Сначала проверяем публичную share-ссылку — она может быть открыта
  // человеком без аккаунта вообще (если is_public=true)
  const isSharedTierUrl = window.location.pathname.startsWith('/tier/');
  if(isSharedTierUrl){
    const handled = await handleSharedTierUrl();
    if(handled) return;   // страница уже отрендерена как read-only
  }

  const joinToken = _extractJoinToken();
  const { data: { session } } = await _sb.auth.getSession();
  _session = session;

  _sb.auth.onAuthStateChange(async (event, newSession) => {
    _session = newSession;
    if(event === 'SIGNED_IN')  await _onSignIn(joinToken);
    if(event === 'SIGNED_OUT') _onSignOut();
  });

  if(_session) await _onSignIn(joinToken);
  else _onSignOut();
}

async function _onSignIn(joinToken) {
  if(joinToken) {
    try {
      const { data, error } = await _sb.rpc('accept_invite', { p_token: joinToken });
      if(error) throw error;
      if(data?.ok) {
        toast(`Добавлен в команду как ${data.role} ✓`, 'ok');
        history.replaceState({}, '', '/');
      } else {
        toast(data?.error === 'invalid_or_expired' ? 'Инвайт недействителен или истёк' : 'Ошибка инвайта', 'err');
      }
    } catch(e) { toast('Ошибка инвайта: ' + e.message, 'err'); }
  }

  const teams = await loadUserTeams();
  if(!teams.length) { _currentTeam = null; renderAuthUI('no-teams'); return; }

  const lastTeamId = localStorage.getItem('draft_active_team');
  const preferred  = teams.find(t => t.id === lastTeamId) ?? teams[0];
  await switchTeam(preferred.id);

  // Если был отложенный приватный share-токен — открываем его сейчас
  const pendingTierToken = sessionStorage.getItem('pending_tier_token');
  if(pendingTierToken){
    sessionStorage.removeItem('pending_tier_token');
    await handleSharedTierUrl(pendingTierToken);
  }
}

function _onSignOut() {
  _session = null; _currentTeam = null;
  renderAuthUI('login');
}

// ── Переключение активной команды ────────────────────────────
async function switchTeam(teamId) {
  const { data, error } = await _sb.from('team_members')
    .select('teams(id, name, slug), team_roles(key, label, can_read_game_data, can_read_roster, can_write_data, can_manage_roles, can_manage_invites, can_export_sheets, can_delete_team, is_hidden)')
    .eq('team_id', teamId).eq('user_id', currentUser().id).single();
  if(error || !data) { toast('Команда не найдена', 'err'); return; }

  _currentTeam = { id: data.teams.id, name: data.teams.name, slug: data.teams.slug, role: data.team_roles };
  localStorage.setItem('draft_active_team', teamId);

  await loadAllData();
  renderAuthUI('app');
  renderCurrentView();
}

// ── OAuth / email вход ──────────────────────────────────────
async function signInWithProvider(provider) {
  const { error } = await _sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + '/drafthub_ow/', scopes: provider === 'discord' ? 'identify email guilds' : undefined },
  });
  if(error) toast('Ошибка входа: ' + error.message, 'err');
}

async function signInWithEmail(email, password) {
  const { error } = await _sb.auth.signInWithPassword({ email, password });
  if(error) toast('Ошибка входа: ' + error.message, 'err');
}

async function signUpWithEmail(email, password) {
  const { error } = await _sb.auth.signUp({ email, password, options:{ emailRedirectTo: window.location.origin + '/drafthub_ow/' } });
  if(error) toast('Ошибка регистрации: ' + error.message, 'err');
  else toast('Письмо с подтверждением отправлено', 'ok');
}

async function signOut() { await _sb.auth.signOut(); }

function _extractJoinToken() {
  const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9_=-]{10,})$/);
  return match ? match[1] : null;
}

// ── Автозапуск при загрузке страницы ──
document.addEventListener('DOMContentLoaded', initSession);
