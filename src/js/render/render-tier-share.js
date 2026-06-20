// ════ TIER SHARE — публичные ссылки и просмотр без авторизации ════
// Выделено из render-tiers.js чтобы не превышать лимит строк на файл.
// Зависимости: render-tiers.js (tierViewMode), db-write.js (loadShareLinks, createShareLink)

// ════ SHARE PANEL — для личного тир-листа ════
async function renderTierSharePanel(){
  const existing = document.getElementById('tierSharePanel');
  if(existing){ existing.remove(); return; }

  const links = await loadShareLinks();
  const panel = document.createElement('div');
  panel.id = 'tierSharePanel';
  panel.className = 'role-card';
  panel.style.cssText = 'margin-top:16px;max-width:580px';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700">Поделиться тир-листом</div>
      <button onclick="document.getElementById('tierSharePanel').remove()"
        style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">×</button>
    </div>
    <p style="font-size:11px;color:var(--text3);margin-bottom:12px">
      Ссылка позволяет другим видеть твой личный тир-лист — редактировать они не смогут.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <select class="form-select" id="shareEntityType" style="width:130px;font-size:11px">
        <option value="both">Карты и герои</option>
        <option value="map">Только карты</option>
        <option value="hero">Только герои</option>
      </select>
      <input class="form-input" id="shareLinkLabel" placeholder="Название (опционально)"
        style="flex:1;min-width:140px;font-size:11px">
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer">
        <input type="checkbox" id="shareIsPublic" checked> Публичная
      </label>
      <button class="btn btn-primary" style="font-size:11px"
        onclick="_submitCreateShareLink()">Создать ссылку</button>
    </div>
    ${links.length ? `
      <div style="display:flex;flex-direction:column;gap:5px">
        ${links.map(l => `
          <div class="member-row" style="gap:8px;font-size:11px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">${l.label || _shareEntityLabel(l.entity_type)}</div>
              <code style="font-family:var(--mono);font-size:9px;color:var(--text3);
                display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                /tier/${l.token}
              </code>
            </div>
            <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${l.views} просм.</span>
            <label style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer">
              <input type="checkbox" ${l.is_public?'checked':''}
                onchange="toggleShareLinkPublic('${l.id}',this.checked)"> Публичная
            </label>
            <button onclick="copyShareLink('${l.token}')"
              class="btn" style="font-size:9px;padding:3px 8px">Скопировать</button>
            <button onclick="deleteShareLink('${l.id}')"
              class="btn btn-danger" style="font-size:9px;padding:3px 8px">✕</button>
          </div>`).join('')}
      </div>` : '<div class="empty" style="font-size:11px">Нет активных ссылок</div>'}`;

  const tierEl = document.getElementById('view-tiers');
  if(tierEl) tierEl.appendChild(panel);
}

function _shareEntityLabel(t){ return t==='map'?'Карты':t==='hero'?'Герои':'Карты и герои'; }

async function copyShareLink(token){
  const link = `${window.location.origin}/tier/${token}`;
  try{ await navigator.clipboard.writeText(link); toast('Скопировано ✓','ok'); }
  catch{ toast(link,'ok'); }
}

async function _submitCreateShareLink(){
  const entityType = document.getElementById('shareEntityType')?.value;
  const label      = document.getElementById('shareLinkLabel')?.value.trim();
  const isPublic   = document.getElementById('shareIsPublic')?.checked ?? true;
  await createShareLink({ entityType, label, isPublic });
  renderTierSharePanel();
}

// ════ ОБРАБОТКА /tier/TOKEN — публичный просмотр без авторизации ════
async function handleSharedTierUrl(tokenOverride){
  const match = window.location.pathname.match(/^\/tier\/([A-Za-z0-9_=-]{10,})$/);
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

  _renderSharedTierView(result);
  return true;
}

function _renderSharedTierView(data){
  const tiers = data.tiers || [];
  const byType = { map:{S:[],A:[],B:[],C:[],D:[]}, hero:{S:[],A:[],B:[],C:[],D:[]} };
  tiers.forEach(r => { if(byType[r.entity_type]?.[r.tier]) byType[r.entity_type][r.tier].push(r.name); });

  const buildTable = (obj, type) => ['S','A','B','C','D'].filter(t => obj[t]?.length).map(tier => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px">
      <div class="tier-badge tier-${tier}" style="width:40px;height:40px;font-size:16px;flex-shrink:0">${tier}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;padding:4px 0">
        ${obj[tier].map(name => {
          const src = type==='map' ? mapImg(name) : portrait(name);
          return `<div title="${name}" style="display:flex;flex-direction:column;align-items:center;gap:2px">
            ${src?`<img src="${src}" style="width:${type==='map'?60:36}px;height:${type==='map'?38:36}px;
              object-fit:cover;border-radius:5px">`:`<div style="width:36px;height:36px;border-radius:5px;
              background:#2a2a30;display:flex;align-items:center;justify-content:center;font-weight:700">${name[0]}</div>`}
            <span style="font-size:9px;font-weight:600;max-width:60px;text-align:center;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');

  const showMaps   = data.entity_type === 'both' || data.entity_type === 'map';
  const showHeroes = data.entity_type === 'both' || data.entity_type === 'hero';

  document.body.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:2rem 1rem;font-family:Inter,sans-serif;color:#e0e0e8;background:#0d0d0f;min-height:100vh">
      <div style="margin-bottom:20px">
        <div style="font-size:22px;font-weight:800;margin-bottom:4px">${data.label || 'Тир-лист'}</div>
        <div style="font-size:11px;font-family:monospace;color:#666">Draft Hub · Read only</div>
      </div>
      ${showMaps ? `<div style="font-family:monospace;font-size:9px;text-transform:uppercase;
          letter-spacing:.1em;color:#666;margin-bottom:10px">Карты</div>${buildTable(byType.map,'map')}` : ''}
      ${showHeroes ? `<div style="font-family:monospace;font-size:9px;text-transform:uppercase;
          letter-spacing:.1em;color:#666;margin:20px 0 10px">Герои</div>${buildTable(byType.hero,'hero')}` : ''}
    </div>`;
}
