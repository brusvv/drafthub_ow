# Draft Hub — Overwatch Team Analyst

Аналитический дашборд для драфта команды. Данные хранятся в Google Sheets.

## Структура репозитория

```
draft-hub/
├── src/
│
│   ├── css/
│   │   ├── base.css            # Header, navigation, filters, auth, buttons
│   │   ├── maps.css            # Map cards, map details, map layouts
│   │   ├── heroes.css          # Hero pool, hero cards, hero views
│   │   ├── bans.css            # Hero bans, counter picks, ban displays
│   │   ├── modals.css          # All modals, DOT rating controls
│   │   ├── players.css         # Player cards, player profiles
│   │   ├── subroles.css        # Tank/DPS/Support subrole styling
│   │   └── tiers.css           # Tier list board, tier preview popup
│
│   ├── html/
│   │   ├── auth.html           # Login screen and OAuth UI
│   │   ├── main-app.html       # Main application shell and views
│   │   ├── modal-hero.html     # Hero editor modal
│   │   ├── modal-map.html      # Map editor modal with DOT difficulty rating
│   │   └── picker.html         # Hero picker overlay
│
│   └── js/
│       ├── config.js           # Global constants, state, helpers, image URLs
│       ├── auth.js             # Google OAuth login/logout logic
│       ├── sheets.js           # Sheets API, loading, parsing, seed logic
│       ├── write.js            # Save, update, delete operations
│       ├── picker.js           # Hero picker interactions and filtering
│       ├── modals.js           # Modal logic, DOT rating handlers
│
│       ├── render-utils.js     # Shared render helpers and utility functions
│       ├── render-nav.js       # Navigation rendering and view switching
│
│       ├── render-maps.js      # Map list, map cards, map details
│       ├── render-heroes.js    # Hero pool rendering and filters
│       ├── render-bans.js      # Ban board and counter rendering
│       ├── render-tiers.js     # Tier list rendering and preview popup
│       ├── render-players.js   # Players page rendering
│       └── render-roster.js    # Team roster builder and role limits
│
├── dist/
│   └── index.html              # Generated production build (auto-created)
│
├── build.sh                    # Build script: bundles HTML/CSS/JS into dist
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages auto-deploy workflow
│
└── .gitignore                  # Ignored files and build artifacts
```

## Локальная разработка

```bash
./build.sh                 # собирает dist/index.html
open dist/index.html       # открыть в браузере (macOS)
xdg-open dist/index.html   # Linux
```

## Деплой на GitHub Pages

1. Репозиторий → **Settings → Pages**
2. Source: **GitHub Actions**
3. Сделай пуш в `main` — Actions соберёт и задеплоит автоматически

## Настройка Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → создай проект
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
3. Authorized JavaScript origins: `https://<username>.github.io`
4. Скопируй Client ID и вставь в поле на экране входа

## Настройка Google Sheets

Создай таблицу с листами:
- `Heroes` — колонки: `name, role, subrole, priority, banned, notes`
- `Maps` — колонки: `name, type, tier, priority, atk, def, dif, notes`
- `MapPreferred` — колонки: `map, hero`
- `MapBans` — колонки: `map, hero`
- `Compositions` — колонки: `map, hero, role`

Или нажми кнопку **⬇ Seed** в приложении — заполнит стартовыми данными.
