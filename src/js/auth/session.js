// @hash 192051ee 2026-07-05T20:16
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

// ── Глобальные роли (Фаза 7) ──────────────────────────────────
// Хранятся в auth.users.app_metadata.app_role — НЕ в user_roles,
// т.к. app_metadata нельзя подделать через клиентский SDK
// (см. supabase/002_roles_and_rls.sql, supabase/006_admin_roles.sql).
const _appRole     = () => currentUser()?.app_metadata?.app_role ?? null;
const isSuperAdmin = () => _appRole() === 'superadmin';
const isAdmin      = () => isSuperAdmin() || _appRole() === 'admin';

// ── Инициализация ─────────────────────────────────────────────
async function initSession() {
  // GitHub Pages 404.html (src/html/404.html) сохраняет оригинальный путь
  // в sessionStorage перед редиректом на index.html — восстанавливаем его
  // здесь, ДО любых проверок pathname, иначе /tier/ и /join/ ниже всегда
  // увидят BASE_PATH+'/' и ничего не сработает.
  const stashedPath = sessionStorage.getItem('gh_pages_redirect_path');
  if(stashedPath){
    sessionStorage.removeItem('gh_pages_redirect_path');
    history.replaceState({}, '', stashedPath);
  }

  // Сначала проверяем публичную share-ссылку — она может быть открыта
  // человеком без аккаунта вообще (если is_public=true)
  const isSharedTierUrl = window.location.pathname.startsWith(BASE_PATH + '/tier/');
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
        history.replaceState({}, '', BASE_PATH + '/');
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
  // BACK-3: отписываемся от командного tier_entries-канала — при следующем
  // switchTeam() (другого пользователя на этом же браузере, или того же
  // после повторного входа) подписка пересоздастся сама на актуальный id,
  // но висящий канал с УЖЕ невалидным контекстом сессии лучше не оставлять.
  if(typeof _unsubscribeTeamTierRealtime === 'function') _unsubscribeTeamTierRealtime();
  // AUD-3: сбрасываем то же самое что и при switchTeam() — иначе на общем
  // браузере пользователь A начинает турнирный драфт (banMode/draftState/
  // tournMapPool/tournHeroBans), выходит, и пока страница в публичном
  // режиме до следующего входа — стейт A всё ещё в памяти. switchTeam()
  // пользователя B сбросит его сам при входе, но не стоит полагаться на
  // это как на единственную точку сброса — signOut() такая же явная
  // граница смены контекста, как и переключение команды.
  _resetTeamSpecificState();
  // Незалогиненный видит глобальный тир-лист (публичный режим).
  // Форма входа появится только если пользователь нажмёт «Войти».
  renderPublicMode();
}

// ── Публичный режим — глобальный тир-лист без авторизации ────
const isPublicMode = () => !_session && document.getElementById('app')?.style.display !== 'none';

async function renderPublicMode() {
  const authScreen = document.getElementById('authScreen');
  const appEl      = document.getElementById('app');
  if(!authScreen || !appEl) return;

  // Класс на body — CSS прячет всё, что требует авторизации
  // (Настройки, Sync, Выйти, остальные вкладки) — см. base.css
  document.body.classList.add('public-mode');
  // POL-1: сбрасываем заголовок вкладки на дефолт — предыдущая команда
  // (если была) уже не активна.
  document.title = 'Draft Hub — Team Analyst';

  authScreen.style.display = 'none';
  appEl.style.display      = '';

  // Загружаем только то что доступно anon через RLS
  try {
    await Promise.all([loadPortraits(), loadMapScreenshots(), loadGlobalTiers()]);
  } catch(e) {
    console.warn('renderPublicMode: failed to load global data', e.message);
  }

  _applyTierMode('global');   // всегда показываем global, без team/personal
  showView('tiers', document.getElementById('navTiersBtn'));
  _renderPublicHeader();
}

function _renderPublicHeader() {
  const teamEl  = document.getElementById('headerTeamName_public');
  if(teamEl) teamEl.textContent = 'DraftHub OW';
  renderAppModeSwitcher();
}

// ── Переключение активной команды ────────────────────────────
async function switchTeam(teamId) {
  // Используем RPC вместо трёхуровневого PostgREST JOIN
  // (user_roles → roles → role_permissions → permissions ненадёжно работает)
  const { data, error } = await _sb.rpc('get_my_team_context', { p_team_id: teamId });
  if(error || !data) { toast('Команда не найдена', 'err'); return; }

  const ctx = typeof data === 'string' ? JSON.parse(data) : data;

  _currentTeam = {
    id:          ctx.team.id,
    name:        ctx.team.name,
    slug:        ctx.team.slug,
    role:        ctx.role,
    permissions: new Set(ctx.permissions || []),
  };
  localStorage.setItem('draft_active_team', teamId);
  // POL-1: заголовок вкладки отражает активную команду — удобно различать
  // несколько открытых вкладок с разными командами.
  document.title = `${_currentTeam.name} — Draft Hub`;

  // Сбрасываем состояние предыдущей команды до загрузки новых данных
  _resetTeamSpecificState();

  // Loading indicators — пользователь видит что данные грузятся
  showLoading('mapGrid',    'card',   8);
  showLoading('heroPool',   'hero',  12);
  showLoading('playerGrid', 'player', 5);

  await loadAllData();
  renderAuthUI('app');

  // Deep-link: если пользователь пришёл по прямой ссылке /maps, /heroes и
  // т.п. (или это hard-reload, путь уже восстановлен из 404.html-стэша
  // выше в initSession) — открываем именно эту вкладку, а не дефолтную
  // Карты. showView сама вызывает renderCurrentView(), отдельный вызов
  // не нужен. pushState:false — это не пользовательский клик по навигации,
  // URL уже правильный, плодить лишнюю запись в history не нужно.
  const routedView = _viewFromPath(window.location.pathname);
  showView(routedView || 'maps', null, { pushState:false });

  // Показываем вкладку Админ если есть app_role
  const appRole = (await _sb.auth.getSession())?.data?.session?.user?.app_metadata?.app_role;
  window._jwtAppRole = appRole ?? null;
  const adminBtn = document.getElementById('navAdminBtn');
  // БАГ (тот же что в ui.js _renderHeader): style.display='' не включает
  // элемент при наличии CSS-правила .admin-only{display:none} — переключаем класс.
  if(adminBtn) adminBtn.classList.toggle('admin-only-visible', !!appRole);
}

// Сброс состояния специфичного для команды при переключении
// Все функции проверяются через typeof — безопасно если файл не загружен
function _resetTeamSpecificState() {
  if(typeof resetTournamentDraft === 'function') resetTournamentDraft();
  if(typeof resetDraftState      === 'function') resetDraftState();
  if(typeof resetMapFilter       === 'function') resetMapFilter();
  if(typeof resetBanMode         === 'function') resetBanMode();
}

// ── OAuth / email вход ──────────────────────────────────────
async function signInWithProvider(provider) {
  const { error } = await _sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + BASE_PATH + '/', scopes: provider === 'discord' ? 'identify email guilds' : undefined },
  });
  if(error) toast('Ошибка входа: ' + error.message, 'err');
}

async function signInWithEmail(email, password) {
  const { error } = await _sb.auth.signInWithPassword({ email, password });
  if(error) toast('Ошибка входа: ' + error.message, 'err');
}

async function signUpWithEmail(email, password) {
  const { error } = await _sb.auth.signUp({ email, password, options:{ emailRedirectTo: window.location.origin + BASE_PATH + '/' } });
  if(error) toast('Ошибка регистрации: ' + error.message, 'err');
  else toast('Письмо с подтверждением отправлено', 'ok');
}

async function signOut() { await _sb.auth.signOut(); }

function _extractJoinToken() {
  const match = window.location.pathname.match(basePathRegex('\\/join\\/([A-Za-z0-9_=-]{10,})'));
  return match ? match[1] : null;
}

// ── Автозапуск при загрузке страницы ──
document.addEventListener('DOMContentLoaded', initSession);
