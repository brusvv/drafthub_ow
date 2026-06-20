# DraftHub OW — Architecture

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS, собирается в один `dist/index.html` через `build.sh` |
| База данных | Supabase (PostgreSQL) |
| Авторизация | Supabase Auth — email/пароль, Google OAuth, Discord OAuth |
| Экспорт | Google Sheets API v4 (опциональный, отдельный OAuth — не связан с Supabase Auth) |
| Деплой | GitHub Pages (GitHub Actions → build.sh → dist/) |

---

## Структура файлов

```
drafthub_ow/
├── build.sh                  # Сборщик → dist/index.html, обновляет @hash в исходниках
├── update_hash.py            # Хелпер для build.sh — версионирование файлов
├── .env                      # Локально (в .gitignore)
├── .env.example               # Шаблон, коммитится
├── .gitignore
├── .github/workflows/deploy.yml   # CI/CD: push → build → GitHub Pages
│
├── src/
│   ├── html/
│   │   ├── auth.html         # Пустой контейнер — формы рендерятся динамически (auth/ui.js)
│   │   ├── main-app.html     # Layout, nav (+ вкладка Настройки), team switcher в хедере
│   │   ├── modal-hero.html / modal-map.html / modal-player.html
│   │   ├── picker.html
│   │   └── map-str-picker.html
│   │
│   ├── css/
│   │   ├── base/
│   │   │   ├── base.css
│   │   │   ├── auth.css      # Формы входа, member-row, role-card, team-switcher
│   │   │   └── responsive.css
│   │   ├── features/  { maps, heroes, players, tiers, subroles }.css
│   │   ├── modals/     { modals, strength }.css
│   │   └── draft/      { bans, draft-comp }.css
│   │
│   └── js/
│       ├── core/
│       │   ├── store.js      # Реактивное хранилище состояния
│       │   └── config.js     # Wiki-иконки, портреты, цвета ролей, imgH
│       │
│       ├── auth/             # Вся логика авторизации и команд
│       │   ├── auth.js       # Supabase client, dbSelect/Insert/Update/Delete
│       │   ├── session.js    # Сессия, активная команда, геттеры прав, /tier и /join роутинг
│       │   ├── team.js       # Команды, участники, кастомные роли, инвайты
│       │   └── ui.js         # Формы входа/регистрации, панель настроек, админка ролей
│       │
│       ├── data/
│       │   ├── db-load.js    # SELECT из Supabase → heroes/maps/players + 3 уровня тиров
│       │   ├── db-write.js   # INSERT/UPDATE/DELETE + saveTierOrder + share-ссылки
│       │   ├── db-sync.js    # Seed стартовых данных, smartSyncSeed
│       │   └── sheets-bridge.js # Экспорт снимка в Google Sheets (отдельный OAuth)
│       │
│       ├── scoring/   { scoring-maps, scoring-bans, scoring-comp }.js
│       ├── picker/    { picker-core, picker-counters, picker-comp }.js
│       ├── modals/    { modal-hero(+chips,+strength), modal-map }.js
│       │
│       ├── render/
│       │   ├── render-utils.js     # renderCurrentView (+settings), Esc-обработчик
│       │   ├── render-maps.js / render-heroes.js
│       │   ├── render-tiers.js     # Drag&drop + переключатель global/team/personal
│       │   ├── render-tier-share.js # Share-панель + публичный просмотр /tier/TOKEN
│       │   ├── render-players.js / render-roster.js
│       │   └── render-nav.js       # showView, toast, esc
│       │
│       └── draft/
│           ├── render-bans-core.js               # _renderBanRecs (shared)
│           ├── render-bans-competitive.js        # Голосование за баны
│           ├── render-bans-tournament-draft.js   # Вето карт
│           ├── render-bans-tournament-herobans.js # Баны героев по картам
│           └── render-draft-comp.js              # Альтернативный flow рекомендаций пика
│
└── supabase/
    ├── 001_initial_schema.sql        # Таблицы, индексы, триггеры
    ├── 002_rls.sql                   # Row Level Security (базовые политики)
    ├── 003_custom_roles.sql          # Кастомные роли с битовыми правами
    ├── 004_update_data_policies.sql  # RLS под новые права
    └── 005_personal_tiers.sql        # Три уровня тир-листов + share-ссылки
```

---

## База данных

### Таблицы

| Таблица | Описание |
|---------|---------|
| `teams` | Команды. Триггер при создании → 4 системные роли в `team_roles` |
| `team_members` | Участники. `role_id → team_roles` |
| `team_roles` | Роли с битовыми правами. `is_system=true` — нельзя удалить/изменить. `is_hidden=true` — видна только тем, кто управляет ролями |
| `team_invites` | Ссылки `/join/TOKEN`. `role_id`, `expires_at`, `max_uses` |
| `heroes` | Герои per-team. `counters` — jsonb `[{name, score}]` |
| `maps` | Карты per-team. `preferred_heroes`, `ban_heroes`, `counters` — arrays; `comp` — jsonb |
| `hero_map_strength` | Сила героя на карте: `atk`, `def` (0–10). PK = `(team_id, hero_name, map_name)` |
| `hero_synergy` | Синергии: `score` (1–10). PK = `(team_id, hero_name, synergy_hero)` |
| `players` | Ростер команды. `main_heroes`, `pool_heroes` — arrays, опциональный `user_id` |
| `tier_data` | Тир-листы команды/личные. `scope` ('team'\|'personal'), `user_id` для личных |
| `global_tier_data` | Единый тир-лист всего приложения. Пишет только суперадмин |
| `tier_share_links` | Публичные/приватные ссылки `/tier/TOKEN` на личный тир-лист |
| `sheets_tokens` | Sheet ID для экспорта. PK = `team_id` |

### Система ролей

```
Права (team_roles)         admin  coach  player  viewer
──────────────────────────────────────────────────────
can_read_game_data          ✓      ✓       ✓       ✗
can_read_roster              ✓      ✓       ✓       ✗
can_write_data                ✓      ✓       ✗       ✗
can_manage_roles              ✓      ✗       ✗       ✗
can_manage_invites            ✓      ✓       ✗       ✗
can_export_sheets             ✓      ✓       ✗       ✗
can_delete_team                ✓      ✗       ✗       ✗

viewer-исключение: tier_data (scope='team') видят все члены команды
                    у кого can_read_game_data ИЛИ кастомная роль с key LIKE 'team_%'
```

Кастомные роли создаются через UI (Настройки → Роли) с любым набором прав.
Скрытые роли (`is_hidden=true`) не видны в выпадающих списках участникам
без `can_manage_roles` — полезно для служебных ролей вроде "наблюдатель турнира".

### Тир-листы — три уровня

```
global    — один на всё приложение, пишет только суперадмин (app_metadata.is_superadmin)
team      — командный, видят admin/coach/роль team_*, пишут admin/coach
personal  — личный, видит и пишет только владелец; можно поделиться ссылкой /tier/TOKEN
```

Переключение между уровнями (`switchTierMode()`) происходит без перезагрузки —
все три набора данных грузятся параллельно в `loadTiers()`, дальше это просто
смена указателя `tierOrderMaps`/`tierOrderHeroes` на нужный объект.

Публичная ссылка на личный тир-лист (`tier_share_links.is_public=true`) доступна
**без авторизации** через RPC `view_shared_tier()` — анонимный SELECT исключён
явным `GRANT EXECUTE ... TO anon`.

### RLS-функции (SECURITY DEFINER)

```sql
my_team_permissions(team_id) → team_roles  -- полный объект прав текущего пользователя
can_write_team / can_read_game_data / can_read_roster /
can_manage_roles / can_manage_invites / can_export_sheets / can_delete_team_perm
accept_invite(token)         → jsonb        -- принятие инвайта
view_shared_tier(token)      → jsonb        -- просмотр публичного/приватного тир-листа
```

---

## Алгоритм скоринга

### Сила героя на карте
`heroStrengthOnMap(heroName, map, side)` — читает `heroMapStrength[hero][map].atk/def/avg`.
Для Control/Push/Flashpoint только `atk` (нет сторон).

### Рекомендации банов
1. Для каждого героя в пуле игрока — берём его `counters[]`
2. `weight = 2` для `mainHeroes`, `1` для `poolHeroes`
3. Суммируем `score × weight` по всем контрпикам
4. Сортируем по `avg`, порог рекомендации ≥ 5

### Рекомендации пика
```
scoreComposition(comp, map, side, bans, enemyHeroes):
  + heroStrengthOnMap × 1.5   (сила на карте)
  + hero.priority × 0.5       (метовый приоритет)
  + counter.score × 0.8       (контрпики к врагам)
  + compSynergyTotal × 0.7    (синергии внутри состава)
```
Перебирает топ-4 кандидата на каждую роль → max 4×4×4 = 64 комбо → топ-3.

> Сейчас в проекте два независимых подхода к рекомендациям состава:
> голосование (`render-bans-competitive.js`) и пошаговый flow с явным
> выбором героев/банов (`render-draft-comp.js`). Решение о том, оставлять
> ли оба или унифицировать в один — открытый вопрос дальнейшей разработки.

---

## Sheets-экспорт (опциональный)

`sheets-bridge.js` использует **отдельный** Google OAuth (через Google Identity
Services, не Supabase Auth) со scope `spreadsheets`. Доступен только ролям
с `can_export_sheets=true`. Экспорт односторонний (Supabase → Sheets),
импорт обратно не выполняется — это просто снимок для отчётности.

---

## Build & Deploy

```bash
# Локальная разработка
cp .env.example .env   # заполнить SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID
./build.sh             # → dist/index.html (также обновляет @hash в src/)

# Продакшен — автоматически при git push в main
# GitHub Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID
# Деплой через actions/deploy-pages — без сторонних сервисов
```

`build.sh` дополнительно вызывает `update_hash.py` — проставляет `@hash` в
шапку каждого изменённого `.js`/`.css` файла, GitHub Action коммитит эти
изменения отдельным коммитом `[skip ci]` чтобы не плодить циклы.

---

## Порядок применения SQL миграций

```
supabase/001_initial_schema.sql
supabase/002_rls.sql
supabase/003_custom_roles.sql
supabase/004_update_data_policies.sql
supabase/005_personal_tiers.sql
```

Применять через Supabase → SQL Editor → New query, по очереди, в этом порядке.
