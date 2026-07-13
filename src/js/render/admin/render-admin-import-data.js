// ════ ADMIN IMPORT DATA — CSV import handlers ════
// Зависимости: auth.js (_sb), sheets-import-resolve.js (_resolveHeroId/_resolveMapId),
//              db-load-tiers.js (_resolveTierListId), session.js (isSuperAdmin).

// ── Диспетчер по типам ──
async function _importCsv(type, teamId, rows) {
  if(type === 'heroes')            return _importHeroes(teamId, rows);
  if(type === 'maps')              return _importMaps(teamId, rows);
  if(type === 'players')           return _importPlayers(teamId, rows);
  if(type === 'hero_map_strength') return _importHeroMapStrength(teamId, rows);
  if(type === 'hero_synergy')      return _importHeroSynergy(teamId, rows);
  if(type === 'global_tiers')      return _importGlobalTiers(rows);
  throw new Error('Неизвестный тип: ' + type);
}

// ── Батч-хелпер ──
async function _batchUpsert(table, rows, conflict, chunkSize = 100) {
  let imported = 0; const errors = [];
  for(let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await _sb.from(table).upsert(chunk, { onConflict: conflict });
    if(error) errors.push(`[${i}-${i+chunk.length}]: ${error.message}`);
    else imported += chunk.length;
  }
  return { imported, skipped: 0, errors };
}

// ── Импорт героев ──
// AUD-5 (11.07): было — писал name/role/subrole прямо в heroes (эти
// колонки убраны в MIGR-1, ушли в hero_catalog). Теперь: name резолвится
// в hero_id через _resolveHeroId (sheets-import-resolve.js, тот же global
// scope что и Sheets-импорт — не пишем вторую версию резолвера). role/
// subrole больше не читаем — это факт каталога, не команды, CSV не может
// их менять (тот же принцип что и в sheets-import.js importHeroesFromSheets).
// counters — отдельная таблица hero_counters (scope='team'), не heroes.counters.
async function _importHeroes(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.name)
    .map(r => {
      const heroId = _resolveHeroId(r.name);
      if(!heroId){ unresolved.push(r.name); return null; }
      return {
        team_id:  teamId,
        hero_id:  heroId,
        priority: clampInt(r.priority, 1, 10, 5),
        banned:   (r.banned || '').toUpperCase() === 'TRUE',
        notes:    r.notes || '',
        _counters: _parseCountersCsv(r.counters || ''), // снимается перед upsert, см. ниже
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] Heroes: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };

  const upsertRows = mapped.map(({ _counters, ...r }) => r);
  const result = await _batchUpsert('heroes', upsertRows, 'team_id,hero_id');

  // Контрпики — отдельно, после успешной записи героев (тот же принцип что
  // _importTeamHeroCounters в sheets-import.js: delete по затронутым hero_id
  // + bulk insert, не трогаем контрпики героев не из этого импорта).
  const withCounters = mapped.filter(m => m._counters.length);
  if(withCounters.length){
    const heroIds = withCounters.map(m => m.hero_id);
    await _sb.from('hero_counters').delete()
      .eq('scope', 'team').eq('team_id', teamId).in('hero_id', heroIds);
    const counterUnresolved = [];
    const counterRows = [];
    withCounters.forEach(m => {
      m._counters.forEach(c => {
        const counterId = _resolveHeroId(c.name);
        if(!counterId){ counterUnresolved.push(c.name); return; }
        if(counterId === m.hero_id) return; // CHECK(hero_id<>counter_hero_id)
        counterRows.push({ scope: 'team', team_id: teamId, hero_id: m.hero_id, counter_hero_id: counterId, score: c.score });
      });
    });
    if(counterUnresolved.length) console.warn(`[admin CSV] Heroes → counters: не найдены — ${[...new Set(counterUnresolved)].join(', ')}`);
    if(counterRows.length){
      const { error } = await _sb.from('hero_counters').insert(counterRows);
      if(error) result.errors.push('counters: ' + error.message);
    }
  }

  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт карт ──
// AUD-5 (11.07): было — писал name/type/in_pool прямо в maps (эти колонки
// ушли в map_catalog в MIGR-1). name резолвится в map_id через _resolveMapId.
// type/in_pool больше не читаем — факт каталога, не команды.
async function _importMaps(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.name)
    .map(r => {
      const mapId = _resolveMapId(r.name);
      if(!mapId){ unresolved.push(r.name); return null; }
      return {
        team_id:  teamId,
        map_id:   mapId,
        tier:     ['S','A','B','C','D'].includes(r.tier) ? r.tier : 'B',
        priority: clampInt(r.priority, 1, 10, 5),
        atk:      clampInt(r.atk, 1, 5, 3),
        def:      clampInt(r.def, 1, 5, 3),
        dif:      clampInt(r.dif, 1, 5, 3),
        notes:    r.notes || '',
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] Maps: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('maps', mapped, 'team_id,map_id');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт игроков ──
async function _importPlayers(teamId, rows) {
  const mapped = rows
    .filter(r => r.name && r.main_role)
    .map(r => ({
      team_id:   teamId,
      name:      r.name,
      btag:      r.btag || '',
      main_role: r.main_role,
      off_role:  r.off_role || '',
      rank_tank: r.rank_tank || '',
      rank_dmg:  r.rank_dmg || '',
      rank_sup:  r.rank_sup || '',
      notes:     r.notes || '',
    }));
  const skipped = rows.length - mapped.length;
  const result  = await _batchUpsert('players', mapped, 'team_id,name');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт силы героев на картах ──
// AUD-5 (11.07): было hero_name/map_name text — теперь резолвим в
// hero_id/map_id. PK (team_id,hero_id,map_id) полный (не partial) —
// обычный _batchUpsert с новым onConflict, обвязку не меняем.
async function _importHeroMapStrength(teamId, rows) {
  const unresolvedHeroes = [], unresolvedMaps = [];
  const mapped = rows
    .filter(r => r.hero_name && r.map_name && r.atk)
    .map(r => {
      const heroId = _resolveHeroId(r.hero_name);
      const mapId  = _resolveMapId(r.map_name);
      if(!heroId) unresolvedHeroes.push(r.hero_name);
      if(!mapId)  unresolvedMaps.push(r.map_name);
      if(!heroId || !mapId) return null;
      return {
        team_id: teamId, hero_id: heroId, map_id: mapId,
        atk: clampInt(r.atk, 0, 10, 0),
        def: clampInt(r.def, 0, 10, clampInt(r.atk, 0, 10, 0)),
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolvedHeroes.length) console.warn(`[admin CSV] HeroMapStrength → герои: не найдены — ${[...new Set(unresolvedHeroes)].join(', ')}`);
  if(unresolvedMaps.length) console.warn(`[admin CSV] HeroMapStrength → карты: не найдены — ${[...new Set(unresolvedMaps)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('hero_map_strength', mapped, 'team_id,hero_id,map_id');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт синергий ──
// AUD-5 (11.07): было hero_name/synergy_hero text — теперь резолвим в
// hero_id/synergy_hero_id. PK (team_id,hero_id,synergy_hero_id) полный.
async function _importHeroSynergy(teamId, rows) {
  const unresolved = [];
  const mapped = rows
    .filter(r => r.hero_name && r.synergy_hero && r.score)
    .map(r => {
      const heroId    = _resolveHeroId(r.hero_name);
      const synergyId = _resolveHeroId(r.synergy_hero);
      if(!heroId)    unresolved.push(r.hero_name);
      if(!synergyId) unresolved.push(r.synergy_hero);
      if(!heroId || !synergyId) return null;
      if(heroId === synergyId) return null; // CHECK(hero_id<>synergy_hero_id)
      return {
        team_id: teamId, hero_id: heroId, synergy_hero_id: synergyId,
        score: clampInt(r.score, 1, 10, 5),
      };
    })
    .filter(Boolean);
  const skipped = rows.length - mapped.length;
  if(unresolved.length) console.warn(`[admin CSV] HeroSynergy: не найдены — ${[...new Set(unresolved)].join(', ')}`);
  if(!mapped.length) return { imported: 0, skipped, errors: [] };
  const result = await _batchUpsert('hero_synergy', mapped, 'team_id,hero_id,synergy_hero_id');
  return { ...result, skipped: result.skipped + skipped };
}

// ── Импорт глобального тир-листа ──
// BUG-FIX: раньше писал в global_tier_data (текстовые entity_type/name) —
// таблица удалена в MIGR-1, переехала в tier_lists/tier_entries (hero_id/
// map_id FK на каталог). Не через generic _batchUpsert — idx_tier_entries_
// hero/_map частичные unique-индексы, чистый UPSERT с ON CONFLICT под них
// не работает (та же причина что в sheets-import.js importTiersFromSheets),
// нужен delete-then-insert. Резолв имён → id берём готовый из
// _resolveHeroId/_resolveMapId (sheets-import-resolve.js, MIGR-6) — не
// пишем вторую версию резолвера.
async function _importGlobalTiers(rows) {
  if(!isSuperAdmin()){
    return { imported: 0, skipped: 0, errors: ['Глобальный тир-лист может импортировать только суперадминистратор'] };
  }

  const posCounters = { hero: {}, map: {} };
  const unresolved = [];
  const entries = rows
    .filter(r => r.entity_type && r.name && ['S','A','B','C','D'].includes(r.tier))
    .map(r => {
      const entityType = r.entity_type === 'map' ? 'map' : 'hero';
      const id = entityType === 'map' ? _resolveMapId(r.name) : _resolveHeroId(r.name);
      if(!id){ unresolved.push(r.name); return null; }
      const bucket = posCounters[entityType];
      if(!(r.tier in bucket)) bucket[r.tier] = 0;
      const position = bucket[r.tier]++;
      return {
        entity_type: entityType,
        hero_id: entityType === 'hero' ? id : null,
        map_id:  entityType === 'map'  ? id : null,
        tier: r.tier, position,
      };
    })
    .filter(Boolean);

  const skipped = rows.length - entries.length;
  if(!entries.length) return { imported: 0, skipped, errors: [] };

  const tierListId = await _resolveTierListId('global', {});
  if(!tierListId) return { imported: 0, skipped, errors: ['Не удалось определить глобальный тир-лист'] };

  const entryRows = entries.map(e => ({ ...e, tier_list_id: tierListId }));

  // Полный ре-импорт заменяет ВЕСЬ глобальный список по каждому затронутому
  // entity_type — так же ведёт себя import из Sheets (importTiersFromSheets),
  // не точечный upsert по строкам.
  const touchedTypes = [...new Set(entryRows.map(e => e.entity_type))];
  for(const t of touchedTypes){
    const { error: delErr } = await _sb.from('tier_entries').delete()
      .eq('tier_list_id', tierListId).eq('entity_type', t);
    if(delErr) return { imported: 0, skipped, errors: [delErr.message] };
  }

  const { error: insErr } = await _sb.from('tier_entries').insert(entryRows);
  if(insErr) return { imported: 0, skipped, errors: [insErr.message] };

  if(unresolved.length) console.warn(`[admin CSV] GlobalTiers: не найдены в каталоге — ${[...new Set(unresolved)].join(', ')}`);
  return { imported: entryRows.length, skipped, errors: [] };
}

// ── Хелпер парсинга контрпиков из CSV ──
function _parseCountersCsv(str) {
  if(!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const sep = s.lastIndexOf(':');
    if(sep < 0) return { name: s, score: 5 };
    const score = parseInt(s.slice(sep+1));
    return { name: s.slice(0, sep).trim(), score: isFinite(score) ? score : 5 };
  });
}
