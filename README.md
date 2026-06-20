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
# применить миграции из supabase/*.sql в Supabase SQL Editor (по порядку 001→005)
./build.sh                  # → dist/index.html
```

## Структура проекта

```
src/
  css/
    base/         — base.css, auth.css, responsive.css
    features/     — maps, heroes, players, subroles, tiers
    modals/       — modals.css, strength.css
    draft/        — bans.css, draft-comp.css
  js/
    core/         — store.js, config.js
    auth/         — auth.js (Supabase client), session.js, team.js, ui.js
    data/         — db-load.js, db-write.js, db-sync.js, sheets-bridge.js
    scoring/      — scoring-maps, scoring-bans, scoring-comp
    picker/       — picker-core, picker-counters, picker-comp
    modals/       — modal-hero(+chips,+strength), modal-map
    render/       — render-utils, maps, heroes, tiers(+tier-share), players, roster, nav
    draft/        — render-bans-core, competitive, tournament-draft,
                    tournament-herobans, render-draft-comp
  html/           — auth, main-app, modals, pickers
supabase/
  001_initial_schema.sql        — таблицы, индексы, триггеры
  002_rls.sql                   — Row Level Security
  003_custom_roles.sql          — кастомные роли с битовыми правами
  004_update_data_policies.sql  — RLS под кастомные роли
  005_personal_tiers.sql        — три уровня тир-листов + share-ссылки
dist/
  index.html      — собранный файл (build.sh)
```

## Подробная архитектура

См. [`ARCHITECTURE.md`](./ARCHITECTURE.MD) — схема БД, система прав, алгоритм скоринга.

## Деплой

GitHub Actions (`.github/workflows/deploy.yml`) собирает `build.sh` и публикует
`dist/` на GitHub Pages при каждом push в `main`. Секреты (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`) задаются в Settings → Secrets → Actions.
