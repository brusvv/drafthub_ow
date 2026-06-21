# DraftHub OW — Architecture

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS, собирается в один `dist/index.html` через `build.sh` |
| База данных | Supabase (PostgreSQL) |
| Авторизация | Supabase Auth — email/пароль, Google OAuth, Discord OAuth |
| Экспорт | Google Sheets API v4 (опциональный, отдельный OAuth) |
| Деплой | GitHub Pages (GitHub Actions → build.sh → dist/) |

---

## Структура файлов

```
drafthub_ow/
├── build.sh                  # Сборщик → dist/index.html, обновляет @hash в исходниках
├── update_hash.py            # Хелпер для build.sh — версионирование файлов
├── .env.example              # Шаблон переменных окружения (коммитится)
├── .github/workflows/deploy.yml   # CI/CD: push → build → GitHub Pages
│
├── src/
│   ├── html/
│   │   ├── auth.html         # Контейнер — формы рендерятся динамически (auth/ui.js)
│   │   ├── main-app.html     # Layout, nav, team switcher в хедере
│   │   ├── modal-hero.html / modal-map.html / modal-player.html
│   │   ├── picker.html
│   │   └── map-str-picker.html
│   │
│   ├── css/
│   │   ├── base/             { base, responsive }.css
│   │   ├── features/         { maps, heroes, players, tiers, subroles }.css
│   │   ├── modals/           { modals, strength }.css
│   │   └── draft/            { bans, draft-comp }.css
│   │
│   └── js/
│       ├── core/
│       │   ├── store.js      # Реактивное хранилище состояния
│       │   └── config.js     # Иконки, портреты, цвета ролей, imgH
│       │
│       ├── auth/
│       │   ├── auth.js       # Supabase client (_sb), dbSelect/Insert/Update/Delete
│       │   ├── session.js    # Сессия, активная команда, геттеры прав, /tier и /join роутинг
│       │   ├── team.js       # Команды, участники, роли, инвайты
│       │   └── ui.js         # Формы входа/регистрации, настройки команды, панель ролей
│       │
│       ├── data/
│       │   ├── db-load.js    # SELECT из Supabase → герои/карты/игроки + тир-листы
│       │   ├── db-write.js   # INSERT/UPDATE/DELETE + saveTierOrder + share-ссылки
│       │   ├── db-sync.js    # Seed стартовых данных
│       │   └── sheets-bridge.js  # Экспорт в Google Sheets (отдельный OAuth)
│       │
│       ├── scoring/          { scoring-maps, scoring-bans, scoring-comp }.js
│       ├── picker/           { picker-core, picker-counters, picker-comp }.js
│       ├── modals/
│       │   ├── modal-hero.js         # openHeroModal + synergy picker
│       │   ├── modal-hero-chips.js   # Унифицированные чипы+попап для counter/synergy
│       │   ├── modal-hero-strength.js # Редактор силы на картах
│       │   └── modal-map.js          # openMapModal + openPlayerModal
│       │
│       ├── render/
│       │   ├── render-utils.js      # renderCurrentView, Esc-обработчик, skeleton loaders
│       │   ├── render-maps.js / render-heroes.js / render-tiers.js
│       │   ├── render-tier-share.js # Share-панель + публичный просмотр /tier/TOKEN
│       │   ├── render-players.js / render-roster.js
│       │   └── render-nav.js        # showView, toast
│       │
│       └── draft/
│           ├── render-bans-core.js
│           ├── render-bans-competitive.js
│           ├── render-bans-tournament-draft.js
│           ├── render-bans-tournament-herobans.js
│           └── render-draft-comp.js
│
└── supabase/
    ├── 001_initial_schema.sql   # Все таблицы, индексы, триггеры, GRANT
    ├── 002_roles_and_rls.sql    # Роли, права, RLS, RPC-функции
    └── 005_personal_tiers.sql   # Личные тир-листы и share-ссылки (добавляет scope/user_id к tier_data)
```

> **Нумерация:** файлы 003 и 004 удалены (их содержимое вошло в 001 и 002).
> Пропуск в нумерации намеренный — Supabase CLI отслеживает миграции по имени,
> переименование привело бы к повторному применению.

---

## База данных

### Порядок применения миграций

```
001_initial_schema.sql   ← сначала
002_roles_and_rls.sql    ← после 001
005_personal_tiers.sql   ← после 002
```

Применять через Supabase → SQL Editor → New query, по одному файлу в указанном порядке.
При использовании CLI: `supabase db reset` пересоздаст всё с нуля в правильном порядке.

---

### Таблицы

| Таблица | Описание |
|---------|---------|
| `teams` | Команды. Триггер при создании → системные роли в `roles` |
| `permissions` | Справочник прав (`read_game_data`, `write_data`, …). Создаётся один раз в 001 |
| `roles` | Роли — командные (`team_id` заполнен) и глобальные (`team_id = NULL`). `max_per_team=1` для manager и captain |
| `role_permissions` | Связь роль → право (many-to-many) |
| `user_roles` | Связь пользователь → роль → команда. `team_id = NULL` для глобальных ролей |
| `team_invites` | Инвайт-ссылки `/join/TOKEN`. `role_id`, `expires_at`, `max_uses` |
| `heroes` | Герои per-team. `counters` — jsonb `[{name, score}]` |
| `maps` | Карты per-team. `preferred_heroes`, `ban_heroes`, `counters` — arrays; `comp` — jsonb |
| `hero_map_strength` | Сила героя на карте: `atk`, `def` (0–10). PK = `(team_id, hero_name, map_name)` |
| `hero_synergy` | Синергии: `score` (1–10). PK = `(team_id, hero_name, synergy_hero)` |
| `players` | Ростер команды. `main_heroes`, `pool_heroes` — arrays, опциональный `user_id` |
| `tier_data` | Тир-листы. `scope` ('team'\|'personal'), `user_id` для личных |
| `global_tier_data` | Единый тир-лист приложения. Пишет только superadmin |
| `tier_share_links` | Ссылки `/tier/TOKEN` на личный тир-лист |
| `sheets_tokens` | Sheet ID для экспорта в Google Sheets |

---

### Система ролей

#### Уровень 1 — Глобальные роли (app_metadata)

Хранятся в JWT (`app_metadata.app_role`). Устанавливаются вручную через
Supabase Dashboard → Users → Edit. Нельзя получить через API.

| Роль | Доступ |
|------|--------|
| `superadmin` | Полный доступ: все команды, запись в `global_tier_data`, назначение `app_role` другим |
| `admin` | Просмотр всех команд, управление пользователями, без прямого доступа к данным команд |

#### Уровень 2 — Командные роли (per-team)

Создаются автоматически для каждой команды. Хранятся в `roles` с `team_id`.
Связь с пользователем — через `user_roles`.

| Роль | sort_order | max_per_team | Права |
|------|-----------|-------------|-------|
| `manager` | 0 | **1** | Все права включая удаление команды |
| `coach` | 1 | без лимита | Пишет данные, управляет инвайтами и составом |
| `captain` | 2 | **1** | Читает данные и состав. Назначается manager или coach |
| `player` | 3 | без лимита | Читает данные и состав |
| `viewer` | 4 | без лимита | Нет прав. Санкция или технический доступ |

#### Таблица прав

```
Право                manager  coach  captain  player  viewer
─────────────────────────────────────────────────────────────
read_game_data          ✓       ✓       ✓        ✓       ✗
write_data              ✓       ✓       ✗        ✗       ✗
read_roster             ✓       ✓       ✓        ✓       ✗
write_roster            ✓       ✓       ✗        ✗       ✗
manage_invites          ✓       ✓       ✗        ✗       ✗
manage_roles            ✓       ✗       ✗        ✗       ✗
export_sheets           ✓       ✓       ✗        ✗       ✗
delete_team             ✓       ✗       ✗        ✗       ✗
```

#### Иерархия инвайтов

Правило: можно пригласить только с ролью **не выше своей** (sort_order ≥ своего).
`viewer` не может создавать инвайты.

```
manager  → manager, coach, captain, player
coach    → coach, captain, player
captain  → captain, player
player   → player
viewer   → ×
```

Ограничение реализовано в RLS-политике `team_invites`:
```sql
AND (SELECT sort_order FROM roles WHERE id = role_id) >= my_role_sort_order(team_id)
```

---

### Тир-листы — три уровня

```
global    — один на всё приложение, пишет только superadmin
team      — командный, читают с read_game_data, пишут с write_data
personal  — личный, только владелец; можно поделиться через /tier/TOKEN
```

Публичная ссылка (`tier_share_links.is_public=true`) доступна без авторизации
через RPC `view_shared_tier(token)` — доступна `anon` через явный `GRANT EXECUTE TO anon`.

---

### RPC-функции (SECURITY DEFINER)

| Функция | Доступ | Описание |
|---------|--------|---------|
| `create_team(name, description)` | authenticated | Атомарно создаёт команду + роли + добавляет создателя как manager |
| `accept_invite(token)` | authenticated | Принимает инвайт. Проверяет иерархию ролей |
| `view_shared_tier(token)` | anon, authenticated | Просмотр тир-листа по токену, +1 к счётчику просмотров |
| `app_role()` | all | Возвращает `app_metadata.app_role` из JWT |
| `is_superadmin()` | authenticated | `app_role() = 'superadmin'` |
| `is_app_admin()` | authenticated | `app_role() IN ('superadmin','admin')` |
| `has_permission(team_id, key)` | authenticated | Проверяет право через role_permissions |
| `my_team_role(team_id)` | authenticated | Ключ роли текущего пользователя в команде |
| `can_write_team / can_manage_roles / ...` | authenticated | Шорткаты для часто используемых прав |

---

## Алгоритм скоринга

### Сила героя на карте

`heroStrengthOnMap(heroName, map, side)` — читает `heroMapStrength[hero][map].atk/def/avg`.
Для Control/Push/Flashpoint только `atk` (нет сторон атаки/защиты).

### Рекомендации банов

1. Для каждого героя в пуле игрока — берём его `counters[]`
2. `weight = 2` для `mainHeroes`, `1` для `poolHeroes`
3. Суммируем `score × weight` по всем контрпикам
4. Сортируем по `avg`, порог рекомендации ≥ 5

### Рекомендации пика

```
scoreComposition(comp, map, side, bans, enemyHeroes):
  + heroStrengthOnMap × 1.5
  + hero.priority × 0.5
  + counter.score × 0.8
  + compSynergyTotal × 0.7
```

---

## Sheets-экспорт (опциональный)

`sheets-bridge.js` использует отдельный Google OAuth (не Supabase Auth) со scope
`spreadsheets`. Доступен только ролям с правом `export_sheets`. Экспорт
односторонний (Supabase → Sheets).

---

## Build & Deploy

```bash
# Локально
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID
./build.sh             # → dist/index.html

# Продакшен — автоматически при push в main
# GitHub Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID
```

Порядок JS-модулей в `build.sh`:
```
core/store → core/config
auth/auth → auth/session → auth/team → auth/ui
data/db-load → data/db-write → data/db-sync → data/sheets-bridge
scoring/scoring-maps → scoring-bans → scoring-comp
picker/picker-core → picker-counters → picker-comp
modals/modal-hero → modal-hero-chips → modal-hero-strength → modal-map
render/render-utils → render-maps → render-heroes → render-tiers → render-tier-share
       → render-players → render-roster → render-nav
draft/render-bans-core → render-bans-competitive → render-bans-tournament-draft
     → render-bans-tournament-herobans → render-draft-comp
```
