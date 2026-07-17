#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Draft Hub — сборщик index.html из частей
# Использование: ./build.sh
# Результат:     dist/index.html
# ─────────────────────────────────────────────
set -e

SRC="src"
OUT="dist/index.html"
mkdir -p dist

echo "⟳ Сборка Draft Hub..."

# Определяем директорию build.sh — работает и локально, и в GitHub Actions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HASH_SCRIPT="$SCRIPT_DIR/update_hash.py"

# Обновляем @hash во всех JS и CSS исходниках
if command -v python3 &>/dev/null && [ -f "$HASH_SCRIPT" ]; then
  echo "  ↳ обновляем @hash..."
  find "$SRC/js" "$SRC/css" \( -name "*.js" -o -name "*.css" \) \
    | sort | xargs python3 "$HASH_SCRIPT" || echo "  ⚠ update_hash: некоторые файлы не обновлены (см. выше)"
else
  [ ! -f "$HASH_SCRIPT" ] && echo "  ⚠ update_hash.py не найден — @hash пропущен (путь: $HASH_SCRIPT)"
  command -v python3 &>/dev/null || echo "  ⚠ python3 не найден — @hash пропущен"
fi

# ── Подставляем Supabase / Google credentials из .env ──
if [ -f ".env" ]; then export $(grep -v '^#' .env | xargs); fi
SUPABASE_URL="${SUPABASE_URL:-__SUPABASE_URL__}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-__SUPABASE_ANON_KEY__}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-__GOOGLE_CLIENT_ID__}"
# Путь публикации GitHub Pages (репозиторий не в корне домена, а в подпапке).
# Единственное место где это значение задаётся руками — дальше распространяется
# через sed (__BASE_PATH__) в JS-бандл (config.js → BASE_PATH) и в 404.html.
# Переопределить: BASE_PATH=/other-path bash build.sh, или тем же ключом в .env.
BASE_PATH="${BASE_PATH:-/drafthub_ow}"

cat > "$OUT" <<'HEADER'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Draft Hub — Team Analyst</title>
<!-- SEC-1: CSP — домены только те что реально используются (Supabase REST/RPC,
     Google Sheets API + Identity Services для экспорта/импорта, overfast-api
     для скриншотов карт и как сам API-хост героев/карт, d15f34w2p8l1cc.
     cloudfront.net — реальный CDN где OverFast API хостит ПОРТРЕТЫ героев
     (отдельный домен от самого API — раньше не был в img-src, портреты
     героев молча блокировались CSP), jsdelivr для supabase-js). unsafe-inline на
     script/style нужен пока весь JS монолитный инлайн и style="" используется
     по всему коду — сужение это отдельный, гораздо больший рефакторинг.
     jsdelivr также в connect-src — браузер тянет .map файл (sourcemap) для
     отладки бандла supabase-js отдельным запросом, не подпадает под script-src.
     wss://*.supabase.co отдельно от https://*.supabase.co — БАГ (найден,
     BACK-3): CSP различает схемы, https:// НЕ покрывает wss:// автоматически,
     даже для того же хоста. Без явного wss:// Supabase Realtime (WebSocket)
     блокировался CSP на этапе connect, а не молча деградировал — ошибка
     в консоли, но обычный пользователь её не видит и решает что фича не работает.
     overwatch.fandom.com в connect-src (не img-src!) — MediaWiki API
     (action=query&prop=imageinfo) резолвит АКТУАЛЬНЫЙ URL иконки роли/
     подкласса/типа карты по стабильному имени файла вместо хардкода
     хеш-пути Wikia (config.js loadWikiIcons() — тот же паттерн что
     loadPortraits()/loadMapScreenshots()). Сама картинка при этом всё
     ещё грузится со static.wikia.nocookie.net (img-src, уже разрешён) —
     новый домен нужен только для запроса к api.php, не для самих svg/png. -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://static.wikia.nocookie.net https://overfast-api.tekrop.fr https://d15f34w2p8l1cc.cloudfront.net;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sheets.googleapis.com https://www.googleapis.com https://overfast-api.tekrop.fr https://cdn.jsdelivr.net https://overwatch.fandom.com;
  frame-src https://accounts.google.com;
  object-src 'none';
  base-uri 'self';
">
<!-- SEC-3: шрифт не блокирует первую отрисовку — preload+onload вместо
     прямого <link rel="stylesheet">, noscript-фолбэк для отключённого JS. -->
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"></noscript>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js"></script>
<style>
HEADER

# CSS — base первым, потом features, modals, draft, responsive последним
CSS_FILES=(
  css/base/base-reset.css
  css/base/tokens.css
  css/base/base-chrome.css
  css/base/base-utility.css
  css/base/skeleton.css
  css/base/auth.css
  css/features/maps.css
  css/features/heroes.css
  css/features/players.css
  css/features/subroles.css
  css/features/tiers.css
  css/modals/modals.css
  css/modals/strength.css
  css/modals/picker.css
  css/draft/bans.css
  css/draft/ban-recommendations.css
  css/draft/bans-tournament.css
  css/draft/draft-comp.css
  css/admin.css
  css/base/responsive.css
)
for f in "${CSS_FILES[@]}"; do
  echo "" >> "$OUT"
  echo "/* ── $f ── */" >> "$OUT"
  cat "$SRC/$f" >> "$OUT"
done

cat >> "$OUT" <<'AFTER_CSS'
</style>
</head>
<body>
AFTER_CSS

# HTML — порядок: auth, app, modals, pickers
HTML_PARTS=(
  auth
  main-app
  modal-hero
  modal-map
  modal-player
  picker
  map-str-picker
)
for part in "${HTML_PARTS[@]}"; do
  cat "$SRC/html/${part}.html" >> "$OUT"
done

echo '<div class="toast" id="toast"></div>' >> "$OUT"
echo '<script>'                             >> "$OUT"

# JS — строгий порядок зависимостей:
# core → auth → data → scoring → picker → modals → render → draft
JS_MODULES=(
  # Core: store первый (нужен всем), потом config (прокси)
  js/core/store.js
  js/core/utils.js
  js/core/config.js

  # Auth: Supabase client → session → team → ui
  js/auth/auth.js
  js/auth/session.js
  js/auth/team.js
  js/auth/ui.js

  # Data: load до write (write использует структуры из load).
  # db-write.js — общие хелперы + players/tiers/share-links.
  # db-write-heroes.js/db-write-maps.js вынесены отдельно (был 564-строчный
  # файл) — порядок после db-write.js неважен для выполнения (все объявления
  # через function, hoisting), важен только для читаемости диффа сборки.
  js/data/db/db-load.js
  js/data/db/db-load-tiers.js
  js/data/db/db-write.js
  js/data/db/db-write-heroes.js
  js/data/db/db-write-maps.js
  js/data/sheets/sheets-auth.js
  js/data/sheets/sheets-import-parse.js
  js/data/sheets/sheets-import-resolve.js
  js/data/sheets/sheets-import.js
  js/data/sheets/sheets-export.js
  js/data/sheets/sheets-import-ui.js
  js/data/sheets/sheets-settings-panel.js

  # Scoring: maps → bans → comp (comp зависит от maps)
  js/scoring/scoring-maps.js
  js/scoring/scoring-bans.js
  js/scoring/scoring-comp.js

  # Picker: core первый, потом расширения (каждое override confirmPicker)
  js/picker/picker-core.js
  js/picker/picker-counters.js
  js/picker/picker-comp.js

  # Modals: hero (+chips, +strength) и map
  js/modals/modal-hero.js
  js/modals/modal-hero-chips.js
  js/modals/modal-hero-strength.js
  js/modals/modal-map.js

  # Render: utils первый (showLoading, showError, esc)
  js/render/render-utils.js
  js/render/modal-focus.js
  js/render/notifications.js
  js/render/skeleton-loaders.js
  js/render/render-maps.js
  js/render/render-heroes.js
  js/render/tiers/render-tiers.js
  js/render/tiers/render-tiers-dnd.js
  js/render/tiers/render-tiers-preview.js
  js/render/tiers/render-tier-share-panel.js
  js/render/tiers/render-tier-share-public.js
  js/render/render-players.js
  js/render/render-roster.js
  js/render/admin/render-admin-import.js
  js/render/admin/render-admin-import-data.js
  js/render/admin/render-admin-ui.js
  js/render/render-nav.js

  # Draft: core первый (общие хелперы для competitive и tournament)
  js/draft/render-bans-core.js
  js/draft/render-bans-tournament-state.js
  js/draft/render-bans-competitive.js
  js/draft/render-bans-competitive-mappopup.js
  js/draft/render-bans-competitive-recs.js
  js/draft/render-bans-tournament-draft.js
  js/draft/render-bans-tournament-mapdraft.js
  js/draft/render-bans-tournament-herobans.js
  js/draft/render-draft-comp.js
  js/draft/render-draft-comp-bans.js
  js/draft/render-draft-comp-result.js
)

for f in "${JS_MODULES[@]}"; do
  echo ""                    >> "$OUT"
  echo "// ── $f ──"         >> "$OUT"
  cat "$SRC/$f"              >> "$OUT"
done

# Подставляем реальные ключи (anon key — публичный, безопасно для клиента)
sed -i "s|__SUPABASE_URL__|${SUPABASE_URL}|g"           "$OUT"
sed -i "s|__SUPABASE_ANON_KEY__|${SUPABASE_ANON_KEY}|g" "$OUT"
sed -i "s|__GOOGLE_CLIENT_ID__|${GOOGLE_CLIENT_ID}|g"   "$OUT"
sed -i "s|__BASE_PATH__|${BASE_PATH}|g"                 "$OUT"

cat >> "$OUT" <<'FOOTER'
</script>
<script async defer src="https://accounts.google.com/gsi/client"
  onload="initSheetsBridge('__GOOGLE_CLIENT_ID__')"></script>
</body>
</html>
FOOTER

sed -i "s|__GOOGLE_CLIENT_ID__|${GOOGLE_CLIENT_ID}|g" "$OUT"

# GitHub Pages SPA-роутинг: 404.html ловит прямые заходы на /tier/TOKEN
# и /join/TOKEN (см. src/html/404.html), редиректит на index.html того же
# каталога. Должен лежать в корне dist/ — GitHub Pages ищет 404.html
# только на корневом уровне опубликованного каталога.
cp "$SRC/html/404.html" "$(dirname "$OUT")/404.html"
sed -i "s|__BASE_PATH__|${BASE_PATH}|g" "$(dirname "$OUT")/404.html"

echo "✓ Собрано: $OUT ($(wc -l < "$OUT") строк)"
