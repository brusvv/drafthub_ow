// @hash fd36b27b 2026-07-16T10:11
// ════ TIER SHARE PANEL — для личного тир-листа ════
// Вынесено из render-tier-share.js (FILESPLIT, 16.07 — было 410 строк,
// граница спланирована ещё 12.07 в watch-list AGENT_TASKS.md: "Share panel /
// public shared tier view — разные аудитории, разные жизненные циклы").
// Этот файл — личный кабинет владельца тир-листа (создание/удаление ссылок,
// список активных шар). Публичный просмотр /tier/TOKEN без авторизации —
// render-tier-share-public.js, отдельный файл, не пересекается по состоянию.
//
// Зависимости: render-tiers.js (tierViewMode, tierSets, activeTierSetId),
//              db-write.js (loadShareLinks, createShareLink, deleteShareLink)
// ════ SHARE PANEL — для личного тир-листа ════
async function renderTierSharePanel(){
  const existing = document.getElementById('tierSharePanel');
  if(existing){ existing.remove(); return; }
  await _buildTierSharePanel();
}

// AUDIT-D5: обновление уже открытой панели после create/toggle/delete.
// Раньше это делал сам renderTierSharePanel(), но панели никогда не
// присваивался id="tierSharePanel" (баг, grep подтверждает — id не
// выставлялся нигде в файле) → `existing` выше был всегда null, поэтому
// (а) клик × не закрывал панель (getElementById возвращал null), и
// (б) каждый create/toggle/delete не «перерисовывал» список, а добавлял
// ВТОРУЮ панель поверх старой. Теперь у панели есть id — но это значит
// внутренние вызовы после мутаций не могут просто звать toggle-функцию
// (иначе она бы просто ЗАКРЫВАЛА уже открытую панель), поэтому им нужен
// отдельный «перестроить» вызов.
async function _refreshTierSharePanel(){
  document.getElementById('tierSharePanel')?.remove();
  await _buildTierSharePanel();
}

async function _buildTierSharePanel(){
  const links = await loadShareLinks();

  // Фаза 6: показываем к какому сету привязана панель
  const activeSet  = tierSets.find(s => s.id === activeTierSetId);
  const setLabel   = activeSet ? `«${activeSet.name}»` : 'текущего тир-листа';

  const panel = document.createElement('div');
  panel.id = 'tierSharePanel';
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
          const rowLabel = esc(l.label || _shareEntityLabel(l.entity_type));
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
            <span class="tier-share-row-status" id="shareStatus-${l.id}" aria-live="polite"></span>
            <div class="tier-share-row-actions" id="shareActions-${l.id}"
              data-token="${l.token}" data-label="${rowLabel}">
              <button onclick="copyShareLink('${l.token}','${l.id}')"
                class="btn btn-xs">Скопировать</button>
              <button onclick="_confirmDeleteShareLink('${l.id}')" aria-label="Удалить ссылку ${rowLabel}"
                class="btn btn-danger btn-xs">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty fs-11">Нет активных ссылок</div>'}`;

  const tierEl = document.getElementById('view-tiers');
  if(tierEl) tierEl.appendChild(panel);
}

function _shareEntityLabel(t){ return t==='map'?'Карты':t==='hero'?'Герои':'Карты и герои'; }

// AUDIT-D5: раньше feedback copy/delete шёл только через toast (пропадает
// через 3с, не остаётся в UI). Теперь статус остаётся видимым прямо в строке
// ссылки — toast не убираем (он всё ещё нужен на случай если панель уже
// закрылась к моменту ответа), но он больше не единственный сигнал.
let _shareStatusTimers = {};

function _setShareRowStatus(linkId, text, kind){
  const el = document.getElementById(`shareStatus-${linkId}`);
  if(!el) return;
  el.textContent = text;
  el.className = 'tier-share-row-status' + (text ? ` tier-share-row-status--${kind}` : '');
  clearTimeout(_shareStatusTimers[linkId]);
  if(text){
    _shareStatusTimers[linkId] = setTimeout(() => {
      el.textContent = '';
      el.className = 'tier-share-row-status';
    }, 3000);
  }
}

async function copyShareLink(token, linkId){
  const link = buildAppUrl(`/tier/${token}`);
  try{
    await navigator.clipboard.writeText(link);
    toast('Скопировано ✓','ok');
    if(linkId) _setShareRowStatus(linkId, 'Скопировано ✓', 'ok');
  } catch {
    toast(link,'ok');
    if(linkId) _setShareRowStatus(linkId, 'Не скопировано — см. уведомление', 'err');
  }
}

// Двухшаговое подтверждение удаления: сама подмена кнопок на "Удалить?/Да/Отмена"
// уже и есть inline-статус — без неё deleteShareLink() удаляет сразу, и строка
// пропадает без какого-либо промежуточного состояния кроме toast.
function _confirmDeleteShareLink(linkId){
  const actionsEl = document.getElementById(`shareActions-${linkId}`);
  if(!actionsEl) return deleteShareLink(linkId); // разметка не найдена — старое поведение
  actionsEl.innerHTML = `
    <span class="tier-share-confirm-label">Удалить?</span>
    <button class="btn btn-xs" onclick="_cancelDeleteShareLink('${linkId}')">Отмена</button>
    <button class="btn btn-danger btn-xs" onclick="_runDeleteShareLink('${linkId}')">Да</button>`;
}

function _cancelDeleteShareLink(linkId){
  const actionsEl = document.getElementById(`shareActions-${linkId}`);
  if(!actionsEl) return;
  const token = actionsEl.dataset.token;
  const label = actionsEl.dataset.label;
  actionsEl.innerHTML = `
    <button onclick="copyShareLink('${token}','${linkId}')" class="btn btn-xs">Скопировать</button>
    <button onclick="_confirmDeleteShareLink('${linkId}')" aria-label="Удалить ссылку ${label}"
      class="btn btn-danger btn-xs">✕</button>`;
}

async function _runDeleteShareLink(linkId){
  _setShareRowStatus(linkId, 'Удаление…', 'ok');
  await deleteShareLink(linkId); // существующая логика (toast + _refreshTierSharePanel) — без изменений
}

async function _submitCreateShareLink(){
  const entityType = document.getElementById('shareEntityType')?.value;
  const label      = document.getElementById('shareLinkLabel')?.value.trim();
  const isPublic   = document.getElementById('shareIsPublic')?.checked ?? true;
  // tier_set_id подставляется автоматически через activeTierSetId в db-write.js
  await createShareLink({ entityType, label, isPublic });
  _refreshTierSharePanel();  // перерисовываем с новым списком
}
