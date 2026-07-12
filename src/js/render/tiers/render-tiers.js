// ════ RENDER — TIERS: ОРКЕСТРАТОР + РЕЖИМ-СВИТЧЕР + УПРАВЛЕНИЕ СЕТАМИ ════
// FILESPLIT-1 (03.07) — было 467 строк одним файлом. Разбито на 3:
//   render-tiers.js         (этот файл) — точка входа renderTiers(),
//                            переключатель global/team/personal, выпадающее
//                            меню личных сетов (создать/переименовать/удалить)
//   render-tiers-dnd.js     — рендер рядов S/A/B/C/D + drag&drop
//   render-tiers-preview.js — попапы карточки карты/героя из тир-листа
// Все три — один функциональный модуль (тир-лист), просто большой; порядок
// в build.sh: этот файл → dnd → preview (dnd вызывается из renderTiers()
// здесь, preview вызывается из dnd — прямых зависимостей "снизу вверх" нет).
//
// Store proxies (tierOrderMaps/tierOrderHeroes/фильтры/drag state) — здесь,
// используются во всех трёх файлах группы.

Object.defineProperties(window, {
  tierOrderMaps:    { get(){ return store.get('tierOrderMaps'); },    set(v){ store.set('tierOrderMaps',v); },    configurable:true },
  tierOrderHeroes:  { get(){ return store.get('tierOrderHeroes'); },  set(v){ store.set('tierOrderHeroes',v); },  configurable:true },
  tierMapTypeFilter:{ get(){ return store.get('tierMapTypeFilter'); }, set(v){ store.set('tierMapTypeFilter',v); },configurable:true },
  tierHeroRoleFilter:{ get(){ return store.get('tierHeroRoleFilter'); },set(v){ store.set('tierHeroRoleFilter',v); },configurable:true },
  dragItem: { get(){ return store.get('dragItem'); }, set(v){ store.set('dragItem',v); }, configurable:true },
  dragType: { get(){ return store.get('dragType'); }, set(v){ store.set('dragType',v); }, configurable:true },
});

function switchTierTab(tab,btn){
  document.querySelectorAll('.tier-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tierListMaps').style.display=tab==='maps'?'block':'none';
  document.getElementById('tierListHeroes').style.display=tab==='heroes'?'block':'none';
  document.getElementById('tierMapFilters').style.display=tab==='maps'?'flex':'none';
  document.getElementById('tierHeroFilters').style.display=tab==='heroes'?'flex':'none';
}

function filterTierMaps(type,btn){
  tierMapTypeFilter=type;
  document.querySelectorAll('#tierMapFilters .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTierMaps();   // render-tiers-dnd.js
}
function filterTierHeroes(role,btn){
  tierHeroRoleFilter=role;
  document.querySelectorAll('#tierHeroFilters .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTierHeroes();   // render-tiers-dnd.js
}

function renderTiers(){
  const switcherEl = document.getElementById('tierModeSwitcher');
  if(switcherEl) switcherEl.innerHTML = _renderTierModeSwitcher();

  const setsEl = document.getElementById('tierSetSelector');
  if(setsEl) setsEl.innerHTML = tierViewMode === 'personal' ? _renderTierSetSelector() : '';

  renderTierMaps();     // render-tiers-dnd.js
  renderTierHeroes();   // render-tiers-dnd.js

  if(typeof renderAppModeSwitcher === 'function') renderAppModeSwitcher();
}

// ── Переключатель уровней тир-листа ──────────────────────────
function _renderTierModeSwitcher(){
  if(isPublicMode()) {
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
        <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
          letter-spacing:.1em;color:var(--text3)">🌐 Глобальный тир-лист</span>
        <span style="margin-left:auto">
          <button class="btn btn-sm" onclick="renderAuthUI('login')">Войти</button>
        </span>
      </div>`;
  }

  const modes = [
    { key:'global',   label:'Глобальный', icon:'🌐' },
    { key:'team',     label:'Командный',  icon:'👥' },
    { key:'personal', label:'Личный',     icon:'👤' },
  ];
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
        letter-spacing:.1em;color:var(--text3)">Тир-лист:</span>
      ${modes.map(m => `
        <button class="f-btn${tierViewMode===m.key?' active':''} fs-11"
          onclick="switchTierMode('${m.key}')">
          ${m.icon} ${m.label}
        </button>`).join('')}
      ${tierViewMode === 'personal'
        ? `<button class="btn" onclick="renderTierSharePanel()"
            style="font-size:10px;margin-left:auto">🔗 Поделиться</button>`
        : ''}
    </div>`;
}

// ── Выпадающее меню личных тир-сетов ──────────────────────────
function _renderTierSetSelector(){
  if(!tierSets.length) {
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:11px;color:var(--text3)">Нет личных тир-листов</span>
        <button class="btn btn-primary btn-sm" onclick="_showCreateTierSetForm()">+ Создать</button>
      </div>
      <div id="createTierSetForm" style="display:none"></div>`;
  }

  const active = tierSets.find(s => s.id === activeTierSetId);
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <div class="tier-set-menu" style="position:relative">
        <button class="f-btn active" onclick="_toggleTierSetDropdown()" style="font-size:11px;min-width:120px">
          📋 ${active?.name ?? 'Тир-лист'} ▾
        </button>
        <div id="tierSetDropdown" style="display:none;position:absolute;top:100%;left:0;z-index:100;
          background:var(--bg2);border:1px solid var(--border);border-radius:8px;
          min-width:200px;padding:4px;margin-top:4px;box-shadow:0 4px 16px rgba(0,0,0,.4)">
          ${tierSets.map(s => `
            <div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:5px;
              background:${s.id===activeTierSetId?'var(--bg3)':'transparent'};cursor:pointer"
              onclick="switchTierSet('${s.id}');_closeTierSetDropdown()">
              <span style="flex:1;font-size:12px">${s.name}</span>
              ${s.is_default?'<span style="font-size:var(--fluid-fs-2xs);color:var(--text3)">по умолчанию</span>':''}
              <button class="btn" onclick="event.stopPropagation();_openTierSetMenu('${s.id}','${esc(s.name)}')"
                style="font-size:var(--fluid-fs-2xs);padding:1px 5px">⋯</button>
            </div>`).join('')}
          <div style="border-top:1px solid var(--border);margin:4px 0;padding-top:4px">
            <button class="btn btn-primary" onclick="_showCreateTierSetForm();_closeTierSetDropdown()"
              style="width:100%;font-size:10px">+ Создать тир-лист</button>
          </div>
        </div>
      </div>
      <span style="font-size:10px;color:var(--text3)">${tierSets.length}/10</span>
    </div>
    <div id="createTierSetForm" style="display:none;margin-bottom:10px"></div>`;
}

function _toggleTierSetDropdown(){
  const el = document.getElementById('tierSetDropdown');
  if(!el) return;
  const isOpen = el.style.display !== 'none';
  if(isOpen) { _closeTierSetDropdown(); return; }
  el.style.display = 'block';
  setTimeout(() => document.addEventListener('click', _closeTierSetDropdown, { once: true }), 0);
}

function _closeTierSetDropdown(){
  const el = document.getElementById('tierSetDropdown');
  if(el) el.style.display = 'none';
}

function _showCreateTierSetForm(){
  const el = document.getElementById('createTierSetForm');
  if(!el) return;
  if(el.style.display !== 'none') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center">
      <input class="form-input" id="newTierSetName" placeholder="Название (напр. S14 Meta)"
        style="font-size:11px;padding:5px 8px" maxlength="40"
        onkeydown="if(event.key==='Enter')_submitCreateTierSet()">
      <button class="btn btn-primary btn-sm" onclick="_submitCreateTierSet()">Создать</button>
      <button class="btn btn-sm" onclick="this.closest('#createTierSetForm').style.display='none'">✕</button>
    </div>`;
  document.getElementById('newTierSetName')?.focus();
}

async function _submitCreateTierSet(){
  const name = document.getElementById('newTierSetName')?.value?.trim();
  if(!name) { toast('Укажи название', 'err'); return; }
  await createTierSet(name);  // data/db/db-write.js
}

function _openTierSetMenu(setId, setName){
  const active = tierSets.find(s => s.id === setId);
  openTierPreview(`📋 ${setName}`, `   <!-- render-tiers-preview.js -->
    <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0">
      <button class="btn btn-full" onclick="_renameTierSetPrompt('${setId}','${esc(setName)}');closeTierPreview()">✎ Переименовать</button>
      ${!active?.is_default ? `<button class="btn btn-full" onclick="setDefaultTierSet('${setId}');closeTierPreview()">★ Сделать по умолчанию</button>` : ''}
      <button class="btn btn-danger btn-full" onclick="deleteTierSet('${setId}');closeTierPreview()">✕ Удалить</button>
    </div>`);
}

function _renameTierSetPrompt(setId, currentName){
  const name = prompt('Новое название:', currentName);
  if(name?.trim()) renameTierSet(setId, name.trim());  // data/db/db-write.js
}

// Может ли пользователь редактировать ТЕКУЩИЙ активный уровень тир-листа —
// используется и здесь, и в render-tiers-dnd.js
function _canEditCurrentTier(){
  if(isPublicMode())              return false;
  if(tierViewMode === 'global')   return isSuperAdmin();
  if(tierViewMode === 'personal') return true;
  return canWrite();
}
