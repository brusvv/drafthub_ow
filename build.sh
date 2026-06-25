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

cat > "$OUT" <<'HEADER'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Draft Hub — Team Analyst</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js"></script>
<style>
HEADER

# CSS — base первым, потом features, modals, draft, responsive последним
CSS_FILES=(
  css/base/base.css
  css/base/auth.css
  css/features/maps.css
  css/features/heroes.css
  css/features/players.css
  css/features/subroles.css
  css/features/tiers.css
  css/modals/modals.css
  css/modals/strength.css
  css/draft/bans.css
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
  js/core/config.js

  # Auth: Supabase client → session → team → ui
  js/auth/auth.js
  js/auth/session.js
  js/auth/team.js
  js/auth/ui.js

  # Data: load до write (write использует структуры из load)
  js/data/db-load.js
  js/data/db-write.js
  js/data/db-sync.js
  js/data/sheets-bridge.js

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
  js/render/render-maps.js
  js/render/render-heroes.js
  js/render/render-tiers.js
  js/render/render-tier-share.js
  js/render/render-players.js
  js/render/render-roster.js
  js/render/render-admin-import.js
  js/render/render-admin-ui.js
  js/render/render-nav.js

  # Draft: core первый (общие хелперы для competitive и tournament)
  js/draft/render-bans-core.js
  js/draft/render-bans-competitive.js
  js/draft/render-bans-tournament-draft.js
  js/draft/render-bans-tournament-herobans.js
  js/draft/render-draft-comp.js
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

cat >> "$OUT" <<'FOOTER'
</script>
<script async defer src="https://accounts.google.com/gsi/client"
  onload="initSheetsBridge('__GOOGLE_CLIENT_ID__')"></script>
</body>
</html>
FOOTER

sed -i "s|__GOOGLE_CLIENT_ID__|${GOOGLE_CLIENT_ID}|g" "$OUT"

echo "✓ Собрано: $OUT ($(wc -l < "$OUT") строк)"
