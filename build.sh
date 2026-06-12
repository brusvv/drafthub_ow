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

# CSS — порядок важен: base первым
for css in base maps heroes bans modals players subroles tiers strength draft-comp responsive; do
  echo "" >> "$OUT"
  echo "/* ── ${css}.css ── */" >> "$OUT"
  cat "$SRC/css/${css}.css" >> "$OUT"
done

cat >> "$OUT" <<'AFTER_CSS'
</style>
</head>
<body>
AFTER_CSS

# HTML-части
for part in auth main-app modal-hero modal-map modal-player picker map-str-picker; do
  cat "$SRC/html/${part}.html" >> "$OUT"
done

echo '<div class="toast" id="toast"></div>' >> "$OUT"
echo '<script>'                             >> "$OUT"

# Core: store → config → auth → данные
for module in store config auth; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Sheets: сначала load (sGet/sUp/loadHeroes...), потом sync (ensureSheets/seed)
for module in sheets-load sheets-sync; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Scoring: maps → bans → comp (порядок: зависимости сначала)
for module in scoring-maps scoring-bans scoring-comp; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Write: разбито по сущностям
for module in write-hero write-map write-player; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Picker: core → counters → maps → comp (каждый переопределяет confirmPicker)
for module in picker-core picker-counters picker-maps picker-comp; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Modals
for module in modal-hero modal-map; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Render — разбит по вкладкам
for module in \
  render-utils \
  render-maps \
  render-heroes \
  render-bans-core \
  render-bans-competitive \
  render-bans-tournament-draft \
  render-bans-tournament-herobans \
  render-draft-comp \
  render-tiers \
  render-players \
  render-roster \
  render-nav; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

cat >> "$OUT" <<'FOOTER'
</script>
<script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
<script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>
</body>
</html>
FOOTER

echo "✓ Собрано: $OUT ($(wc -l < "$OUT") строк)"
