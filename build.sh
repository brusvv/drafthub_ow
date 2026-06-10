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
for css in base maps heroes bans modals players subroles tiers; do
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
for part in auth main-app modal-hero modal-map modal-player picker; do
  cat "$SRC/html/${part}.html" >> "$OUT"
done

echo '<div class="toast" id="toast"></div>' >> "$OUT"
echo '<script>'                             >> "$OUT"

# JS-модули (порядок важен)
for module in store config auth sheets write picker modals; do
  echo ""                          >> "$OUT"
  echo "// ── ${module}.js ──"    >> "$OUT"
  cat "$SRC/js/${module}.js"       >> "$OUT"
done

# Render — разбит по вкладкам
for module in render-utils render-maps render-heroes render-bans render-tiers render-players render-roster render-nav; do
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
