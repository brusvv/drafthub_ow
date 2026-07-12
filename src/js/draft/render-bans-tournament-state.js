// @hash 63883100 2026-07-12T07:22
// ════════════════════════════════════════════════════════════
// render-bans-tournament-state.js — константы и reset состояния турнира
// Используется фазами карты и hero bans. Держим отдельно, чтобы файлы фаз
// не разрастались и не дублировали общий state.
// ════════════════════════════════════════════════════════════

// ── Константы ────────────────────────────────────────────────

// Шаги драфта для каждого типа карты
const TOURN_MODE_STEPS = {
  Control:    [{ t:'ban', team:'A' }, { t:'ban', team:'B' }, { t:'pick', team:'A' }, { t:'side', team:'B' }],
  Hybrid:     [{ t:'ban', team:'B' }, { t:'ban', team:'A' }, { t:'pick', team:'B' }, { t:'side', team:'A' }],
  Push:       [{ t:'ban', team:'B' }, { t:'pick', team:'A' }, { t:'side', team:'B' }],
  Flashpoint: [{ t:'pick', team:'B' }, { t:'side', team:'A' }],
  Escort:     [{ t:'ban', team:'A' }, { t:'ban', team:'B' }, { t:'pick', team:'A' }, { t:'side', team:'B' }],
  Clash:      [{ t:'ban', team:'B' }, { t:'pick', team:'A' }, { t:'side', team:'B' }],
};

// Порядок режимов по форматам (Bo1–Bo7)
const TOURN_FORMAT_MODES = {
  1: ['Control'],
  2: ['Control', 'Hybrid'],
  3: ['Control', 'Hybrid', 'Push'],
  5: ['Control', 'Hybrid', 'Push', 'Flashpoint', 'Escort'],
  7: ['Control', 'Hybrid', 'Push', 'Flashpoint', 'Escort', 'Control', 'Escort'],
};

// Режимы с атакой/защитой (для выбора стороны)
const ATTACK_DEFENSE_MODES = ['Hybrid', 'Escort'];

// ── Локальное состояние ──────────────────────────────────────
// Дополнительные переменные, не покрытые store (сессионные)
let tournMapPool = [];       // [{ name, type }] — выбранный пул
let tournCurrentMap = null;  // карта текущего матча
let tournHeroBans = { A: [], B: [] };
let tournSide = 'A';

// Сброс при switchTeam — вызывается из session.js._resetTeamSpecificState()
function resetTournamentDraft() {
  tournMapPool    = [];
  tournCurrentMap = null;
  tournHeroBans   = { A: [], B: [] };
  tournSide       = 'A';
}
