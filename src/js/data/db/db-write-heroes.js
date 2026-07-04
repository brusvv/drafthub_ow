// @hash 4e59a845 2026-07-03T08:30
// ════ DATA — WRITE HEROES (Supabase) ════
// Выделено из db-write.js (был 564 строки — один из крупнейших файлов
// проекта) при добавлении MIGR-5. Логика не менялась, только перенос.
//
// MIGR-2: id-based каталог. saveHero() ждёт от модалки #hHeroId (id
// выбранного героя ИЗ КАТАЛОГА, не текстовый ввод) — контракт с БД,
// реализовано в MIGR-5.
//
// Зависимости: auth.js (_sb, dbInsert/dbUpdate/dbDelete), session.js
// (currentTeam, canWrite), db-load.js (_heroCatalogById(ByName)),
// db-write.js (_requireWrite, _resolveIds — общие хелперы)

// ════ HEROES ════
async function saveHero(){
  // MIGR-5: добавления больше нет (bulk-seed даёт весь каталог сразу при
  // создании команды) — editId всегда есть, heroId всегда из существующей записи.
  const _rawRowId = document.getElementById('heroEditRow').value;
  const editId = (_rawRowId && _rawRowId !== 'undefined') ? _rawRowId : null;
  const existing = editId ? heroes.find(h => h.id === editId) : null;
  const heroId = existing?.heroId;
  if(!heroId){ toast('Герой не найден', 'err'); return; }

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
