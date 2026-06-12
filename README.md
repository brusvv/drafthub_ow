# Draft Hub — Overwatch Team Analyst

Инструмент для анализа банов, карт и состава в Overwatch.
Хостится на GitHub Pages. Данные хранятся в Google Sheets.

## Структура проекта

```
src/
  css/
    base/         — base.css, responsive.css
    features/     — maps, heroes, players, subroles, tiers
    modals/       — modals.css, strength.css
    draft/        — bans.css, draft-comp.css
  js/
    core/         — store, config, auth
    data/         — sheets-load, sheets-sync
    scoring/      — scoring-maps, scoring-bans, scoring-comp
    write/        — write-hero, write-map, write-player
    picker/       — picker-core, picker-counters, picker-maps, picker-comp
    modals/       — modal-hero, modal-map
    render/       — render-utils, maps, heroes, tiers, players, roster, nav
    draft/        — render-bans-core, competitive, tournament-draft,
                    tournament-herobans, render-draft-comp
  html/           — auth, main-app, modals, pickers
dist/
  index.html      — собранный файл (build.sh)
```

## Google Sheets — листы

| Лист | Колонки | Назначение |
|------|---------|------------|
| Heroes | name, role, subrole, priority, banned, notes, counters | Герои |
| Maps | name, type, tier, priority, atk, def, dif, notes | Карты |
| MapPreferred | map, hero | Предпочтительные герои карты |
| MapBans | map, hero | Цели для банов на карте |
| Compositions | map, hero, role, playerRole | Состав для карты |
| MapCounters | map, hero | Контрпики карты |
| Players | name, btag, mainrole, offrole, ranktank, rankdmg, ranksup, notes | Игроки |
| PlayerHeroes | player, hero, type | Пул героев игроков |
| TierMaps | name, tier | Тир-лист карт |
| TierHeroes | name, tier | Тир-лист героев |
| HeroMapStrength | hero, map, atk, def | Сила героя на картах (1–10) |
| HeroSynergy | hero, synergy_hero, score | Синергии героев (1–10) |

### Типы карт и оценки

- **Hybrid / Escort**: atk + def (1–10)
- **Control / Flashpoint / Push**: только `atk` как общая сила (def игнорируется)

## Сборка

```bash
./build.sh          # → dist/index.html
```

## Настройка

1. Создай Google Cloud проект, включи Sheets API, получи OAuth Client ID
2. Добавь Client ID в настройки приложения
3. Создай Google Sheets таблицу
4. Нажми «Синхронизировать» — листы создадутся автоматически

## Вкладки

- **Карты** — обзор карт с тирами, оценками, банами
- **Герои** — пул героев с ролями и приоритетами
- **Tier List** — перетаскиваемые тир-листы карт и героев
- **Драфт** — соревновательные баны (голосование) и турнирный драфт
- **Игроки** — пул героев, рекомендации банов и карт
- **Состав** — сборка состава с рекомендациями банов и карт
