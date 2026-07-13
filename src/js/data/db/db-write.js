// ════ DATA — WRITE (Supabase) ════
// Общие хелперы (_requireWrite, _resolveIds) + players + tiers + share-links.
// Героев и карты см. db-write-heroes.js / db-write-maps.js (вынесены отсюда —
// файл был 564 строки, один из крупнейших в проекте).
//
// MIGR-2: переезд на id-based каталог + unified tier_lists/tier_entries
// (см. db-load.js шапку для контекста).
//
// ✅ MIGR-4 завершён: createTierSet()/setDefaultTierSet() дергают RPC
// create_tier_set/set_default_tier_set — тела на tier_lists (011_rpc.sql).
//
// ✅ MIGR-5 завершён: saveHero()/saveMap() (см. db-write-heroes.js/
// db-write-maps.js) используют #hHeroId/#mMapId из модалок — каталожный
// picker, не текстовый ввод.
//
// ⚠️ pickerSelected.preferred/bans/mapCounters — массивы ИМЁН, резолвятся
// в hero_id через _heroCatalogByName. Резолв молча пропускает нерезолвленное
// имя (см. _resolveIds ниже) — если picker-компонент когда-нибудь начнёт
// отдавать имя не 1-в-1 с hero_catalog.name, это будет молчаливая потеря
// данных, а не ошибка.
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete), session.js
// (currentTeam, canWrite), db-load.js (_heroCatalogById(ByName),
// _mapCatalogById(ByName), _globalTierListId, _teamTierListId, activeTierSetId)

// _mapCatalogById(ByName), _globalTierListId, _teamTierListId, activeTierSetId)

function _requireWrite(){
  if(!canWrite()){ toast('Нет прав на редактирование', 'err'); return false; }
  return true;
}

function _resolveIds(names, byName = _heroCatalogByName){
  return (names||[]).map(n => byName[n]?.id).filter(Boolean);
}

// ════ PLAYERS ════ (не тронуто MIGR-1 — players не ссылается на каталог)
async function savePlayer(){
  if(!_requireWrite()) return;
  const name     = document.getElementById('pName').value.trim();
  const mainRole = document.getElementById('pMainRole').value;
  if(!name || !mainRole){ toast('Заполни никнейм и основную роль', 'err'); return; }

  const _rawId  = document.getElementById('playerEditRow').value;
  const editId  = (_rawId && _rawId !== 'undefined') ? _rawId : null;
  const isFlex  = mainRole === 'Flex';
  const offRole = document.getElementById('pOffRole').value;
  const roles   = isFlex ? ['Tank','Damage','Support'] : [mainRole, offRole].filter(Boolean);

  let mainHeroes = [];
  roles.forEach(r => {
    (pickerSelected[`playerRole_${r}`] || []).forEach(h => {
      if(!mainHeroes.includes(h) && mainHeroes.length < 5) mainHeroes.push(h);
    });
  });
  let poolHeroes = [...mainHeroes];
  roles.forEach(r => {
    (pickerSelected[`playerRole_${r}`] || []).forEach(h => {
      if(!poolHeroes.includes(h)) poolHeroes.push(h);
    });
  });

  const row = {
    team_id: _teamId(),
    name,
    btag:       document.getElementById('pBtag').value.trim(),
    main_role:  mainRole,
    off_role:   offRole,
    rank_tank:  document.getElementById('pRankTank').value.trim(),
    rank_dmg:   document.getElementById('pRankDmg').value.trim(),
    rank_sup:   document.getElementById('pRankSup').value.trim(),
    notes:      document.getElementById('pNotes').value.trim(),
    main_heroes: mainHeroes,
    pool_heroes: poolHeroes,
  };

  try{
    if(editId) await dbUpdate('players', editId, row);
    else       await dbInsert('players', row);

    toast(editId ? 'Игрок обновлён ✓' : 'Игрок добавлен ✓', 'ok');
    closeModal('playerModal');
    await loadPlayers(); renderCurrentView();
  }catch(e){
    handleError(e, e.code === '23505' ? 'Игрок с таким именем уже есть' : '');
  }
}

async function deletePlayer(){
  if(!_requireWrite()) return;
  const id = document.getElementById('playerEditRow').value;
  if(!id || id === 'undefined') { toast('Игрок не выбран', 'err'); return; }
  if(!confirm('Удалить игрока?')) return;
  try{
    await dbDelete('players', id);
    toast('Удалено', 'ok'); closeModal('playerModal');
    await loadPlayers(); renderCurrentView();
  }catch(e){ handleError(e); }
}

// ════ TIERS — единый механизм на 3 scope (MIGR-1: tier_lists/tier_entries
// вместо global_tier_data + tier_data). Раньше global шёл upsert'ом в
// global_tier_data, team/personal — delete+insert в tier_data. Теперь один
// путь _writeTierEntries() для всех трёх, отличается только tier_list_id. ════
async function saveTierOrder(entityType, tierObj){
  // BACK-3: единая точка отсечки для realtime-подписки на tier_entries —
  // _writeTierEntries ниже делает delete+insert батчем, это НЕСКОЛЬКО
  // postgres_changes событий на один drag&drop. Без окна подавления (см.
  // _onTeamTierRealtimeChange, db/db-load-tiers.js) собственное же
  // изменение прилетало бы обратно как "чужое" и дёргало перерисовку
  // поверх ещё не устаканившегося optimistic-состояния (BACK-1).
  _lastLocalTierWriteAt = Date.now();

  const isPersonal = tierViewMode === 'personal';
  const isGlobal   = tierViewMode === 'global';

  if(isGlobal){
    if(!isSuperAdmin()){ toast('Редактировать глобальный тир-лист может только superadmin', 'err'); return; }
    if(!_globalTierListId){ toast('Глобальный тир-лист ещё не готов, попробуй ещё раз', 'err'); return; }
    const ok = await _writeTierEntries(_globalTierListId, entityType, tierObj);
    if(!ok){
      // BACK-1: откат — сеть упала, но карточка уже "успешно" перетащена
      // локально (оптимистичный рендер в onDrop). Перечитываем настоящее
      // серверное состояние вместо попытки восстановить локальный снапшот —
      // из-за debounce (800ms) несколько drag могли схлопнуться в один
      // network-запрос, откатывать конкретно "предыдущий" снапшот не к чему.
      await loadGlobalTiers(); renderTiers();
      return;
    }
    await loadGlobalTiers();
    toast('Глобальный тир-лист сохранён ✓', 'ok');
    return;
  }

  if(!isPersonal && !canWrite()){
    toast('Нет прав на редактирование командного тир-листа', 'err'); return;
  }

  const tierListId = isPersonal ? activeTierSetId : _teamTierListId;
  if(!tierListId){ toast('Тир-лист ещё не готов, попробуй ещё раз через секунду', 'err'); return; }

  const ok = await _writeTierEntries(tierListId, entityType, tierObj);
  if(!ok){
    // BACK-1 откат — см. комментарий у global-ветки выше, тот же принцип
    if(isPersonal) await loadPersonalTiers(); else await loadTeamTiers();
    renderTiers();
    return;
  }

  if(isPersonal){ personalTierMaps = tierOrderMaps; personalTierHeroes = tierOrderHeroes; }
  else           { teamTierMaps     = tierOrderMaps; teamTierHeroes     = tierOrderHeroes; }

  // Синхронизация с ростером (см. _syncMapTierToTierList — обратное направление,
  // модалка → тир-лист). Только team-scope и только карты: у maps.tier есть
  // прямой аналог в tier_entries, у heroes/personal/global — нет отдельного поля.
  if(!isPersonal && entityType === 'map'){
    const updates = [];
    Object.entries(tierObj).forEach(([tier, names]) => {
      names.forEach(name => {
        const roster = maps.find(m => m.name === name);
        if(roster && roster.tier !== tier) updates.push({ id: roster.id, tier });
      });
    });
    if(updates.length){
      await Promise.all(updates.map(u => _sb.from('maps').update({ tier: u.tier }).eq('id', u.id)));
      updates.forEach(u => { const m = maps.find(x => x.id === u.id); if(m) m.tier = u.tier; });
    }
  }

  // MIGR-5: если drag&drop только что сохранил именно ДЕФОЛТНЫЙ личный сет —
  // обновляем индекс для вкладки "Карты" (personalDefaultMapTierByName).
  // Если пользователь сейчас на каком-то ДРУГОМ (не дефолтном) личном сете —
  // намеренно НЕ трогаем "Карты", связь только с дефолтным по требованию.
  if(isPersonal && entityType === 'map'){
    const defaultListId = await _resolveTierListId('personal', { teamId: _teamId(), userId: currentUser().id });
    if(tierListId === defaultListId) await loadPersonalDefaultMapTiers();
  }

  toast('Тир-лист сохранён ✓', 'ok');
}

async function _writeTierEntries(tierListId, entityType, tierObj){
  const rows = _tierObjToRows(entityType, tierObj, tierListId);

  const { error: delErr } = await _sb.from('tier_entries').delete()
    .eq('tier_list_id', tierListId).eq('entity_type', entityType);
  if(delErr){ handleError(delErr); return false; }

  if(rows.length){
    const { error: insErr } = await _sb.from('tier_entries').insert(rows);
    if(insErr){ handleError(insErr); return false; }
  }
  return true;
}

function _tierObjToRows(entityType, tierObj, tierListId){
  const byName = entityType === 'map' ? _mapCatalogByName : _heroCatalogByName;
  const rows = [];
  Object.entries(tierObj).forEach(([tier, names]) =>
    names.forEach((name, idx) => {
      const id = byName[name]?.id;
      if(!id) return; // имя не резолвится в каталог — пропускаем, не роняем весь save (см. шапку файла про Lúcio/Lucio)
      rows.push({
        tier_list_id: tierListId, entity_type: entityType,
        hero_id: entityType === 'hero' ? id : null,
        map_id:  entityType === 'map'  ? id : null,
        tier, position: idx,
      });
    })
  );
  return rows;
}

// ════ PERSONAL TIER LISTS — CRUD (были personal_tier_sets, теперь
// tier_lists со scope='personal', см. db-load.js) ════
async function createTierSet(name){
  if(!currentUser()) return null;
  try {
    const { data, error } = await _sb.rpc('create_tier_set', {
      p_team_id: _teamId(),
      p_name:    name.trim(),
    });
    if(error) throw error;
    toast(`Тир-лист "${name}" создан ✓`, 'ok');
    await loadTierSets();
    const newSet = typeof data === 'string' ? JSON.parse(data) : data;
    activeTierSetId = newSet?.id ?? null;
    renderTiers();
    return newSet;
  } catch(e){
    handleError(e, e.message?.includes('max_personal_tier_lists') ? 'Максимум 10 личных тир-листов' : '');
    return null;
  }
}

async function deleteTierSet(setId){
  if(!confirm('Удалить этот тир-лист и все его записи?')) return;
  const { error } = await _sb.from('tier_lists').delete().eq('id', setId);
  if(error){ handleError(error); return; }
  toast('Тир-лист удалён', 'ok');
  if(activeTierSetId === setId) activeTierSetId = null;
  await loadTierSets();
  await loadPersonalTiers();
  renderTiers();
}

async function renameTierSet(setId, newName){
  const { error } = await _sb.from('tier_lists')
    .update({ name: newName }).eq('id', setId);
  if(error){ handleError(error); return; }
  toast('Переименовано ✓', 'ok');
  await loadTierSets();
  renderTiers();
}

async function setDefaultTierSet(setId){
  try {
    const { error } = await _sb.rpc('set_default_tier_set', { p_set_id: setId });
    if(error) throw error;
    await loadTierSets();
    renderTiers();
  } catch(e){ handleError(e); }
}

// ════ SHARE LINKS — для личного тир-листа ════
async function loadShareLinks(){
  // tier_share_links.tier_set_id теперь FK на tier_lists (MIGR-1, репойнт),
  // было personal_tier_sets — join-таблица в select() поменялась.
  const { data, error } = await _sb.from('tier_share_links')
    .select('*, tier_lists(name)')
    .eq('user_id', currentUser().id).eq('team_id', _teamId())
    .order('created_at', { ascending: false });
  if(error) throw error;
  return (data || []).map(l => ({
    ...l,
    tier_set_name: l.tier_lists?.name ?? null,
  }));
}

async function createShareLink({ entityType = 'both', label = '', isPublic = true, expiresInDays = null }){
  const { data, error } = await _sb.rpc('create_tier_share_link', {
    p_team_id: _teamId(),
    p_tier_set_id: activeTierSetId ?? null,
    p_entity_type: entityType,
    p_label: label || null,
    p_is_public: isPublic,
    p_expires_in_days: expiresInDays,
  });
  if(error){ handleError(error, 'Ошибка создания ссылки'); return null; }

  const token = typeof data === 'string' ? data : data?.token;
  const link = buildAppUrl(`/tier/${token}`);
  try{ await navigator.clipboard.writeText(link); toast('Ссылка скопирована ✓', 'ok'); }
  catch{ toast(link, 'ok'); }
  return link;
}

async function toggleShareLinkPublic(linkId, isPublic){
  await _sb.from('tier_share_links').update({ is_public: isPublic }).eq('id', linkId);
  toast(isPublic ? 'Ссылка стала публичной' : 'Ссылка скрыта', 'ok');
  renderTierSharePanel?.();
}

async function deleteShareLink(linkId){
  await _sb.from('tier_share_links').delete().eq('id', linkId);
  toast('Ссылка удалена', 'ok');
  renderTierSharePanel?.();
}
