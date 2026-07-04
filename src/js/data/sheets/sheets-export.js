// @hash 191b2ef3 2026-06-30T11:25
// ════ SHEETS EXPORT — Supabase → Google Sheets (один в одну сторону) ════
// Экспорт односторонний, не импорт обратно — снимок текущих данных команды
// для отчётности. Тело под-таба «Экспорт» (_renderExportSubTab) встраивается
// в общий shell sheets-settings-panel.js (SETTINGS-1) — Sheet ID и шапка
// рендерятся там один раз, общие для обоих под-табов.
//
// Зависимости: sheets-auth.js (_sheetsAccessToken, _ensureSheetTab,
//              _sheetsClear, _sheetsWrite, loadSheetsConfig, saveSheetsConfig),
//              sheets-settings-panel.js (renderGoogleSheetsPanel — для
//              перерисовки после exportTeamToSheets), session.js (canExportSheets),
//              data/db-load.js (heroes, maps, players, heroMapStrength, heroSynergy)

async function exportTeamToSheets(){
  if(!canExportSheets()){ toast('Нет прав на экспорт', 'err'); return; }
  if(!_sheetsAccessToken){ toast('Сначала авторизуйся в Google', 'err'); return; }

  const config = await loadSheetsConfig();
  if(!config?.sheet_id){ toast('Укажи Sheet ID для экспорта', 'err'); return; }
  const sheetId = config.sheet_id;

  try{
    toast('Экспорт начат...', 'ok');

    // ── Heroes ──
    await _ensureSheetTab(sheetId, 'Heroes');
    const heroRows = [
      ['name','role','subrole','priority','banned','notes','counters'],
      ...heroes.map(h => [
        h.name, h.role, h.subrole, h.priority, h.banned ? 'TRUE':'FALSE', h.notes,
        (h.counters||[]).map(c => `${c.name}:${c.score}`).join(','),
      ]),
    ];
    await _sheetsClear(sheetId, 'Heroes!A:Z');
    await _sheetsWrite(sheetId, `Heroes!A1:G${heroRows.length}`, heroRows);

    // ── Maps ──
    await _ensureSheetTab(sheetId, 'Maps');
    const mapRows = [
      ['name','type','tier','priority','atk','def','dif','notes','in_pool'],
      ...maps.map(m => [m.name,m.type,m.tier,m.priority,m.atk,m.def,m.dif,m.notes, m.inPool?'TRUE':'FALSE']),
    ];
    await _sheetsClear(sheetId, 'Maps!A:Z');
    await _sheetsWrite(sheetId, `Maps!A1:I${mapRows.length}`, mapRows);

    // ── Players ──
    await _ensureSheetTab(sheetId, 'Players');
    const playerRows = [
      ['name','btag','main_role','off_role','rank_tank','rank_dmg','rank_sup','main_heroes','pool_heroes'],
      ...players.map(p => [p.name,p.btag,p.mainRole,p.offRole,p.rankTank,p.rankDmg,p.rankSup,
        (p.mainHeroes||[]).join(';'), (p.poolHeroes||[]).join(';')]),
    ];
    await _sheetsClear(sheetId, 'Players!A:Z');
    await _sheetsWrite(sheetId, `Players!A1:I${playerRows.length}`, playerRows);

    // ── HeroMapStrength ──
    await _ensureSheetTab(sheetId, 'HeroMapStrength');
    const hmsRows = [['hero','map','atk','def']];
    Object.entries(heroMapStrength).forEach(([hero, byMap]) => {
      Object.entries(byMap).forEach(([map, v]) => hmsRows.push([hero, map, v.atk, v.def]));
    });
    await _sheetsClear(sheetId, 'HeroMapStrength!A:Z');
    await _sheetsWrite(sheetId, `HeroMapStrength!A1:D${hmsRows.length}`, hmsRows);

    // ── HeroSynergy ──
    await _ensureSheetTab(sheetId, 'HeroSynergy');
    const synRows = [['hero','synergy_hero','score']];
    Object.entries(heroSynergy).forEach(([hero, list]) => {
      list.forEach(s => synRows.push([hero, s.name, s.score]));
    });
    await _sheetsClear(sheetId, 'HeroSynergy!A:Z');
    await _sheetsWrite(sheetId, `HeroSynergy!A1:C${synRows.length}`, synRows);

    await saveSheetsConfig(sheetId);
    toast('Экспорт завершён ✓', 'ok');
    renderGoogleSheetsPanel();
  }catch(e){
    toast('Ошибка экспорта: ' + e.message, 'err'); console.error(e);
  }
}

// ── Под-таб «Экспорт» внутри общей панели (shell — sheets-settings-panel.js) ──
// Sheet ID больше не свой собственный input — общий #sheetsConfigId в shell,
// сохраняется там через _saveSheetsConfigId(). Здесь только тело под-таба.
function _renderExportSubTab(config){
  return `
    <p style="font-size:11px;color:var(--text3);margin-bottom:12px">
      Текущие данные команды (герои, карты, игроки, силы, синергии) будут записаны
      в указанную выше Google-таблицу. Импорт обратно не выполняется — это снимок для отчётности.
    </p>
    <button class="btn btn-primary" onclick="exportTeamToSheets()">Экспортировать сейчас</button>
    ${config?.last_sync_at ? `<div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:8px">
      Последний экспорт: ${new Date(config.last_sync_at).toLocaleString('ru-RU')}</div>` : ''}`;
}
