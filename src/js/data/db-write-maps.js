// @hash 34960ae7 2026-07-03T08:26
// @hash PLACEHOLDER
// ════ DATA — WRITE MAPS (Supabase) ════
// Выделено из db-write.js при добавлении MIGR-5. Логика не менялась,
// только перенос. Включает MIGR-5 связь Карты↔Тир-листы (двусторонняя
// синхронизация maps.tier ↔ tier_entries, team- и personal-режимы —
// см. _syncMapTierToTierList/_syncMapTierToPersonalDefaultList).
//
// MIGR-2: id-based каталог. saveMap() ждёт от модалки #mMapId (id
// выбранной карты ИЗ КАТАЛОГА, не текстовый ввод) — контракт с БД,
// реализовано в MIGR-5.
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete), session.js
// (currentTeam, canWrite, currentUser), db-load.js (_mapCatalogById(ByName),
// _teamTierListId, activeTierSetId, _resolveTierListId, maps[],
// loadTeamTiers, loadPersonalTiers, loadPersonalDefaultMapTiers),
// db-write.js (_requireWrite — общий хелпер)

// ════ MAPS ════
async function saveMap(){
  if(!_requireWrite()) return;

  // MIGR-5: добавления больше нет — editId всегда есть, mapId всегда из существующей записи.
  const _rawRowId = document.getElementById('mapEditRow').value;
  const editId = (_rawRowId && _rawRowId !== 'undefined') ? _rawRowId : null;
  const existing = editId ? maps.find(m => m.id === editId) : null;
  const mapId = existing?.mapId;
  if(!mapId){ toast('Карта не найдена', 'err'); return; }

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
