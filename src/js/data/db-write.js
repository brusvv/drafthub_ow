// @hash fb658575 2026-06-28T22:23
// ════ DATA — WRITE (Supabase) ════
// Замена write-hero.js / write-map.js / write-player.js.
// Использует UUID (h.id / m.id / p.id) вместо rowIndex.
// Включает запись тир-листов трёх уровней + share-ссылки.
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete), session.js (currentTeam, canWrite)

function _requireWrite(){
  if(!canWrite()){ toast('Нет прав на редактирование', 'err'); return false; }
  return true;
}

// ════ HEROES ════
async function saveHero(){
  const name = document.getElementById('hName').value.trim();
  const _rawHeroId = document.getElementById('heroEditRow').value;
  const editId = (_rawHeroId && _rawHeroId !== 'undefined') ? _rawHeroId : null;
  const newCounters = counterPickerSelected.map(c => ({ name:c.name, score:c.score }));

  // ── Глобальный / Личный режим — трогаем ТОЛЬКО контрпики (hero_counters).
  // Роль/приоритет/синергии/сила на картах всегда командные (heroes.counters
  // и связанные таблицы), поэтому остальные поля заблокированы в модалке
  // (см. modal-hero.js openHeroModal) и здесь не сохраняются вовсе.
  if(tierViewMode !== 'team'){
    if(!editId){ toast('Создавать героев можно только в командном режиме', 'err'); return; }
    if(!name){ toast('Нет имени героя', 'err'); return; }
    if(tierViewMode === 'global' && !isSuperAdmin()){
      toast('Редактировать глобальные контрпики может только superadmin', 'err'); return;
    }
    try{
      await _saveScopedHeroCounters(name, newCounters);
      toast('Контрпики обновлены ✓', 'ok');
      closeModal('heroModal');
      await loadHeroCounters();
      renderCurrentView();
    }catch(e){ handleError(e); }
    return;
  }

  // ── Командный режим — как раньше, весь хero полностью ──
  if(!_requireWrite()) return;
  const role = document.getElementById('hRole').value;
  if(!name || !role){ toast('Заполни имя и роль', 'err'); return; }

  const row = {
    team_id:  _teamId(),
    name, role,
    subrole:  document.getElementById('hSub').value.trim(),
    priority: parseInt(document.getElementById('hPrio').value) || 5,
    banned:   document.getElementById('hBanned').checked,
    notes:    document.getElementById('hNotes').value.trim(),
    counters: newCounters,
  };

  try{
    if(editId) await dbUpdate('heroes', editId, row);
    else       await dbInsert('heroes', row);

    await saveHeroMapStrength(name);
    await saveHeroSynergy(name);

    toast(editId ? 'Обновлено ✓' : 'Добавлено ✓', 'ok');
    closeModal('heroModal');
    await Promise.all([loadHeroes(), loadHeroMapStrength(), loadHeroSynergy()]);
    await loadHeroCounters();   // heroes.counters сменился — пересобрать teamHeroCounters/applyCounterMode
    renderCurrentView();
  }catch(e){ handleError(e); }
}

// Контрпики вне командного режима — отдельная таблица hero_counters,
// delete+insert (тот же паттерн что saveTierOrder() для тир-листов).
async function _saveScopedHeroCounters(heroName, counters){
  const scope = tierViewMode; // 'global' | 'personal'
  let delQuery = _sb.from('hero_counters').delete().eq('scope', scope).eq('hero_name', heroName);
  if(scope === 'personal') delQuery = delQuery.eq('team_id', _teamId()).eq('user_id', currentUser().id);
  const { error: delErr } = await delQuery;
  if(delErr) throw delErr;

  if(!counters.length) return;
  const rows = counters.map(c => ({
    scope, hero_name: heroName, counter_hero: c.name, score: c.score,
    team_id: scope === 'personal' ? _teamId() : null,
    user_id: scope === 'personal' ? currentUser().id : null,
  }));
  const { error: insErr } = await _sb.from('hero_counters').insert(rows);
  if(insErr) throw insErr;
}

async function saveHeroMapStrength(heroName){
  if(!heroStrengthEdits?.length) return;
  const rated = heroStrengthEdits.filter(e => e.atk || e.def);

  await _sb.from('hero_map_strength')
    .delete().eq('team_id', _teamId()).eq('hero_name', heroName);

  if(rated.length){
    const rows = rated.map(e => ({
      team_id: _teamId(), hero_name: heroName, map_name: e.map,
      atk: e.atk || 0, def: e.def || 0,
    }));
    const { error } = await _sb.from('hero_map_strength').insert(rows);
    if(error) throw error;
  }
}

async function saveHeroSynergy(heroName){
  if(!heroSynergyEdits) return;

  await _sb.from('hero_synergy')
    .delete().eq('team_id', _teamId()).eq('hero_name', heroName);

  const rated = heroSynergyEdits.filter(e => e.score >= 1);
  if(rated.length){
    const rows = rated.map(e => ({
      team_id: _teamId(), hero_name: heroName,
      synergy_hero: e.name, score: e.score,
    }));
    const { error } = await _sb.from('hero_synergy').insert(rows);
    if(error) throw error;
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
  const name = document.getElementById('mName').value.trim();
  const type = document.getElementById('mType').value;
  if(!name || !type){ toast('Заполни название и тип', 'err'); return; }

  const _rawMapId = document.getElementById('mapEditRow').value;
  const editId = (_rawMapId && _rawMapId !== 'undefined') ? _rawMapId : null;
  const noAD = NO_ATKDEF.includes(type);

  const comp = compSlots.filter(s => s.hero).map(s => ({
    hero: s.hero, playerRole: s.role, role: (heroMap[s.hero]||{}).role || '',
  }));

  const row = {
    team_id: _teamId(),
    name, type,
    tier:     document.getElementById('mTier').value,
    priority: parseInt(document.getElementById('mPrio').value) || 5,
    atk: noAD ? 3 : parseInt(document.getElementById('mAtk').value) || 3,
    def: noAD ? 3 : parseInt(document.getElementById('mDef').value) || 3,
    dif: noAD ? parseInt(document.getElementById('mDif').value) || 3 : 3,
    notes:       document.getElementById('mNotes').value.trim(),
    in_pool:     document.getElementById('mInPool').checked,
    preferred_heroes: pickerSelected.preferred || [],
    ban_heroes:       pickerSelected.bans || [],
    counters:         pickerSelected.mapCounters || [],
    comp,
  };

  try{
    if(editId) await dbUpdate('maps', editId, row);
    else       await dbInsert('maps', row);

    toast(editId ? 'Карта обновлена ✓' : 'Карта добавлена ✓', 'ok');
    closeModal('mapModal');
    await loadMaps(); renderCurrentView();
  }catch(e){
    handleError(e, e.code === '23505' ? 'Карта с таким именем уже есть' : '');
  }
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

// ════ PLAYERS ════
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

// ════ TIERS — три уровня ════
async function saveTierOrder(entityType, tierObj){
  const isPersonal = tierViewMode === 'personal';
  const isGlobal   = tierViewMode === 'global';

  if(isGlobal){
    const rows = _tierObjToRows(entityType, tierObj);
    const { error } = await _sb.from('global_tier_data')
      .upsert(rows, { onConflict:'entity_type,name' });
    if(error){ handleError(error); return; }
    await loadGlobalTiers();
    toast('Глобальный тир-лист сохранён ✓', 'ok');
    return;
  }

  if(!isPersonal && !canWrite()){
    toast('Нет прав на редактирование командного тир-листа', 'err'); return;
  }

  let delQuery = _sb.from('tier_data').delete()
    .eq('team_id', _teamId()).eq('entity_type', entityType)
    .eq('scope', isPersonal ? 'personal' : 'team');
  if(isPersonal) delQuery = delQuery.eq('user_id', currentUser().id);
  const { error: delErr } = await delQuery;
  if(delErr){ handleError(delErr); return; }

  const rows = _tierObjToRows(entityType, tierObj).map(r => ({
    ...r, team_id: _teamId(),
    scope: isPersonal ? 'personal' : 'team',
    user_id: isPersonal ? currentUser().id : null,
    // Привязываем к активному сету если личный
    tier_set_id: isPersonal ? (activeTierSetId ?? null) : null,
  }));

  if(rows.length){
    const { error: insErr } = await _sb.from('tier_data').insert(rows);
    if(insErr){ handleError(insErr); return; }
  }

  if(isPersonal){ personalTierMaps = tierOrderMaps; personalTierHeroes = tierOrderHeroes; }
  else           { teamTierMaps     = tierOrderMaps; teamTierHeroes     = tierOrderHeroes; }

  toast('Тир-лист сохранён ✓', 'ok');
}

function _tierObjToRows(entityType, tierObj){
  const rows = [];
  Object.entries(tierObj).forEach(([tier, names]) =>
    names.forEach((name, idx) => rows.push({ entity_type: entityType, name, tier, position: idx }))
  );
  return rows;
}

// ════ PERSONAL TIER SETS — CRUD ════
async function createTierSet(name){
  if(!currentUser()) return null;
  const isFirst = tierSets.length === 0;
  try {
    const { data, error } = await _sb.rpc('create_tier_set', {
      p_team_id: _teamId(),
      p_name:    name.trim(),
      // p_set_default убран — 005 определяет is_default автоматически (первый сет = дефолт)
    });
    if(error) throw error;
    toast(`Тир-лист "${name}" создан ✓`, 'ok');
    await loadTierSets();
    activeTierSetId = data;
    renderTiers();
    return data;
  } catch(e){
    handleError(e, e.message?.includes('max_personal_tier_sets') ? 'Максимум 10 личных тир-листов' : '');
    return null;
  }
}

async function deleteTierSet(setId){
  if(!confirm('Удалить этот тир-лист и все его записи?')) return;
  const { error } = await _sb.from('personal_tier_sets').delete().eq('id', setId);
  if(error){ handleError(error); return; }
  toast('Тир-лист удалён', 'ok');
  if(activeTierSetId === setId) activeTierSetId = null;
  await loadTierSets();
  await loadPersonalTiers();
  renderTiers();
}

async function renameTierSet(setId, newName){
  const { error } = await _sb.from('personal_tier_sets')
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
  // Фаза 6: join на personal_tier_sets чтобы получить имя сета для отображения
  const { data, error } = await _sb.from('tier_share_links')
    .select('*, personal_tier_sets(name)')
    .eq('user_id', currentUser().id).eq('team_id', _teamId())
    .order('created_at', { ascending: false });
  if(error) throw error;
  // Нормализуем: tier_set_name на верхний уровень
  return (data || []).map(l => ({
    ...l,
    tier_set_name: l.personal_tier_sets?.name ?? null,
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

  // RPC возвращает токен напрямую как text
  const token = typeof data === 'string' ? data : data?.token;
  const link = `${window.location.origin}/tier/${token}`;
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
