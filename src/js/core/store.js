// @hash 1686f1fc 2026-07-15T06:29
// ════════════════════════════════════════════════════════════
// store.js — центральное хранилище состояния Draft Hub
//
// Принципы:
//   • Все мутируемые данные — здесь. Нет разбросанных let по файлам.
//   • Читать: store.get('key') или store.state.key (для внутреннего use)
//   • Писать: store.set('key', value)  — автосохранение в localStorage
//   • Сброс вкладки: store.resetSection('roster')
//   • Персистентные ключи объявлены в PERSIST_KEYS
// ════════════════════════════════════════════════════════════

const PERSIST_KEYS = [
  'tierOrderMaps',
  'tierOrderHeroes',
  'tDraft',
  'rosterPlayers',
  'rosterRoles',
];

const LS_PREFIX = 'draft_';

// ── Начальное состояние ──────────────────────────────────────
const INITIAL_STATE = {

  // ── Данные из Google Sheets ──
  heroes:        [],
  maps:          [],
  players:       [],
  heroMap:       {},      // { name -> heroObj }
  heroPortraits: {},      // { name/key -> url }
  mapScreenshots:{},      // { name/key -> url }

  // ── UI-фильтры ──
  mapFilter:     'all',
  heroFilter:    'all',

  // ── Picker (общий) ──
  pickerMode:         'preferred',
  pickerSelected: {
    preferred: [], bans: [], comp: [],
    playerMain: [], playerPool: [],
    playerRole_Tank: [], playerRole_Damage: [], playerRole_Support: [], playerRole_Flex: [],
    banHeroes: [],
  },
  pickerRoleFilter:   'all',
  pickerMax:          999,
  synergyExclude:     '',
  synergyRoleExclude: '',

  // ── Map picker (для карточки героя) ──
  mapPickerMode:       'heroStrong',
  mapPickerSelected:   { heroStrong: [], heroWeak: [] },
  mapPickerTypeFilter: 'all',

  // ── Counter picker ──
  counterPickerRoleFilter: 'all',
  counterPickerSelected:   [],

  // ── Comp slots (модалка карты) ──
  compSlots: [
    { hero: null, role: 'Tank' },
    { hero: null, role: 'Damage' },
    { hero: null, role: 'Damage' },
    { hero: null, role: 'Support' },
    { hero: null, role: 'Support' },
  ],
  activeSlotIdx: null,

  // ── Баны / турнир ──
  compBanVotes:  {},   // { heroName: { playerName: [c1,c2,c3] } }
  compBanMap:    '',
  banDraftMap:   '',
  banDraftHeroes:[],

  tDraft: {
    phase:        'pool',
    mapPool:      {},
    mapDraftSteps:[],
    stepIndex:    0,
    pickedMaps:   [],
    currentMapIdx:0,
    heroBans:     [],
    format:       5,
  },

  // ── Roster (состав) ──
  rosterPlayers:   [],
  rosterRoles:     {},   // { playerName: 'Tank'|'Damage'|'Support'|null }
  rosterRoleOpen:  {},   // { playerName: bool }
  openBanDetail:   null,

  // ── Tier list ──
  tierOrderMaps:    { S: [], A: [], B: [], C: [], D: [] },
  tierOrderHeroes:  { S: [], A: [], B: [], C: [], D: [] },
  tierMapTypeFilter:  'all',
  tierHeroRoleFilter: 'all',
  // AUDIT-A5 (15.07): раньше module-level `let` в db-load-tiers.js,
  // читались/писались в 12 (tierViewMode) / 9 (activeTierSetId) файлах
  // через общий script-scope. Не в PERSIST_KEYS — то же поведение что и
  // раньше (сброс на дефолт при reload, режим/сет переопределяются
  // заново через loadTiers()/loadTierSets() при старте).
  tierViewMode:     'team',  // 'global' | 'team' | 'personal'
  tierSets:         [],      // личные тир-сеты [{id, name, is_default}]
  activeTierSetId:  null,    // uuid | null — он же tier_lists.id

  // ── Drag & drop ──
  dragItem: null,
  dragType: null,

  // ── Auth / misc ──
  toastT: null,
};

// ────────────────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────────────────
const store = (() => {
  // Глубокое клонирование начального состояния
  let state = JSON.parse(JSON.stringify(INITIAL_STATE));

  // Восстанавливаем персистентные ключи из localStorage
  function _hydrate() {
    PERSIST_KEYS.forEach(key => {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw !== null) {
        try { state[key] = JSON.parse(raw); }
        catch (e) { console.warn(`[store] hydrate failed for "${key}"`, e); }
      }
    });
  }

  // Сохраняем ключ в localStorage (только если он в PERSIST_KEYS)
  function _persist(key, value) {
    if (!PERSIST_KEYS.includes(key)) return;
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[store] persist failed for "${key}"`, e);
    }
  }

  return {
    /** Прямой доступ к объекту (только для чтения без сайд-эффектов) */
    state,

    /** Получить значение */
    get(key) {
      return state[key];
    },

    /** Установить значение + автосохранение */
    set(key, value) {
      if (!(key in state)) {
        console.warn(`[store] unknown key "${key}" — добавь в INITIAL_STATE`);
      }
      state[key] = value;
      _persist(key, value);
      return value;
    },

    /** Обновить объект частично (Object.assign) */
    patch(key, partial) {
      const next = Object.assign({}, state[key], partial);
      return this.set(key, next);
    },

    /** Сбросить раздел к начальному состоянию */
    resetSection(key) {
      if (!(key in INITIAL_STATE)) return;
      const fresh = JSON.parse(JSON.stringify(INITIAL_STATE[key]));
      return this.set(key, fresh);
    },

    /** Сбросить весь store (кроме данных из Sheets) */
    resetAll() {
      const keep = ['heroes','maps','players','heroMap','heroPortraits','mapScreenshots'];
      Object.keys(INITIAL_STATE).forEach(key => {
        if (keep.includes(key)) return;
        state[key] = JSON.parse(JSON.stringify(INITIAL_STATE[key]));
      });
      PERSIST_KEYS.forEach(key => localStorage.removeItem(LS_PREFIX + key));
    },

    /** Инициализация — вызывается один раз при старте */
    init() {
      _hydrate();
    },
  };
})();

// Инициализируем сразу при загрузке скрипта
store.init();
