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

# Обновляем @hash во всех JS и CSS исходниках
if command -v python3 &>/dev/null && [ -f update_hash.py ]; then
  find src/js src/css -name "*.js" -o -name "*.css" | xargs python3 update_hash.py 2>/dev/null
fi

cat > "$OUT" <<'HEADER'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Draft Hub — Team Analyst</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
HEADER

# CSS — base первым, потом features, modals, draft, responsive последним
CSS_FILES=(
  css/base/base.css
  css/features/maps.css
  css/features/heroes.css
  css/features/players.css
  css/features/subroles.css
  css/features/tiers.css
  css/modals/modals.css
  css/modals/strength.css
  css/draft/bans.css
  css/draft/draft-comp.css
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
# core → data → scoring → write → picker → modals → render → draft
JS_MODULES=(
  # Core: store первый (нужен всем), потом config (прокси), auth
  js/core/store.js
  js/core/config.js
  js/core/auth.js

  # Data: load до sync (sync использует sGet из load)
  js/data/sheets-load.js
  js/data/sheets-sync.js

  # Scoring: maps → bans → comp (comp зависит от maps)
  js/scoring/scoring-maps.js
  js/scoring/scoring-bans.js
  js/scoring/scoring-comp.js

  # Write: независимы друг от друга
  js/write/write-hero.js
  js/write/write-map.js
  js/write/write-player.js

  # Picker: core первый, потом расширения (каждое override confirmPicker)
  js/picker/picker-core.js
  js/picker/picker-counters.js
  js/picker/picker-maps.js
  js/picker/picker-comp.js

  # Modals: hero и map (используют picker и write)
  js/modals/modal-hero.js
  js/modals/modal-map.js

  # Render: utils первый (showLoading, showError, esc)
  js/render/render-utils.js
  js/render/render-maps.js
  js/render/render-heroes.js
  js/render/render-tiers.js
  js/render/render-players.js
  js/render/render-roster.js
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

cat >> "$OUT" <<'FOOTER'
</script>
<script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
<script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>
</body>
</html>
FOOTER

echo "✓ Собрано: $OUT ($(wc -l < "$OUT") строк)"
