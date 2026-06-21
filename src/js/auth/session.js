// @hash 0e2e48da 2026-06-21T12:51
// ════ AUTH — SESSION ════
// Управляет сессией пользователя, активной командой и её правами.
// Новая схема: user_roles → roles → role_permissions → permissions
// Также обрабатывает /tier/TOKEN (просмотр публичных тир-листов БЕЗ авторизации)
// и /join/TOKEN (принятие инвайта ПОСЛЕ авторизации).
//
// _currentTeam = { id, name, slug, role:{key,label,sort_order}, permissions:Set<string> }
//
// Зависимости: auth.js (_sb), team.js (loadUserTeams),
//              render-tiers.js (handleSharedTierUrl)

let _session     = null;   // Supabase Session | null
let _currentTeam = null;   // см. форму выше | null

const currentUser = () => _session?.user ?? null;
const currentTeam = () => _currentTeam;
const isLoggedIn  = () => !!_session;

const currentRole      = () => _currentTeam?.role ?? null;
const currentRoleLabel = () => _currentTeam?.role?.label ?? '';

// Проверка прав через Set<string> permissions
const _hasPerm = (key) => !!_currentTeam?.permissions?.has(key);

const canWrite          = () => _hasPerm('write_data');
const canReadGameData    = () => _hasPerm('read_game_data');
const canReadRoster       = () => _hasPerm('read_roster');
const canManageRoles      = () => _hasPerm('manage_roles');
const canManageInvites    = () => _hasPerm('manage_invites');
const canExportSheets     = () => _hasPerm('export_sheets');
const canDeleteTeam       = () => _hasPerm('delete_team');
const isViewer            = () => !canReadGameData() && !canReadRoster();

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
        history.replaceState({}, '', '/drafthub_ow/');
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
  // Загружаем команду + роль + права через один вложенный select
  // (roles встречается ОДИН раз — нельзя делать два отдельных roles(...)
  // в одном select, PostgREST это не поддерживает)
  const { data, error } = await _sb.from('user_roles')
    .select(`
      teams(id, name, slug),
      roles(id, key, label, sort_order, role_permissions(permissions(key)))
    `)
    .eq('team_id', teamId)
    .eq('user_id', currentUser().id)
    .single();
  if(error || !data) { toast('Команда не найдена', 'err'); return; }

  // Собираем Set прав из role_permissions → permissions
  const permKeys = (data.roles?.role_permissions || [])
    .map(rp => rp.permissions?.key)
    .filter(Boolean);

  _currentTeam = {
    id: data.teams.id, name: data.teams.name, slug: data.teams.slug,
    role: { key: data.roles.key, label: data.roles.label, sort_order: data.roles.sort_order },
    permissions: new Set(permKeys),
  };
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
