# Draft Hub — Архитектура репозитория

## Структура папок

```
drafthub_ow/
├── build.sh              — сборщик: склеивает CSS + HTML + JS в dist/index.html
├── dist/
│   └── index.html        — итоговый файл для деплоя на GitHub Pages
├── src/
│   ├── css/              — стили (порядок сборки важен)
│   ├── html/             — HTML-фрагменты
│   └── js/               — JS-модули
└── ARCHITECTURE.md       — этот файл
```

---

## CSS (`src/css/`)

| Файл | Назначение |
|------|-----------|
| `base/base.css` | CSS-переменные, reset, типографика, layout (nav, views, cards) |
| `base/responsive.css` | Медиа-запросы для мобайла |
| `features/maps.css` | Карточки карт, тип-иконки, tier-бейджи |
| `features/heroes.css` | Карточки героев, роль-иконки, пул героев |
| `features/players.css` | Карточки игроков, detail-view, roster |
| `features/subroles.css` | Цвета и иконки подклассов |
| `features/tiers.css` | Tier-list drag&drop, строки тиров |
| `modals/modals.css` | Модальные окна, пикеры, форм-элементы, sel-chips |
| `modals/strength.css` | Редактор силы героя на картах (map-str-picker) и синергии |
| `draft/bans.css` | Вкладка «Драфт»: чипы банов, рекомендации, карта матча |
| `draft/draft-comp.css` | Блок рекомендаций композиции |

---

## HTML (`src/html/`)

| Файл | Назначение |
|------|-----------|
| `auth.html` | Блок авторизации Google, поле Sheet ID |
| `main-app.html` | Основной layout: nav, все view-контейнеры (`#view-maps` и т.д.) |
| `modal-hero.html` | Модалка редактирования героя |
| `modal-map.html` | Модалка редактирования карты |
| `modal-player.html` | Модалка редактирования игрока |
| `picker.html` | Оверлей выбора героев (основной пикер + counter picker) |
| `map-str-picker.html` | Оверлей оценки силы героя на картах |

---

## JS (`src/js/`)

### `core/` — ядро приложения

| Файл | Назначение |
|------|-----------|
| `store.js` | Центральное хранилище состояния (`store.get/set`), `INITIAL_STATE`, персистентность в localStorage |
| `config.js` | Прокси-геттеры/сеттеры глобальных переменных → store; константы (`NO_ATKDEF`, цвета ролей, wiki-иконки); утилиты `portrait()`, `mapImg()`, `roleIcon()` и т.д. |
| `auth.js` | Google OAuth 2.0 + GAPI инициализация, `getSheetId()`, `getClientId()` |

**Порядок загрузки: store → config → auth** (каждый следующий зависит от предыдущего)

---

### `data/` — работа с Google Sheets

| Файл | Назначение |
|------|-----------|
| `sheets-load.js` | Низкоуровневые API-функции (`sGet`, `sUp`, `sApp`, `sClear`, `sDelRow`, `sGid`); `loadAllData()`, `loadHeroes()`, `loadMaps()`, `loadPlayers()`, `loadTiers()`, `loadHeroMapStrength()`, `loadHeroSynergy()` |
| `sheets-sync.js` | Seed-данные (`SH`, `SM`); `ensureSheets()`, `syncHeroes()`, `syncMaps()`, `seedSheets()`, `smartSync()` |

**`sheets-load` до `sheets-sync`** — sync использует `sGet` из load.

---

### `scoring/` — алгоритмы рекомендаций

| Файл | Назначение |
|------|-----------|
| `scoring-maps.js` | `heroStrengthOnMap()`, `scoreMaps()`, `topHeroesForMap()`, `sortMapsByScore()` |
| `scoring-bans.js` | `scoreBans()`, `scoreBanVictims()`, `scorePlayerRecs()`, `scoreRosterRecs()`; compat-обёртки `computePlayerRecs_scoring`, `computeRosterRecs_scoring`, `getBanVictims_scoring` |
| `scoring-comp.js` | `heroSynergyScore()`, `compSynergyTotal()`, `scoreComposition()`, `recommendCompositions()`, `recommendPicksByRole()` |

**Порядок: scoring-maps → scoring-bans → scoring-comp** (comp зависит от maps).

---

### `write/` — запись в Google Sheets

| Файл | Назначение |
|------|-----------|
| `write-hero.js` | `saveHero()`, `saveHeroMapStrength()`, `saveHeroSynergy()`, `deleteHero()` |
| `write-map.js` | `saveMap()`, `rewrite()` (перезапись связанных листов), `deleteMap()` |
| `write-player.js` | `savePlayer()`, `deletePlayer()` |

---

### `picker/` — оверлеи выбора данных

| Файл | Назначение |
|------|-----------|
| `picker-core.js` | Основной пикер героев: `openPicker()`, `openHeroPicker()`, `openRoleHeroPicker()`, `renderPickerGrid()`, `confirmPicker()`, `renderSelPreview()`, `renderRolePoolPreviews()` |
| `picker-counters.js` | Пикер контрпиков с оценками: `openCounterPicker()`, `renderCounterPickerGrid()`, `renderCounterScores()`, `setCounterScore()`; `onMapTypeChange()` |
| `picker-maps.js` | Старый пикер карт (сильные/слабые карты) — legacy, не используется в новом UI |
| `picker-comp.js` | Comp-слоты в модалке карты: `initCompSlots()`, `renderCompSlots()`, `openCompSlotPicker()` |

**Порядок: picker-core → picker-counters → picker-maps → picker-comp** — каждый может override `confirmPicker`.

---

### `modals/` — логика модальных окон

| Файл | Назначение |
|------|-----------|
| `modal-hero.js` | `openHeroModal()`, редактор силы героя на картах (`openMapStrPicker`, `renderHeroStrengthGrid`, `setStrengthDot`), синергии (`renderHeroSynergyBlock`, попап `openSynergyScorePopup`), `renderStrengthPreview()` |
| `modal-map.js` | `openMapModal()`, `openPlayerModal()`, `closeModal()`, `renderMapAutoPreferred()`, `setDotRating()`, `onPlayerRoleChange()` |

---

### `render/` — отрисовка вкладок

| Файл | Назначение |
|------|-----------|
| `render-utils.js` | Общие хелперы: `renderCurrentView()`, `showLoading()`, `showError()`, `toast()`, `esc()`, `heroesCountLabel()` |
| `render-maps.js` | Вкладка «Карты» |
| `render-heroes.js` | Вкладка «Герои» |
| `render-tiers.js` | Вкладка «Tier List», drag&drop |
| `render-players.js` | Вкладка «Игроки», `showPlayerDetail()`, `flexTop5()` |
| `render-roster.js` | Вкладка «Состав», `addRosterPlayer()`, `renderRoster()`, `_banDetail()` |
| `render-nav.js` | `showView()`, прокси `toastT`, `toast()` |

---

### `draft/` — вкладка «Драфт»

| Файл | Назначение |
|------|-----------|
| `render-bans-core.js` | Точка входа `renderBans()`, переключатель режимов, активные баны, общие хелперы `_renderBanRecs()`, `_buildHeroChips()` |
| `render-bans-competitive.js` | Соревновательный режим: голосование, попап выбора карты, `_computeCompRecs()` |
| `render-bans-tournament-draft.js` | Турнирный драфт карт (pick/ban maps) |
| `render-bans-tournament-herobans.js` | Турнирные баны героев |
| `render-draft-comp.js` | Рекомендации композиций для пика |

---

## Порядок загрузки JS в `build.sh`

```
store → config → auth
→ sheets-load → sheets-sync
→ scoring-maps → scoring-bans → scoring-comp
→ write-hero → write-map → write-player
→ picker-core → picker-counters → picker-maps → picker-comp
→ modal-hero → modal-map
→ render-utils → render-maps → render-heroes → render-tiers
→ render-players → render-roster → render-nav
→ render-bans-core → render-bans-competitive
→ render-bans-tournament-draft → render-bans-tournament-herobans
→ render-draft-comp
```

---

## Google Sheets — схема данных

| Лист | Колонки | Кто читает | Кто пишет |
|------|---------|-----------|-----------|
| Heroes | name, role, subrole, priority, banned, notes, counters | sheets-load | write-hero |
| Maps | name, type, tier, priority, atk, def, dif, notes | sheets-load | write-map |
| MapPreferred | map, hero | sheets-load | write-map |
| MapBans | map, hero | sheets-load | write-map |
| Compositions | map, hero, role, playerRole | sheets-load | write-map |
| MapCounters | map, hero | sheets-load | write-map |
| Players | name, btag, mainrole, offrole, ranktank, rankdmg, ranksup, notes | sheets-load | write-player |
| PlayerHeroes | player, hero, type | sheets-load | write-player |
| TierMaps | name, tier | sheets-load | render-tiers |
| TierHeroes | name, tier | sheets-load | render-tiers |
| HeroMapStrength | hero, map, atk, def | sheets-load | write-hero |
| HeroSynergy | hero, synergy_hero, score | sheets-load | write-hero |

### Типы карт и поля оценки

- **Hybrid / Escort**: `atk` + `def` (1–10) — атака и защита
- **Control / Flashpoint / Push**: только `atk` как общая сила (def = atk при сохранении)
