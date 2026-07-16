// @hash 20164238 2026-07-16T01:56
// ════════════════════════════════════════════════════════════
// render-bans-tournament-herobans.js — турнирный драфт: баны героев
//
// Фаза 3 «heroBans» — startTournHeroBans(), _renderTournHeroBans(),
//                      _renderCurrentMapHeroBan(), doTournHeroBan()
//
// Хелперы:
//   _getTournSeriesBannedHeroes(hb) — герои, уже забаненные в серии
//   _computeTournBanRecs(map, excludeRoles, excludeHeroes) — рекомендации
//   _renderTournFinalRecs() — итоговая таблица банов по всем картам
//
// Зависимости:
//   render-bans-core.js              (_renderBanRecs, renderBans)
//   render-bans-tournament-draft.js  (TOURN_MODE_STEPS, tDraft, resetTournDraft)
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// ФАЗА 3 — БАНЫ ГЕРОЕВ ПО КАРТАМ
// ════════════════════════════════════════════════════════════

function startTournHeroBans() {
  tDraft.heroBans = tDraft.pickedMaps.map(pm => ({
    mapName: pm.name, mode: pm.mode,
    banA: null, banB: null,
    step: 0,                    // 0 = ждём бан A, 1 = ждём бан B, 2 = готово
    bannedRoles: { A: [], B: [] },
  }));
  tDraft.currentMapIdx = 0;
  tDraft.phase = 'heroBans';
  renderBans();
}

function _renderTournHeroBans() {
  const allDone = tDraft.heroBans.every(hb => hb.step >= 2);

  const mapTabs = tDraft.heroBans.map((hb, i) => {
    const active = i === tDraft.currentMapIdx;
    return `<button type="button" class="btn-reset" style="cursor:pointer;padding:5px 10px;border-radius:7px;
                        border:1px solid ${active ? 'var(--border3)' : 'var(--border)'};
                        background:${active ? 'var(--bg3)' : 'transparent'};
                        font-size:12px;font-weight:${active ? 700 : 500}"
                 onclick="tDraft.currentMapIdx=${i};renderBans()">
      ${mapTypeIcon(hb.mode, 11)} ${hb.mapName} ${hb.step >= 2 ? '✓' : ''}
    </button>`;
  }).join('');

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Баны героев по картам</div>
        <div class="ban-panel-hint">
          Каждая команда банит 1 героя на карту. Нельзя повторять роль бана соперника
          на той же карте, и один герой не может быть забанен дважды в серии.
        </div>
        <button class="btn" onclick="tDraft.phase='mapDraft';renderBans()"
                style="font-size:10px;margin-top:6px">← Драфт карт</button>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">${mapTabs}</div>

      ${_renderCurrentMapHeroBan()}
      ${allDone ? _renderTournFinalRecs() : ''}

      <button class="btn mt-12" onclick="resetTournDraft()">Сбросить всё</button>
    </div>`;
}

function _renderCurrentMapHeroBan() {
  const hb  = tDraft.heroBans[tDraft.currentMapIdx];
  if (!hb) return '';

  const m   = maps.find(x => x.name === hb.mapName);
  const src = mapImg(hb.mapName);

  const currentTeam        = hb.step === 0 ? 'A' : 'B';
  const allBannedRoles      = [...(hb.bannedRoles.A || []), ...(hb.bannedRoles.B || [])];
  const seriesBannedHeroes  = _getTournSeriesBannedHeroes(hb);
  const recs                = hb.step < 2
    ? _computeTournBanRecs(m, allBannedRoles, seriesBannedHeroes)
    : [];

  const banStatus = (team) => {
    const ban   = team === 'A' ? hb.banA : hb.banB;
    const color = team === 'A' ? 'var(--tank)' : 'var(--damage)';
    if (ban) {
      const bsrc = portrait(ban);
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;
                          border-radius:7px;background:var(--bg3);
                          border:1px solid rgba(224,85,85,.3)">
        ${bsrc ? `<img src="${bsrc}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">` : ''}
        <span style="font-size:12px;font-weight:700;color:var(--damage)">${ban}</span>
        <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:${color}">Команда ${team}</span>
      </div>`;
    }
    if (hb.step === (team === 'A' ? 0 : 1)) {
      return `<div style="font-family:var(--mono);font-size:10px;color:${color};padding:6px 0">
                Команда ${team} выбирает бан...
              </div>`;
    }
    return `<div style="font-family:var(--mono);font-size:10px;color:var(--text3);padding:6px 0">
              Ожидание...
            </div>`;
  };

  const heroGrid = hb.step < 2
    ? ['Tank', 'Damage', 'Support'].map(role => {
        const roleDisabled = allBannedRoles.includes(role);
        const hs = heroes.filter(h => !h.banned && h.role === role && !seriesBannedHeroes.includes(h.name));
        const chips = hs.map(h => {
          const isRecIdx = recs.findIndex(r => r.hero.name === h.name);
          const bsrc = portrait(h.name);
          const border = isRecIdx === 0
            ? 'border-color:var(--damage);background:var(--bg3)'
            : isRecIdx === 1 ? 'border-color:var(--accent)' : '';
          return `<button type="button" class="comp-ban-chip btn-reset${isRecIdx >= 0 ? ' active' : ''}"
                       style="${border}"
                       data-map="${escAttr(hb.mapName)}"
                       data-hero="${escAttr(h.name)}"
                       onclick="doTournHeroBan(this.dataset.map, this.dataset.hero)"
                       title="${h.name}${isRecIdx >= 0 ? ' — рекомендован' : ''}">
            ${bsrc
              ? `<img src="${bsrc}" onerror="this.style.display='none'">`
              : `<div class="comp-ban-chip-ph">${h.name[0]}</div>`}
            ${isRecIdx === 0
              ? `<div class="comp-ban-priority" style="background:var(--damage)">★</div>`
              : ''}
          </button>`;
        }).join('');

        return `<div style="${roleDisabled ? 'opacity:.3;pointer-events:none' : ''}">
          <div style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
                      letter-spacing:.08em;color:${rc[role]};margin-bottom:5px;
                      display:flex;align-items:center;gap:3px">
            ${roleIcon(role, 11)} ${role}${roleDisabled ? ' (заблокирована)' : ''}
          </div>
          <div class="chip-row">${chips}</div>
        </div>`;
      }).join('')
    : `<div style="font-family:var(--mono);font-size:11px;color:var(--support);margin-bottom:12px">
         ✓ Баны завершены
       </div>`;

  const hintText = hb.step < 2
    ? `<div class="ban-draft-lbl" style="margin-bottom:8px">
         Команда <span style="color:${currentTeam === 'A' ? 'var(--tank)' : 'var(--damage)'}">
           ${currentTeam}
         </span> банит героя
         ${allBannedRoles.length
           ? `<span style="opacity:.5">(роль ${allBannedRoles.join(', ')} уже использована)</span>`
           : ''}
         ${seriesBannedHeroes.length
           ? `<span style="opacity:.5"> · уже банили: ${seriesBannedHeroes.join(', ')}</span>`
           : ''}
       </div>`
    : '';

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      ${src
        ? `<img src="${src}" style="width:120px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0"
                onerror="this.style.display='none'">`
        : ''}
      <div class="flex-1">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">${hb.mapName}</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${banStatus('A')}
          ${banStatus('B')}
        </div>
      </div>
    </div>

    ${hintText}
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">${heroGrid}</div>
    ${recs.length && hb.step < 2 ? _renderBanRecs(recs.slice(0, 5)) : ''}`;
}

// BUG-19 (16.07): баны не проходили конкретно на King's Row — data-map/data-hero
// раньше строились через esc() (экранирует ' как \' — рассчитан на JS-строку
// внутри onclick="...('...')") внутри HTML-атрибута data-map="...", где
// обратный слэш ничем не обрабатывается и остаётся буквальным символом.
// this.dataset.map возвращал "King\'s Row" (с бэкслэшем), .find(x=>x.mapName
// === mapName) не находил совпадение с "King's Row" в tDraft.heroBans → hb
// был undefined → ранний return ниже молча ничего не делал. Заменено на
// escAttr() (экранирует & и " — то, что реально небезопасно внутри "..."
// HTML-атрибута; одинарная кавычка в двойных HTML-кавычках безопасна как есть).
function doTournHeroBan(mapName, heroName) {
  const hb   = tDraft.heroBans.find(x => x.mapName === mapName);
  if (!hb || hb.step >= 2) return;
  const h = heroMap[heroName]; if (!h) return;

  const team          = hb.step === 0 ? 'A' : 'B';
  const allBannedRoles = [...(hb.bannedRoles.A || []), ...(hb.bannedRoles.B || [])];

  if (allBannedRoles.includes(h.role)) {
    toast(`Роль ${h.role} уже забанена на этой карте`, 'err'); return;
  }
  if (_getTournSeriesBannedHeroes(hb).includes(heroName)) {
    toast(`${heroName} уже банили в этой встрече`, 'err'); return;
  }

  if (team === 'A') hb.banA = heroName; else hb.banB = heroName;
  hb.bannedRoles[team] = [...(hb.bannedRoles[team] || []), h.role];
  hb.step++;
  renderBans();
}

// ── Хелперы героев ───────────────────────────────────────────

/** Все герои, забаненные в серии на других картах (не текущей) */
function _getTournSeriesBannedHeroes(currentHb) {
  return [...new Set(
    tDraft.heroBans
      .filter(hb => hb !== currentHb)
      .flatMap(hb => [hb.banA, hb.banB].filter(Boolean))
  )];
}

/** Рекомендации для бана героя на конкретной карте */
function _computeTournBanRecs(mapObj, excludeRoles, excludeHeroes = []) {
  return heroes
    .filter(h => !h.banned && !excludeRoles.includes(h.role) && !excludeHeroes.includes(h.name))
    .map(h => {
      let score = 0; const reasons = [];
      if (mapObj) {
        if ((h.strongMaps || []).includes(mapObj.name)) {
          score += 6; reasons.push({ type: 'mapStrong', text: `Силён: ${mapObj.name}` });
        }
        if ((mapObj.bans || []).includes(h.name)) {
          score += 4; reasons.push({ type: 'mapBan', text: 'В бан-листе карты' });
        }
        if ((mapObj.counters || []).includes(h.name)) {
          score += 2; reasons.push({ type: 'mapBan', text: 'Контр карты' });
        }
      }
      score += h.priority * 0.7;
      if (h.priority >= 8) reasons.push({ type: 'meta', text: `Мета ${h.priority}/10` });
      return { hero: h, score: Math.round(score), reasons };
    })
    .filter(r => r.score > 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ── Итог серии ───────────────────────────────────────────────

function _renderTournFinalRecs() {
  const rows = tDraft.heroBans.map(hb => {
    const srcA = hb.banA ? portrait(hb.banA) : null;
    const srcB = hb.banB ? portrait(hb.banB) : null;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                        border-radius:7px;background:var(--bg2);border:1px solid var(--border)">
      ${mapTypeIcon(hb.mode, 12)}
      <span style="font-size:12px;font-weight:600;flex:1">${hb.mapName}</span>
      <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:var(--tank)">A:</span>
      ${srcA ? `<img src="${srcA}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">` : ''}
      <span style="font-size:11px;color:var(--damage)">${hb.banA || '—'}</span>
      <span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:var(--damage);margin-left:6px">B:</span>
      ${srcB ? `<img src="${srcB}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">` : ''}
      <span style="font-size:11px;color:var(--damage)">${hb.banB || '—'}</span>
    </div>`;
  }).join('');

  return `
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <div class="ban-recs-title" style="margin-bottom:10px">Итог: забаненные герои</div>
      <div style="display:flex;flex-direction:column;gap:6px">${rows}</div>
    </div>`;
}
