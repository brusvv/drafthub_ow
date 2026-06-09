# Draft Hub — Overwatch Team Analyst

Аналитический дашборд для драфта команды. Данные хранятся в Google Sheets.

## Структура репозитория

```
draft-hub/
├── src/
│   ├── style.css          # Все стили
│   ├── html/
│   │   ├── auth.html      # Экран авторизации
│   │   ├── main-app.html  # Основное приложение (навигация, вьюхи)
│   │   ├── modal-hero.html  # Модальное окно героя
│   │   ├── modal-map.html   # Модальное окно карты
│   │   └── picker.html      # Hero picker overlay
│   └── js/
│       ├── config.js      # Константы, стейт, portrait/mapImg helpers
│       ├── auth.js        # Google OAuth, вход/выход
│       ├── sheets.js      # Sheets API + loadHeroes/loadMaps/seed
│       ├── write.js       # saveHero / saveMap / deleteHero / deleteMap
│       ├── picker.js      # Hero picker логика
│       ├── modals.js      # openHeroModal / openMapModal
│       └── render.js      # renderMaps/Heroes/Tiers/Bans + утилиты
├── dist/                  # Генерируется при сборке (не коммитить)
│   └── index.html
├── build.sh               # Локальная сборка
├── .github/
│   └── workflows/
│       └── deploy.yml     # Автодеплой на GitHub Pages при пуше в main
└── .gitignore
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
