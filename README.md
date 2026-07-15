# Draft Hub — Overwatch Team Analyst

Инструмент для анализа банов, карт и состава в Overwatch 2.
Многотенантный: любой может создать команду, пригласить участников и настроить роли.

Хостится на GitHub Pages. Данные хранятся в Supabase (PostgreSQL).
Опционально — экспорт снимка данных в Google Sheets.

## Возможности

- **Герои и карты** — база с силой героя на каждой карте (ATK/DEF), синергиями, контрпиками
- **Tier-листы** — три уровня: глобальный (для всего приложения), командный, личный с публичными ссылками
- **Драфт** — соревновательный режим (голосование за баны) и турнирный (FACEIT/OWCS-style пул карт + баны)
- **Роли** — admin/coach/player/viewer "из коробки" + кастомные роли с гибкими правами, включая скрытые
- **Инвайты** — ссылки `/join/TOKEN` с ролью, лимитом использований и сроком действия
- **Google Sheets экспорт** — снимок данных команды одной кнопкой (для отчётности)

## Быстрый старт

См. подробный гайд: [`SETUP.md`](./SETUP.md)

```bash
cp .env.example .env        # заполнить SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID
# применить миграции из supabase/*.sql в Supabase SQL Editor по порядку — см. SETUP.md §1.2
./build.sh                  # → dist/index.html
```

## Структура проекта

```
src/
  css/
    admin.css     — вкладка «Админ»
    base/         — base.css, auth.css, responsive.css, skeleton.css
    features/     — maps, heroes, players, subroles, tiers
    modals/       — modals.css, strength.css
    draft/        — bans.css, draft-comp.css
  js/
    core/         — store.js, config.js, utils.js
    auth/         — auth.js (Supabase client), session.js, team.js, ui.js
    data/
      db/         — db-load(+tiers), db-write(+heroes,+maps)
      sheets/     — sheets-auth, sheets-export, sheets-import(+parse,+resolve,+ui), sheets-settings-panel
    scoring/      — scoring-maps, scoring-bans, scoring-comp
    picker/       — picker-core, picker-counters, picker-comp
    modals/       — modal-hero(+chips,+strength), modal-map
    render/       — render-utils, maps, heroes, players, roster, nav, notifications, modal-focus, skeleton-loaders
      admin/      — render-admin-ui, render-admin-import(+data)
      tiers/      — render-tiers(+dnd,+preview,+share)
    draft/        — render-bans-core, competitive, tournament-draft,
                    tournament-herobans, tournament-state, render-draft-comp
  html/           — auth, main-app, modals, pickers
supabase/
  001_tables.sql                       — таблицы, индексы, триггеры
  002_functions.sql                    — RLS-хелперы (app_role, is_superadmin, has_permission…)
  003_rls.sql                          — Row Level Security
  006_hero_counters.sql                — контрпики героев
  007_catalog_tables.sql               — hero_catalog / map_catalog
  008_catalog_rls.sql                  — RLS для каталога (superadmin write)
  009_catalog_seed.sql                 — сид каталога героев/карт
  010_catalog_team_seed_triggers.sql   — фан-аут новых записей каталога на команды
  011_rpc.sql                          — RPC (create_team, инвайты, admin, шеринг тир-листов…)
dist/
  index.html      — собранный файл (build.sh)
```

## Подробная архитектура

См. [`ARCHITECTURE.md`](./ARCHITECTURE.MD) — схема БД, система прав, алгоритм скоринга.

## Деплой

GitHub Actions (`.github/workflows/deploy.yml`) собирает `build.sh` и публикует
`dist/` на GitHub Pages при каждом push в `main`. Секреты (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`) задаются в Settings → Secrets → Actions.
