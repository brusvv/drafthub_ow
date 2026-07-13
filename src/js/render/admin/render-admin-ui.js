// ════ ADMIN UI — навигация, команды, пользователи, глобальный тир-лист ════
// Вкладка доступна только пользователям с app_role = 'admin' | 'superadmin'
// Зависимости: session.js (isAdmin, isSuperAdmin, currentTeam, currentUser),
//              render-admin-import.js (_renderImportTab)

// ── Главный рендер ──
async function renderAdminPanel() {
  const el = document.getElementById('view-admin');
  if(!el) return;

  if(!isAdmin()) {
    el.innerHTML = renderEmptyState({
      icon: '🔒',
      title: 'Нет доступа',
      desc: 'Раздел доступен только администраторам',
    });
    return;
  }

  el.innerHTML = `
    <div class="panel-medium">
      <div class="admin-tabs" style="display:flex;gap:6px;margin-bottom:16px">
        <button class="f-btn active" onclick="_switchAdminTab('import',this)">📥 Импорт CSV</button>
        <button class="f-btn" onclick="_switchAdminTab('teams',this)">👥 Команды</button>
        ${isSuperAdmin() ? `<button class="f-btn" onclick="_switchAdminTab('users',this)">🔑 Пользователи</button>` : ''}
        <button class="f-btn" onclick="_switchAdminTab('global_tiers',this)">🌐 Глобальный тир</button>
      </div>
      <div id="adminTabContent"></div>
    </div>`;

  _renderAdminTab('import');
}

function _switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tabs .f-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  _renderAdminTab(tab);
}

async function _renderAdminTab(tab) {
  const el = document.getElementById('adminTabContent');
  if(!el) return;
  if(tab === 'import')       return _renderImportTab(el);
  if(tab === 'teams')        return _renderTeamsTab(el);
  if(tab === 'users')        return _renderUsersTab(el);
  if(tab === 'global_tiers') return _renderGlobalTiersTab(el);
}

// ════ КОМАНДЫ ════
async function _loadAdminTeams() {
  const { data } = await _sb.rpc('admin_get_all_teams');
  return data || [];
}

async function _renderTeamsTab(el) {
  el.innerHTML = '<div style="color:var(--text3);font-size:12px">Загрузка...</div>';
  const teams = await _loadAdminTeams();
  if(!teams.length) { el.innerHTML = '<div class="empty">Нет команд</div>'; return; }
  el.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">Все команды (${teams.length})</div>
      <table class="admin-table">
        <thead><tr><th>Название</th><th>Slug</th><th>Участников</th><th>Создана</th></tr></thead>
        <tbody>
          ${teams.map(t => `<tr>
            <td style="font-weight:600">${t.name}</td>
            <td><code class="fs-10">${t.slug}</code></td>
            <td>${t.member_count}</td>
            <td style="font-size:10px;color:var(--text3)">${new Date(t.created_at).toLocaleDateString('ru')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ════ ПОЛЬЗОВАТЕЛИ (только superadmin) ════
async function _renderUsersTab(el) {
  if(!isSuperAdmin()) { el.innerHTML = '<div class="empty">Только для superadmin</div>'; return; }
  el.innerHTML = '<div style="color:var(--text3);font-size:12px">Загрузка...</div>';
  const { data: users } = await _sb.rpc('admin_get_all_users');
  if(!users?.length) { el.innerHTML = '<div class="empty">Нет пользователей</div>'; return; }
  el.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">Пользователи (${users.length})</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
        Изменить app_role: введи email и выбери роль.
      </div>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <input class="form-input" id="adminRoleEmail" placeholder="email пользователя" style="flex:1;min-width:200px;font-size:11px">
        <select class="form-select" id="adminRoleValue" style="width:130px;font-size:11px">
          <option value="">— снять роль —</option>
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
        <button class="btn btn-primary fs-11" onclick="_submitSetAppRole()">Назначить</button>
      </div>
      <table class="admin-table">
        <thead><tr><th>Email</th><th>App role</th><th>Зарегистрирован</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td>${u.email}</td>
            <td>${u.app_role
              ? `<span class="role-tag" style="font-size:var(--fluid-fs-2xs);background:rgba(99,179,237,.15);color:var(--accent)">${u.app_role}</span>`
              : '<span style="color:var(--text3);font-size:10px">—</span>'}</td>
            <td style="font-size:10px;color:var(--text3)">${new Date(u.created_at).toLocaleDateString('ru')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _submitSetAppRole() {
  const email = document.getElementById('adminRoleEmail')?.value?.trim();
  const role  = document.getElementById('adminRoleValue')?.value;
  if(!email) { toast('Введи email', 'err'); return; }
  const { data, error } = await _sb.rpc('set_user_app_role', { p_email: email, p_role: role });
  if(error || !data?.ok) { toast('Ошибка: ' + (data?.error || error?.message), 'err'); return; }
  toast(`Роль ${role || 'снята'} для ${email} ✓`, 'ok');
  _renderAdminTab('users');
}

// ════ ГЛОБАЛЬНЫЙ ТИР-ЛИСТ ════
async function _renderGlobalTiersTab(el) {
  el.innerHTML = '<div style="color:var(--text3);font-size:12px">Загрузка...</div>';
  // BUG-FIX (переприменено — потеряно между сессиями, см. CHANGELOG BUG-11-класс):
  // раньше запрос шёл в global_tier_data — таблица удалена в MIGR-1
  // (007_catalog_tables.sql), переехала в единый tier_lists/tier_entries на
  // 3 scope. Переиспользуем _resolveTierListId/_loadTierEntries из
  // db-load-tiers.js (MIGR-2) — та же логика что читает public /tier
  // страницу и обычный global-режим, не пишем параллельный запрос.
  const globalListId = await _resolveTierListId('global', {});
  const { mapsObj, heroesObj } = await _loadTierEntries(globalListId);

  const byType = { map: mapsObj, hero: heroesObj };

  // БАГ (найден): `${data?.length || 0} записей` — data осталась от СТАРОГО
  // запроса к global_tier_data (см. комментарий выше про BUG-FIX), после
  // переезда на _loadTierEntries() эта переменная нигде не объявлена —
  // ReferenceError при каждом открытии вкладки. Считаем из реальных данных.
  const totalCount = ['S','A','B','C','D'].reduce(
    (sum, t) => sum + mapsObj[t].length + heroesObj[t].length, 0
  );

  const renderType = (label, type) => `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px">${label}</div>
      ${['S','A','B','C','D'].map(t => byType[type][t].length ? `
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
          <span class="tier-badge tier-${t}" style="width:24px;height:24px;font-size:11px;flex-shrink:0">${t}</span>
          <span style="font-size:11px;color:var(--text2)">${byType[type][t].join(', ')}</span>
        </div>` : '').join('')}
    </div>`;

  el.innerHTML = `
    <div class="admin-section">
      <div class="admin-section-title">Глобальный тир-лист
        <span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:8px">${totalCount} записей</span>
      </div>
      <p class="admin-desc">Редактировать через вкладку Tier List (режим «Глобальный»), или через импорт CSV выше.</p>
      ${renderType('Карты', 'map')}
      ${renderType('Герои', 'hero')}
    </div>`;
}
