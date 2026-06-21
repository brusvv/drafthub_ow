#!/usr/bin/env node
// ════ scripts/import-from-sheets.js ════
// Разовый перенос данных из старой Google Таблицы в Supabase.
// ИДЕМПОТЕНТНЫЙ — можно запускать повторно, данные не дублируются
// (heroes/maps/players/hero_map_strength/hero_synergy — upsert по
// уникальным колонкам; tier_data — delete+insert, как делает сам апп
// в src/js/data/db-write.js → saveTierOrder).
//
// Порядок импорта: heroes → maps → hero_map_strength → hero_synergy
//                  → players → tier_data
//
// Установка и запуск:
//   cd scripts
//   npm install
//   cp .env.example .env   # и заполнить значения (см. .env.example)
//   npm run import
//
// Переменные окружения — см. .env.example.
// Зависимости: googleapis, @supabase/supabase-js (см. package.json)

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// ── Загрузка .env (без сторонней зависимости) ────────────────────
// Простой построчный парсер KEY=VALUE — этого достаточно для пяти
// переменных ниже и не тащит лишний пакет в проект, который трогает
// секретный service-role ключ.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(__dirname, '.env'));

// ── Конфигурация ────────────────────────────────────────────────
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TEAM_ID,
  SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
} = process.env;

const REQUIRED = {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEAM_ID, SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
};
const missing = Object.entries(REQUIRED).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('✗ Не заданы переменные окружения: ' + missing.join(', '));
  console.error('  Скопируй scripts/.env.example в scripts/.env и заполни значения.');
  process.exit(1);
}

// SERVICE ROLE KEY обходит RLS — именно это нужно для разового импорта
// от имени скрипта, а не реального пользователя.
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Google Sheets клиент (сервисный аккаунт, read-only) ─────────
let _sheets = null;
async function sheetsClient() {
  if (_sheets) return _sheets;
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(GOOGLE_SERVICE_ACCOUNT_KEY_FILE),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  _sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  return _sheets;
}

async function getRows(range) {
  const sheets = await sheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`  ⚠ не удалось прочитать "${range}": ${e.message}`);
    return [];
  }
}

// Индекс колонки по имени заголовка (регистронезависимо)
function colIndex(header, name) {
  return header.findIndex(h => (h || '').trim().toLowerCase() === name.toLowerCase());
}

function groupByFirstCol(rows) {
  const out = {};
  rows.slice(1).forEach(r => {
    if (!r[0] || !r[1]) return;
    if (!out[r[0]]) out[r[0]] = [];
    out[r[0]].push(r[1]);
  });
  return out;
}

// Тот же формат, что parseCounters в src/js/data/sheets-load.js:
// "Genji:8, Tracer:6" → [{name:'Genji',score:8}, {name:'Tracer',score:6}]
function parseCounters(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const sep = s.lastIndexOf(':');
    const scoreText = sep >= 0 ? s.slice(sep + 1).trim() : '';
    const score = parseInt(scoreText, 10);
    if (sep >= 0 && Number.isFinite(score) && score >= 1 && score <= 10) {
      return { name: s.slice(0, sep).trim(), score };
    }
    return { name: s.trim(), score: 5 };
  });
}

// ════ 1. HEROES ════
// Лист "Heroes": name | role | subrole | priority | banned | notes | counters
async function importHeroes() {
  console.log('→ Heroes...');
  const rows = await getRows('Heroes!A:I');
  if (rows.length < 2) { console.log('  пусто, пропускаю'); return; }

  const [header, ...data] = rows;
  const i = f => colIndex(header, f);

  const heroRows = data.filter(r => r[i('name')]).map(r => ({
    team_id: TEAM_ID,
    name: r[i('name')].trim(),
    role: (r[i('role')] || '').trim(),
    subrole: (r[i('subrole')] || '').trim(),
    priority: parseInt(r[i('priority')], 10) || 5,
    banned: (r[i('banned')] || '').toUpperCase() === 'TRUE',
    notes: r[i('notes')] || '',
    counters: parseCounters(r[i('counters')]),
  }));

  if (!heroRows.length) { console.log('  нет строк с именем'); return; }
  const { error } = await sb.from('heroes').upsert(heroRows, { onConflict: 'team_id,name' });
  if (error) throw new Error('heroes: ' + error.message);
  console.log(`  ✓ ${heroRows.length} героев`);
}

// ════ 2. MAPS ════
// Лист "Maps": name | type | tier | priority | atk | def | dif | notes | inpool
// + MapPreferred(map,hero), MapBans(map,hero), MapCounters(map,hero),
//   Compositions(map,hero,role,playerRole)
async function importMaps() {
  console.log('→ Maps...');
  const [mapRows, preferredRows, banRows, compRows, counterRows] = await Promise.all([
    getRows('Maps!A:I'),
    getRows('MapPreferred!A:B'),
    getRows('MapBans!A:B'),
    getRows('Compositions!A:D'),
    getRows('MapCounters!A:B'),
  ]);
  if (mapRows.length < 2) { console.log('  пусто, пропускаю'); return; }

  const preferred = groupByFirstCol(preferredRows);
  const bans = groupByFirstCol(banRows);
  const counters = groupByFirstCol(counterRows);

  const comp = {};
  compRows.slice(1).forEach(r => {
    if (!r[0] || !r[1]) return;
    if (!comp[r[0]]) comp[r[0]] = [];
    comp[r[0]].push({ hero: r[1], role: r[2] || '', playerRole: r[3] || r[2] || '' });
  });

  const [header, ...data] = mapRows;
  const i = f => colIndex(header, f);

  const rows = data.filter(r => r[i('name')]).map(r => {
    const name = r[i('name')].trim();
    return {
      team_id: TEAM_ID,
      name,
      type: (r[i('type')] || '').trim(),
      tier: r[i('tier')] || 'B',
      priority: parseInt(r[i('priority')], 10) || 5,
      atk: parseInt(r[i('atk')], 10) || 3,
      def: parseInt(r[i('def')], 10) || 3,
      dif: parseInt(r[i('dif')], 10) || 3,
      notes: r[i('notes')] || '',
      in_pool: (r[i('inpool')] || '').toUpperCase() !== 'FALSE',
      preferred_heroes: preferred[name] || [],
      ban_heroes: bans[name] || [],
      counters: counters[name] || [],
      comp: comp[name] || [],
    };
  });

  if (!rows.length) { console.log('  нет строк с именем'); return; }
  const { error } = await sb.from('maps').upsert(rows, { onConflict: 'team_id,name' });
  if (error) throw new Error('maps: ' + error.message);
  console.log(`  ✓ ${rows.length} карт`);
}

// ════ 3. HERO MAP STRENGTH ════
// Лист "HeroMapStrength": hero | map | atk | def (позиционно, без заголовка-поиска)
async function importHeroMapStrength() {
  console.log('→ HeroMapStrength...');
  const rows = await getRows('HeroMapStrength!A:D');
  if (rows.length < 2) { console.log('  пусто, пропускаю'); return; }

  const data = rows.slice(1).filter(r => r[0] && r[1]).map(r => {
    const atk = parseInt(r[2], 10) || 0;
    return {
      team_id: TEAM_ID,
      hero_name: r[0].trim(),
      map_name: r[1].trim(),
      atk,
      def: parseInt(r[3], 10) || atk,  // для режимов без ATK/DEF def=atk
    };
  });

  if (!data.length) { console.log('  нет строк'); return; }
  const { error } = await sb.from('hero_map_strength')
    .upsert(data, { onConflict: 'team_id,hero_name,map_name' });
  if (error) throw new Error('hero_map_strength: ' + error.message);
  console.log(`  ✓ ${data.length} записей силы героев на картах`);
}

// ════ 4. HERO SYNERGY ════
// Лист "HeroSynergy": hero | synergy_hero | score (позиционно)
async function importHeroSynergy() {
  console.log('→ HeroSynergy...');
  const rows = await getRows('HeroSynergy!A:C');
  if (rows.length < 2) { console.log('  пусто, пропускаю'); return; }

  const data = rows.slice(1).filter(r => r[0] && r[1]).map(r => ({
    team_id: TEAM_ID,
    hero_name: r[0].trim(),
    synergy_hero: r[1].trim(),
    score: parseInt(r[2], 10) || 5,
  }));

  if (!data.length) { console.log('  нет строк'); return; }
  const { error } = await sb.from('hero_synergy')
    .upsert(data, { onConflict: 'team_id,hero_name,synergy_hero' });
  if (error) throw new Error('hero_synergy: ' + error.message);
  console.log(`  ✓ ${data.length} записей синергии`);
}

// ════ 5. PLAYERS ════
// Лист "Players": name | btag | mainrole | offrole | ranktank | rankdmg | ranksup | notes
// + PlayerHeroes(name, hero, type['main'|'pool'])
async function importPlayers() {
  console.log('→ Players...');
  const [playerRows, heroRows] = await Promise.all([
    getRows('Players!A:H'),
    getRows('PlayerHeroes!A:C'),
  ]);
  if (playerRows.length < 2) { console.log('  пусто, пропускаю'); return; }

  const main = {}, pool = {};
  heroRows.slice(1).forEach(r => {
    if (!r[0] || !r[1]) return;
    const target = (r[2] || 'pool') === 'main' ? main : pool;
    if (!target[r[0]]) target[r[0]] = [];
    target[r[0]].push(r[1]);
  });

  const [header, ...data] = playerRows;
  const i = f => colIndex(header, f);

  const rows = data.filter(r => r[i('name')]).map(r => {
    const name = r[i('name')].trim();
    const mainHeroes = main[name] || [];
    const poolHeroes = [...new Set([...mainHeroes, ...(pool[name] || [])])];
    return {
      team_id: TEAM_ID,
      name,
      btag: r[i('btag')] || '',
      main_role: r[i('mainrole')] || '',
      off_role: r[i('offrole')] || '',
      rank_tank: r[i('ranktank')] || '',
      rank_dmg: r[i('rankdmg')] || '',
      rank_sup: r[i('ranksup')] || '',
      notes: r[i('notes')] || '',
      main_heroes: mainHeroes,
      pool_heroes: poolHeroes,
    };
  });

  if (!rows.length) { console.log('  нет строк с именем'); return; }
  const { error } = await sb.from('players').upsert(rows, { onConflict: 'team_id,name' });
  if (error) throw new Error('players: ' + error.message);
  console.log(`  ✓ ${rows.length} игроков`);
}

// ════ 6. TIER_DATA — командный тир-лист ════
// Листы "TierMaps" и "TierHeroes": name | tier (позиционно)
//
// tier_data защищён partial unique index (idx_tier_team_unique,
// WHERE scope='team') — Supabase JS upsert() не умеет указывать предикат
// партиционного индекса через onConflict, поэтому используем тот же
// паттерн delete+insert, что и сам апп (saveTierOrder в db-write.js).
// Это так же идемпотентно: повторный запуск просто пересоздаёт те же строки.
async function importTierData() {
  console.log('→ TierMaps / TierHeroes...');
  const [mapRows, heroRows] = await Promise.all([
    getRows('TierMaps!A:B'),
    getRows('TierHeroes!A:B'),
  ]);

  const validTiers = new Set(['S', 'A', 'B', 'C', 'D']);
  const toRows = (rows, entityType) => rows.slice(1)
    .filter(r => r[0] && validTiers.has((r[1] || '').toUpperCase()))
    .map(r => ({
      team_id: TEAM_ID, scope: 'team', entity_type: entityType,
      name: r[0].trim(), tier: r[1].toUpperCase(),
    }));

  const rows = [...toRows(mapRows, 'map'), ...toRows(heroRows, 'hero')];
  if (!rows.length) { console.log('  пусто, пропускаю'); return; }

  const entityTypes = [...new Set(rows.map(r => r.entity_type))];
  const { error: delErr } = await sb.from('tier_data')
    .delete().eq('team_id', TEAM_ID).eq('scope', 'team').in('entity_type', entityTypes);
  if (delErr) throw new Error('tier_data delete: ' + delErr.message);

  const { error: insErr } = await sb.from('tier_data').insert(rows);
  if (insErr) throw new Error('tier_data insert: ' + insErr.message);
  console.log(`  ✓ ${rows.length} позиций тир-листа`);
}

// ════ MAIN ════
async function main() {
  console.log(`⟳ Импорт из Google Sheets (${SHEET_ID})`);
  console.log(`  в команду ${TEAM_ID}\n`);
  try {
    await importHeroes();
    await importMaps();
    await importHeroMapStrength();
    await importHeroSynergy();
    await importPlayers();
    await importTierData();
    console.log('\n✓ Импорт завершён. Скрипт идемпотентный — можно запускать повторно.');
  } catch (e) {
    console.error('\n✗ Импорт прерван:', e.message);
    process.exit(1);
  }
}

main();
