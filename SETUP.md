# DraftHub OW — Setup Guide

## Требования

- Git
- bash (macOS/Linux встроен; Windows — Git Bash или WSL)
- Аккаунт [Supabase](https://supabase.com) (бесплатный план подходит)
- Google Cloud проект (для OAuth-логина + опционального Sheets-экспорта)
- Discord Developer аккаунт (для Discord-логина)

---

## Шаг 1 — Supabase

### 1.1 Создать проект
[supabase.com](https://supabase.com) → New project. Запомни пароль БД.

### 1.2 Применить миграции
SQL Editor → New query → запусти **по очереди**:
```
supabase/001_initial_schema.sql
supabase/002_rls.sql
supabase/003_custom_roles.sql
supabase/004_update_data_policies.sql
supabase/005_personal_tiers.sql
```

### 1.3 Скопировать ключи
Settings → API:
- `Project URL` → `SUPABASE_URL`
- `anon public` → `SUPABASE_ANON_KEY`

> `anon key` — публичный, безопасно хранить в коде. Безопасность даёт RLS.
> `service_role key` — никогда не используй на клиенте.

### 1.4 OAuth провайдеры
Authentication → Providers:

**Google:** [console.cloud.google.com](https://console.cloud.google.com) → New project →
Credentials → OAuth 2.0 Client ID → redirect URI `https://[проект].supabase.co/auth/v1/callback`

**Discord:** [discord.com/developers](https://discord.com/developers) → New Application →
OAuth2 → Redirects → `https://[проект].supabase.co/auth/v1/callback`

### 1.5 Назначить суперадмина (для глобального тир-листа)
Authentication → Users → выбери себя → Edit → `app_metadata`:
```json
{ "is_superadmin": true }
```

---

## Шаг 2 — Google Cloud (для Sheets-экспорта, опционально)

1. Тот же проект что в 1.4 → APIs & Services → Enable APIs → **Google Sheets API**
2. Credentials → OAuth 2.0 Client ID (Web application)
3. Authorised JavaScript origins: `https://твой-домен.github.io` и `http://localhost`
4. Скопируй Client ID → `GOOGLE_CLIENT_ID`

---

## Шаг 3 — Репозиторий

```bash
git clone https://github.com/ты/drafthub-ow
cd drafthub-ow
cp .env.example .env
```

Заполни `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

```bash
./build.sh
open dist/index.html
```

---

## Шаг 4 — GitHub Pages

1. Репо → Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions → New repository secret:

| Secret | Значение |
|--------|---------|
| `SUPABASE_URL` | из шага 1.3 |
| `SUPABASE_ANON_KEY` | из шага 1.3 |
| `GOOGLE_CLIENT_ID` | из шага 2 |

3. `git push origin main` — Actions соберёт и опубликует автоматически

---

## Первый запуск

1. Открой сайт → зарегистрируйся (email или Google/Discord)
2. Создай команду → автоматически становишься admin
3. Настройки → Sync → заполнит стартовыми героями и картами
4. Настройки → Инвайты → создай ссылку для игроков/тренеров

---

## Локальная разработка

```bash
./build.sh   # пересобирает dist/index.html после изменений в src/
```

Дев-сервер не нужен — всё работает как статичный HTML-файл.
