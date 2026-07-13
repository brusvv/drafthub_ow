// @hash 8ab966c6 2026-07-13T12:48
// ════ TIER SHARE — публичные ссылки и просмотр без авторизации ════
// Зависимости: render-tiers.js (tierViewMode, tierSets, activeTierSetId),
//              db-write.js (loadShareLinks, createShareLink)

// ════ SHARE PANEL — для личного тир-листа ════
async function renderTierSharePanel(){
  const existing = document.getElementById('tierSharePanel');
  if(existing){ existing.remove(); return; }

  const links = await loadShareLinks();

  // Фаза 6: показываем к какому сету привязана панель
  const activeSet  = tierSets.find(s => s.id === activeTierSetId);
  const setLabel   = activeSet ? `«${activeSet.name}»` : 'текущего тир-листа';

  const panel = document.createElement('div');
  panel.className = 'role-card tier-share-panel';
  panel.innerHTML = `
    <div class="tier-share-head">
      <div>
        <div class="tier-share-title">Поделиться тир-листом</div>
        ${activeSet ? `<div class="tier-share-set">Сет: ${activeSet.name}</div>` : ''}
      </div>
      <button onclick="document.getElementById('tierSharePanel').remove()" aria-label="Закрыть панель"
        class="tier-share-close">×</button>
    </div>
    <p class="tier-share-desc">
      Ссылка позволяет другим видеть ${setLabel} — редактировать они не смогут.
    </p>
    <div class="tier-share-form">
      <select class="form-select tier-share-type" id="shareEntityType">
        <option value="both">Карты и герои</option>
        <option value="map">Только карты</option>
        <option value="hero">Только герои</option>
      </select>
      <input class="form-input tier-share-label-input" id="shareLinkLabel" placeholder="Название (опционально)">
      <label class="tier-share-check">
        <input type="checkbox" id="shareIsPublic" checked> Публичная
      </label>
      <button class="btn btn-primary fs-11"
        onclick="_submitCreateShareLink()">Создать ссылку</button>
    </div>
    ${links.length ? `
      <div class="tier-share-links">
        ${links.map(l => {
          // Фаза 6: показываем имя сета к которому привязана ссылка
          const linkSet  = tierSets.find(s => s.id === l.tier_set_id);
          const setChip  = linkSet
            ? `<span class="tier-share-set-chip">📋 ${linkSet.name}</span>`
            : '';
          return `
          <div class="member-row tier-share-row">
            <div class="tier-share-row-main">
              <div class="tier-share-row-title">
                <span class="tier-share-row-label">${l.label || _shareEntityLabel(l.entity_type)}</span>
                ${setChip}
              </div>
              <code class="tier-share-url">
                ${appPath(`/tier/${l.token}`)}
              </code>
            </div>
            <span class="tier-share-views">${l.views} просм.</span>
            <label class="tier-share-public">
              <input type="checkbox" ${l.is_public?'checked':''}
                onchange="toggleShareLinkPublic('${l.id}',this.checked)"> Публичная
            </label>
            <button onclick="copyShareLink('${l.token}')"
              class="btn btn-xs">Скопировать</button>
            <button onclick="deleteShareLink('${l.id}')" aria-label="Удалить ссылку ${esc(l.label || _shareEntityLabel(l.entity_type))}"
              class="btn btn-danger btn-xs">✕</button>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty fs-11">Нет активных ссылок</div>'}`;

  const tierEl = document.getElementById('view-tiers');
  if(tierEl) tierEl.appendChild(panel);
}

function _shareEntityLabel(t){ return t==='map'?'Карты':t==='hero'?'Герои':'Карты и герои'; }

async function copyShareLink(token){
  const link = buildAppUrl(`/tier/${token}`);
  try{ await navigator.clipboard.writeText(link); toast('Скопировано ✓','ok'); }
  catch{ toast(link,'ok'); }
}

async function _submitCreateShareLink(){
  const entityType = document.getElementById('shareEntityType')?.value;
  const label      = document.getElementById('shareLinkLabel')?.value.trim();
  const isPublic   = document.getElementById('shareIsPublic')?.checked ?? true;
  // tier_set_id подставляется автоматически через activeTierSetId в db-write.js
  await createShareLink({ entityType, label, isPublic });
  renderTierSharePanel();  // перерисовываем с новым списком
}

// ════ ОБРАБОТКА /tier/TOKEN — публичный просмотр без авторизации ════
async function handleSharedTierUrl(tokenOverride){
  const match = window.location.pathname.match(basePathRegex('\\/tier\\/([A-Za-z0-9_=-]{10,})'));
  const token = tokenOverride || (match ? match[1] : null);
  if(!token) return false;

  const result = await loadSharedTier(token);

  if(result?.error === 'private_link_requires_auth'){
    sessionStorage.setItem('pending_tier_token', token);
    return false;   // продолжаем обычный flow авторизации
  }
  if(!result?.ok){
    const messages = { not_found:'Ссылка не найдена', no_access:'У тебя нет доступа к этому тир-листу' };
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;
      height:100vh;font-family:Inter,sans-serif;color:#fff;background:#0d0d0f;font-size:15px">
      ${messages[result?.error] || 'Ссылка недействительна или истекла'}
    </div>`;
    return true;
  }

  // Картинки героев/карт грузятся отдельно от тир-данных и в обычном flow
  // вызываются позже (после _onSignIn/renderPublicMode) — на публичной
  // /tier/TOKEN странице до этого никогда не доходит, иначе portrait()/
  // mapImg() возвращают пусто. Грузим явно перед рендером.
  try {
    // _loadCatalogs() (db-load.js) — нужен ДО _renderSharedTierView(), иначе
    // _heroCatalogByName/_mapCatalogByName пустые и фолбэк роли/типа не сработает
    // (публичная /tier/TOKEN страница никогда не проходит через loadAllData())
    await Promise.all([loadPortraits(), loadMapScreenshots(), loadWikiIcons(), _loadCatalogs()]);
  } catch(e) {
    console.warn('handleSharedTierUrl: failed to load images/catalogs', e.message);
  }

  _renderSharedTierView(result);
  return true;
}

// Состояние публичной share-страницы — своя пара переменных, не пересекается
// со store основного приложения (страница рендерится в document.body.innerHTML,
// не в #app, но JS один и тот же файл — поэтому отдельные имена с префиксом _shared).
let _sharedTierTab  = 'maps'; // 'maps' | 'heroes'
let _sharedHeroRole = 'all';  // 'all' | 'Tank' | 'Damage' | 'Support'
let _sharedMapType  = 'all';  // 'all' | 'Control' | 'Escort' | 'Hybrid' | 'Push' | 'Flashpoint'
let _sharedTierData = null;   // последний результат RPC — нужен для перерисовки при переключении таба/фильтра

function _renderSharedTierView(data){
  _sharedTierData = data;
  const tiers = data.tiers || [];
  const byType = { map:{S:[],A:[],B:[],C:[],D:[]}, hero:{S:[],A:[],B:[],C:[],D:[]} };
  // roleByName/typeByName — для фильтров. Сначала данные из RPC (после MIGR-4
  // view_shared_tier джойнит hero_catalog/map_catalog сама), fallback на
  // публичный каталог из db-load.js (было: статика OW_HERO_ROLE/OW_MAP_TYPE)
  const roleByName = {};
  const typeByName = {};
  tiers.forEach(r => {
    if(byType[r.entity_type]?.[r.tier]) byType[r.entity_type][r.tier].push(r.name);
    if(r.entity_type === 'hero') roleByName[r.name] = r.role || _heroCatalogByName[r.name]?.role || '';
    if(r.entity_type === 'map')  typeByName[r.name] = r.map_type || _mapCatalogByName[r.name]?.type || '';
  });

  const showMaps   = data.entity_type === 'both' || data.entity_type === 'map';
  const showHeroes = data.entity_type === 'both' || data.entity_type === 'hero';
  // Если ссылка только на один тип — таб не нужен, сразу показываем его
  if(!showMaps)   _sharedTierTab = 'heroes';
  if(!showHeroes) _sharedTierTab = 'maps';

  const buildRow = (tier, names, type) => {
    if(type === 'hero'){
      // .tier-hero-pill/.tier-hero-pill-ph/.tier-hero-pill-tip — родные классы
      // из tiers.css, размер переопределён в <style> ниже через .shared-wrap.
      // cursor:default — read-only, без drag.
      return `
      <div class="tier-row" data-tier="${tier}" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;padding-left:8px">
        <div class="tier-lbl" style="background:${ts[tier].bg};color:${ts[tier].c}">${tier}</div>
        <div class="shared-hero-grid flex-1">
          ${names.map(name => {
            const hidden = _sharedHeroRole!=='all' && roleByName[name]!==_sharedHeroRole;
            const src = portrait(name);
            return `<div class="tier-hero-pill" data-role="${roleByName[name]||''}" style="cursor:default;${hidden?'display:none':''}" title="${name}">
              ${src?`<img src="${src}" alt="${name}">`:`<div class="tier-hero-pill-ph">${name[0]}</div>`}
              <div class="tier-hero-pill-tip">${name}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
    // Карты — картиночные превью (не текстовые .tier-pill как в основном
    // приложении), своя responsive-сетка через .shared-map-pill/-grid ниже в <style>
    return `
      <div class="tier-row" data-tier="${tier}" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;padding-left:8px">
        <div class="tier-lbl" style="background:${ts[tier].bg};color:${ts[tier].c}">${tier}</div>
        <div class="shared-map-grid flex-1">
          ${names.map(name => {
            const hidden = _sharedMapType!=='all' && typeByName[name] && typeByName[name]!==_sharedMapType;
            const src = mapImg(name);
            return `<div class="shared-map-pill" title="${name}" style="${hidden?'display:none':''}">
              ${src?`<img src="${src}" alt="${name}">`:`<div class="shared-map-pill-ph">${name[0]}</div>`}
              <span>${name}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  };

  const buildTable = (obj, type) => ['S','A','B','C','D']
    .filter(t => obj[t]?.length)
    .map(t => buildRow(t, obj[t], type)).join('');

  // Фаза 6: заголовок — label ссылки → имя сета → дефолт
  const title = data.label || data.tier_set_name || 'Тир-лист';

  const tabsHtml = (showMaps && showHeroes) ? `
    <div class="tier-tabs" style="margin-bottom:1.25rem">
      <button class="tier-tab${_sharedTierTab==='maps'?' active':''}" onclick="_switchSharedTab('maps')">Карты</button>
      <button class="tier-tab${_sharedTierTab==='heroes'?' active':''}" onclick="_switchSharedTab('heroes')">Герои</button>
    </div>` : '';

  const roleFiltersHtml = (showHeroes && _sharedTierTab==='heroes') ? `
    <div class="filters mb-12">
      <button class="f-btn${_sharedHeroRole==='all'?' active':''}" onclick="_setSharedHeroRole('all')">Все</button>
      <button class="f-btn${_sharedHeroRole==='Tank'?' active':''}" onclick="_setSharedHeroRole('Tank')">Tank</button>
      <button class="f-btn${_sharedHeroRole==='Damage'?' active':''}" onclick="_setSharedHeroRole('Damage')">Damage</button>
      <button class="f-btn${_sharedHeroRole==='Support'?' active':''}" onclick="_setSharedHeroRole('Support')">Support</button>
    </div>` : '';

  const mapFiltersHtml = (showMaps && _sharedTierTab==='maps') ? `
    <div class="filters mb-12">
      <button class="f-btn${_sharedMapType==='all'?' active':''}" onclick="_setSharedMapType('all')">Все</button>
      <button class="f-btn${_sharedMapType==='Control'?' active':''}" onclick="_setSharedMapType('Control')">Control</button>
      <button class="f-btn${_sharedMapType==='Flashpoint'?' active':''}" onclick="_setSharedMapType('Flashpoint')">Flashpoint</button>
      <button class="f-btn${_sharedMapType==='Hybrid'?' active':''}" onclick="_setSharedMapType('Hybrid')">Hybrid</button>
      <button class="f-btn${_sharedMapType==='Escort'?' active':''}" onclick="_setSharedMapType('Escort')">Escort</button>
      <button class="f-btn${_sharedMapType==='Push'?' active':''}" onclick="_setSharedMapType('Push')">Push</button>
    </div>` : '';

  document.body.innerHTML = `
    <style>
      /* Самодостаточный блок — переопределяет размеры поверх базовых классов
         .tier-hero-pill/.tier-lbl/.tier-maps (они уже в общем tiers.css,
         тот же index.html — БАГ был найден и исправлен: буква тира здесь
         рисовалась через отдельный .tier-badge с захардкоженными inline
         width/height/font-size, никак не связанный с .tier-lbl из tiers.css —
         не наследовала ни увеличенный шрифт, ни любые будущие правки размера
         "родного" класса. Теперь оба места — один и тот же .tier-lbl),
         плюс свои .shared-map-pill (картиночные превью
         карт, не текстовые .tier-pill как в основном приложении).

         Раскладка карт/героев — CSS Grid auto-fill, а не flex-wrap: даёт
         устойчивое количество колонок на любой ширине экрана без ручных
         точек перелома под конкретное число «6 или 7» (оно само получается
         из отношения ширины контейнера к minmax()), см. src/css/base/responsive.css
         для точки зрения на остальной адаптив приложения. */
      .shared-wrap{
        /* БАГ (найден по скриншоту): margin-left:max(20px, calc(50vw - 460px))
           не имел верхнего предела — на ≥1440px рос линейно без потолка
           (820px на 2560px, 1460px на 4K), утаскивая контент далеко вправо
           при том что max-width оставался фиксированным 760px — справа
           оставалось СТОЛЬКО ЖЕ пустого места, сколько контент "съезжал"
           влево от него. На ≤768px формула наоборот давала переполнение
           (content: 20-780 при viewport 768 → горизонтальный скролл).
           Теперь — обычное центрирование, max-width растёт вместе с экраном
           (даёт больше колонок в CSS Grid ниже вместо одной узкой колонки,
           застрявшей у правого края на широких мониторах). */
        max-width:1100px;
        width:calc(100% - 40px);
        margin:0 auto;
        padding:28px 20px 24px;
      }
      @media (min-width:1440px){ .shared-wrap{max-width:1320px} }
      .shared-title{font-size:25px}
      .shared-subtitle{font-size:12px}

      .shared-map-pill{display:flex;flex-direction:column;align-items:center;gap:5px}
      .shared-map-pill img{width:100%;aspect-ratio:100/64;object-fit:cover;border-radius:8px;display:block}
      .shared-map-pill-ph{width:100%;aspect-ratio:100/64;border-radius:8px;background:var(--bg3);
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px}
      .shared-map-pill span{font-size:11px;font-weight:600;max-width:100%;text-align:center;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)}
      .shared-map-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;
        min-width:0} /* без этого — классический flex-баг: .shared-map-grid лежит
        внутри .tier-row(flex), у flex-элементов min-width:auto по умолчанию,
        грид считает свою ширину по max-content (сумма всех минимальных колонок),
        не сжимается — визуально все карты/герои в один нескончаемый ряд */

      /* Крупнее hero-pill на share-странице (~1.5x vs приложение) + умная
         сетка вместо flex-wrap — на ~760px контейнере даёт 6-7 в ряд сама,
         без хардкода числа колонок. */
      .shared-hero-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px;
        min-width:0} /* см. комментарий у .shared-map-grid выше — тот же баг */
      .shared-wrap .tier-hero-pill{width:100%;height:auto;aspect-ratio:1}
      .shared-wrap .tier-hero-pill img,.shared-wrap .tier-hero-pill-ph{width:100%;height:100%;aspect-ratio:1}
      .shared-wrap .tier-hero-pill-ph{font-size:20px}
      .shared-wrap .tier-hero-pill-tip{font-size:11px}

      @media (max-width:480px){
        .shared-wrap{padding:20px 16px 18px}
        .shared-title{font-size:20px}
        .shared-map-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
        .shared-hero-grid{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))}
      }
    </style>
    <div class="app" style="font-family:Inter,sans-serif">
      <div class="shared-wrap">
        <div style="margin-bottom:20px">
          <div class="shared-title" style="font-weight:800;margin-bottom:4px">${title}</div>
          ${data.tier_set_name && data.label ? `<div class="shared-subtitle" style="color:var(--text3);margin-bottom:2px">📋 ${data.tier_set_name}</div>` : ''}
          <div class="shared-subtitle" style="font-family:var(--mono);color:var(--text3)">Draft Hub · Read only</div>
        </div>
        ${tabsHtml}
        <div id="sharedTabContent">
          ${_sharedTierTab==='maps'
            ? mapFiltersHtml + buildTable(byType.map, 'map')
            : roleFiltersHtml + buildTable(byType.hero, 'hero')}
        </div>
      </div>
    </div>`;
}

// Переключение таба Карты/Герои — перерисовываем весь body тем же данными
function _switchSharedTab(tab){
  _sharedTierTab = tab;
  if(_sharedTierData) _renderSharedTierView(_sharedTierData);
}

// Фильтр ролей внутри таба Героев — тоже полная перерисовка (страница лёгкая,
// нет смысла городить частичный re-render ради 30-40 пилюль)
function _setSharedHeroRole(role){
  _sharedHeroRole = role;
  if(_sharedTierData) _renderSharedTierView(_sharedTierData);
}

function _setSharedMapType(type){
  _sharedMapType = type;
  if(_sharedTierData) _renderSharedTierView(_sharedTierData);
}
