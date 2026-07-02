// @hash cb044156 2026-07-02T09:27
// ════ DATA — WRITE (Supabase) ════
// MIGR-2: переезд на id-based каталог + unified tier_lists/tier_entries
// (см. db-load.js шапку для контекста). Использует UUID (h.id/m.id/p.id)
// как раньше — но ТЕПЕРЬ ЕЩЁ И hero.heroId/map.mapId (ссылка на
// hero_catalog/map_catalog), которые db-load.js кладёт на каждый объект.
//
// ⚠️ ЗАВИСИМОСТЬ ОТ MIGR-5 (пока не сделан): saveHero()/saveMap() ждут
// от модалки поля #hHeroId / #mMapId — id выбранного героя/карты ИЗ
// КАТАЛОГА (select, не текстовый ввод). Роль/тип/subrole/in_pool больше
// не редактируются здесь — это факты каталога, правит только superadmin
// через отдельный admin RPC (MIGR-4). Пока модалки не обновлены (MIGR-5),
// эти функции не заработают в UI — но контракт с БД корректен уже сейчас,
// можно тестировать через консоль/RPC напрямую.
//
// ⚠️ ЗАВИСИМОСТЬ ОТ MIGR-4: createTierSet()/setDefaultTierSet() дергают
// RPC create_tier_set/set_default_tier_set — их ТЕЛА ещё пишут в старую
// personal_tier_sets, надо переписать на tier_lists (MIGR-4). Клиентский
// вызов не меняется, поэтому здесь трогать нечего, просто не заработает
// до готовности RPC.
//
// ⚠️ pickerSelected.preferred/bans/mapCounters — массивы ИМЁН, резолвятся
// в hero_id через _heroCatalogByName. Резолв молча пропускает нерезолвленное
// имя (см. _resolveIds ниже) — если picker-компонент когда-нибудь начнёт
// отдавать имя не 1-в-1 с hero_catalog.name (например "Lúcio" вместо
// канонiческого "Lucio", см. обсуждение в AGENT_TASKS MIGR-1), это будет
// молчаливая потеря данных, а не ошибка. Проверять после MIGR-5.
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete), session.js
// (currentTeam, canWrite), db-load.js (_heroCatalogById(ByName),
// _mapCatalogById(ByName), _globalTierListId, _teamTierListId, activeTierSetId)

function _requireWrite(){
  if(!canWrite()){ toast('Нет прав на редактирование', 'err'); return false; }
  return true;
}

function _resolveIds(names, byName = _heroCatalogByName){
  return (names||[]).map(n => byName[n]?.id).filter(Boolean);
}

// ════ HEROES ════
async function saveHero(){
  // hero_id — из нового select'а каталога (MIGR-5) для новой roster-записи,
  // либо уже известен на редактируемой (heroes[].heroId).
  const _rawHeroCatalogId = document.getElementById('hHeroId')?.value;
  const heroCatalogId = (_rawHeroCatalogId && _rawHeroCatalogId !== 'undefined') ? _rawHeroCatalogId : null;
  const _rawRowId = document.getElementById('heroEditRow').value;
  const editId = (_rawRowId && _rawRowId !== 'undefined') ? _rawRowId : null;
  const existing = editId ? heroes.find(h => h.id === editId) : null;
  const heroId = existing?.heroId || heroCatalogId;
  if(!heroId){ toast('Выбери героя из каталога', 'err'); return; }

  const newCounters = counterPickerSelected.map(c => ({ name:c.name, score:c.score }));

  // ── Глобальный / Личный режим — трогаем ТОЛЬКО контрпики (hero_counters).
  // Роль/приоритет/синергии/сила на картах всегда командные, редактируются
  // только в team-режиме (см. modal-hero.js openHeroModal). ──
  if(tierViewMode !== 'team'){
    if(tierViewMode === 'global' && !isSuperAdmin()){
      toast('Редактировать глобальные контрпики может только superadmin', 'err'); return;
    }
    try{
      await _saveScopedHeroCounters(tierViewMode, heroId, newCounters);
      toast('Контрпики обновлены ✓', 'ok');
      closeModal('heroModal');
      await loadHeroCounters();
      renderCurrentView();
    }catch(e){ handleError(e); }
    return;
  }

  // ── Командный режим ──
  if(!_requireWrite()) return;

  const row = {
    team_id:  _teamId(),
    hero_id:  heroId,
    // role/subrole больше не пишем — это hero_catalog, не heroes (MIGR-1)
    priority: parseInt(document.getElementById('hPrio').value) || 5,
    banned:   document.getElementById('hBanned').checked,
    notes:    document.getElementById('hNotes').value.trim(),
  };

  try{
    if(editId) await dbUpdate('heroes', editId, row);
    else       await dbInsert('heroes', row);

    await saveHeroMapStrength(heroId);
    await saveHeroSynergy(heroId);
    await _saveScopedHeroCounters('team', heroId, newCounters); // было: counters прямо в row выше, колонка heroes.counters удалена

    toast(editId ? 'Обновлено ✓' : 'Добавлено ✓', 'ok');
    closeModal('heroModal');
    await Promise.all([loadHeroes(), loadHeroMapStrength(), loadHeroSynergy()]);
    await loadHeroCounters();   // hero_counters(scope='team') сменился — пересобрать teamHeroCounters/applyCounterMode
    renderCurrentView();
  }catch(e){ handleError(e); }
}

// Контрпики — единая таблица hero_counters на все 3 scope (MIGR-1).
// delete+insert, тот же паттерн что _writeTierEntries() для тир-листов.
async function _saveScopedHeroCounters(scope, heroId, counters){
  let delQuery = _sb.from('hero_counters').delete().eq('scope', scope).eq('hero_id', heroId);
  if(scope === 'team')     delQuery = delQuery.eq('team_id', _teamId());
  if(scope === 'personal') delQuery = delQuery.eq('team_id', _teamId()).eq('user_id', currentUser().id);
  const { error: delErr } = await delQuery;
  if(delErr) throw delErr;

  if(!counters.length) return;
  const rows = counters.map(c => {
    const counterId = _heroCatalogByName[c.name]?.id;
    return counterId ? {
      scope, hero_id: heroId, counter_hero_id: counterId, score: c.score,
      team_id: scope !== 'global' ? _teamId() : null,
      user_id: scope === 'personal' ? currentUser().id : null,
    } : null;
  }).filter(Boolean);
  if(!rows.length) return;
  const { error: insErr } = await _sb.from('hero_counters').insert(rows);
  if(insErr) throw insErr;
}

async function saveHeroMapStrength(heroId){
  if(!heroStrengthEdits?.length) return;
  const rated = heroStrengthEdits.filter(e => e.atk || e.def);

  await _sb.from('hero_map_strength')
    .delete().eq('team_id', _teamId()).eq('hero_id', heroId);

  if(rated.length){
    const rows = rated.map(e => {
      const mapId = _mapCatalogByName[e.map]?.id;
      return mapId ? { team_id: _teamId(), hero_id: heroId, map_id: mapId, atk: e.atk || 0, def: e.def || 0 } : null;
    }).filter(Boolean);
    if(rows.length){
      const { error } = await _sb.from('hero_map_strength').insert(rows);
      if(error) throw error;
    }
  }
}

async function saveHeroSynergy(heroId){
  if(!heroSynergyEdits) return;

  await _sb.from('hero_synergy')
    .delete().eq('team_id', _teamId()).eq('hero_id', heroId);

  const rated = heroSynergyEdits.filter(e => e.score >= 1);
  if(rated.length){
    const rows = rated.map(e => {
      const synId = _heroCatalogByName[e.name]?.id;
      return synId ? { team_id: _teamId(), hero_id: heroId, synergy_hero_id: synId, score: e.score } : null;
    }).filter(Boolean);
    if(rows.length){
      const { error } = await _sb.from('hero_synergy').insert(rows);
      if(error) throw error;
    }
  }
}

async function deleteHero(){
  if(!_requireWrite()) return;
  const id = document.getElementById('heroEditRow').value; if(!id) return;
  if(!confirm('Удалить героя?')) return;
  try{
    await dbDelete('heroes', id);
    toast('Удалено', 'ok'); closeModal('heroModal');
    await loadHeroes(); renderCurrentView();
  }catch(e){ handleError(e); }
}

// ════ MAPS ════
async function saveMap(){
  if(!_requireWrite()) return;

  const _rawMapCatalogId = document.getElementById('mMapId')?.value; // MIGR-5: select карты из map_catalog
  const mapCatalogId = (_rawMapCatalogId && _rawMapCatalogId !== 'undefined') ? _rawMapCatalogId : null;
  const _rawRowId = document.getElementById('mapEditRow').value;
  const editId = (_rawRowId && _rawRowId !== 'undefined') ? _rawRowId : null;
  const existing = editId ? maps.find(m => m.id === editId) : null;
  const mapId = existing?.mapId || mapCatalogId;
  if(!mapId){ toast('Выбери карту из каталога', 'err'); return; }

  const mapCat = _mapCatalogById[mapId] || {};
  const noAD = NO_ATKDEF.includes(mapCat.type);

  const comp = compSlots.filter(s => s.hero).map(s => {
    const heroCat = _heroCatalogByName[s.hero];
    return heroCat ? { hero_id: heroCat.id, playerRole: s.role, role: heroCat.role || '' } : null;
  }).filter(Boolean);

  const chosenTier = document.getElementById('mTier').value;

  const row = {
    team_id: _teamId(),
    map_id:  mapId,
    // name/type больше не пишем — map_catalog (MIGR-1); in_pool тоже убран
    // отсюда — теперь map_catalog.in_pool, сезонный пул — глобальный факт
    // игры, редактируется только через admin RPC каталога (MIGR-4)
    tier:     chosenTier,
    priority: parseInt(document.getElementById('mPrio').value) || 5,
    atk: noAD ? 3 : parseInt(document.getElementById('mAtk').value) || 3,
    def: noAD ? 3 : parseInt(document.getElementById('mDef').value) || 3,
    dif: noAD ? parseInt(document.getElementById('mDif').value) || 3 : 3,
    notes:       document.getElementById('mNotes').value.trim(),
    preferred_heroes: _resolveIds(pickerSelected.preferred),
    ban_heroes:       _resolveIds(pickerSelected.bans),
    counters:         _resolveIds(pickerSelected.mapCounters),
    comp,
  };

  // MIGR-5: в личном режиме тир из модалки — персональное предпочтение,
  // не команднoe. Не перезаписываем team-shared maps.tier чужим личным
  // выбором при РЕДАКТИРОВАНИИ существующей карты (при создании — team-строка
  // всё равно должна получить какое-то стартовое значение, оставляем).
  if(editId && tierViewMode === 'personal') delete row.tier;

  try{
    if(editId) await dbUpdate('maps', editId, row);
    else       await dbInsert('maps', row);

    // Синхронизация с тир-листом — направление зависит от режима:
    // team → командный tier_entries + maps.tier (уже совпадает, row.tier писали выше);
    // personal → ДЕФОЛТНЫЙ личный сет (не текущий activeTierSetId, см. MIGR-5).
    // Без этого тир из модалки не появляется на странице Tier List, пока
    // карту туда не перетащат вручную — два источника одного факта расходились.
    if(tierViewMode === 'personal'){
      await _syncMapTierToPersonalDefaultList(mapId, chosenTier);
    }else{
      await _syncMapTierToTierList(mapId, chosenTier);
    }

    toast(editId ? 'Карта обновлена ✓' : 'Карта добавлена ✓', 'ok');
    closeModal('mapModal');
    await loadMaps(); renderCurrentView();
  }catch(e){
    handleError(e, e.code === '23505' ? 'Эта карта уже есть в ростере команды' : '');
  }
}

// Обновляет/создаёт запись в team-scope tier_entries под новый tier карты
// из модалки. Не блокирует сохранение самой карты при ошибке — тир-лист
// можно поправить руками, а вот потерять сохранённую карту нельзя.
async function _syncMapTierToTierList(mapId, newTier){
  try{
    const teamTierListId = _teamTierListId || await _resolveTierListId('team', { teamId: _teamId() });
    if(!teamTierListId) return;

    const { data: existingEntry } = await _sb.from('tier_entries')
      .select('id, tier').eq('tier_list_id', teamTierListId)
      .eq('entity_type', 'map').eq('map_id', mapId).maybeSingle();

    if(existingEntry){
      if(existingEntry.tier !== newTier){
        await _sb.from('tier_entries').update({ tier: newTier }).eq('id', existingEntry.id);
      }
    }else{
      const { count } = await _sb.from('tier_entries').select('id', { count:'exact', head:true })
        .eq('tier_list_id', teamTierListId).eq('entity_type', 'map').eq('tier', newTier);
      await _sb.from('tier_entries').insert({
        tier_list_id: teamTierListId, entity_type: 'map', map_id: mapId,
        tier: newTier, position: count || 0,
      });
    }
    await loadTeamTiers(); // обновит teamTierMaps — если страница Tier List открыта, увидит актуальное
  }catch(e){ console.warn('_syncMapTierToTierList failed', e); }
}

// MIGR-5: аналог _syncMapTierToTierList, но для личного режима — пишет
// в ДЕФОЛТНЫЙ личный сет (is_default=true), не в activeTierSetId. Это
// сознательный выбор: activeTierSetId — это то что пользователь СЕЙЧАС
// просматривает на странице Tier List и может быть любым именованным
// сетом, а "Карты" должны быть предсказуемо привязаны к одному конкретному
// сету вне зависимости от навигации.
async function _syncMapTierToPersonalDefaultList(mapId, newTier){
  try{
    if(!currentUser()) return;
    const defaultListId = await _resolveTierListId('personal', { teamId: _teamId(), userId: currentUser().id });
    if(!defaultListId) return;

    const { data: existingEntry } = await _sb.from('tier_entries')
      .select('id, tier').eq('tier_list_id', defaultListId)
      .eq('entity_type', 'map').eq('map_id', mapId).maybeSingle();

    if(existingEntry){
      if(existingEntry.tier !== newTier){
        await _sb.from('tier_entries').update({ tier: newTier }).eq('id', existingEntry.id);
      }
    }else{
      const { count } = await _sb.from('tier_entries').select('id', { count:'exact', head:true })
        .eq('tier_list_id', defaultListId).eq('entity_type', 'map').eq('tier', newTier);
      await _sb.from('tier_entries').insert({
        tier_list_id: defaultListId, entity_type: 'map', map_id: mapId,
        tier: newTier, position: count || 0,
      });
    }
    await loadPersonalDefaultMapTiers(); // обновит personalDefaultMapTierByName для "Карты"
    // Если сейчас на странице Tier List открыт именно дефолтный сет —
    // обновим и personalTierMaps, иначе drag&drop-вид не увидит изменение
    // до следующей перезагрузки данных.
    if(activeTierSetId === defaultListId) await loadPersonalTiers();
  }catch(e){ console.warn('_syncMapTierToPersonalDefaultList failed', e); }
}

async function deleteMap(){
  if(!_requireWrite()) return;
  const id = document.getElementById('mapEditRow').value;
  const mapObj = maps.find(m => m.id === id);
  if(!id || !mapObj) return;
  if(!confirm(`Удалить "${mapObj.name}"?`)) return;
  try{
    await dbDelete('maps', id);
    toast('Удалено', 'ok'); closeModal('mapModal');
    await loadMaps(); renderCurrentView();
  }catch(e){ handleError(e); }
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
  const isPersonal = tierViewMode === 'personal';
  const isGlobal   = tierViewMode === 'global';

  if(isGlobal){
    if(!isSuperAdmin()){ toast('Редактировать глобальный тир-лист может только superadmin', 'err'); return; }
    if(!_globalTierListId){ toast('Глобальный тир-лист ещё не готов, попробуй ещё раз', 'err'); return; }
    const ok = await _writeTierEntries(_globalTierListId, entityType, tierObj);
    if(!ok) return;
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
  if(!ok) return;

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
  const link = `${window.location.origin}/drafthub_ow/tier/${token}`;
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
