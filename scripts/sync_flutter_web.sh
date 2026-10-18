#!/usr/bin/env bash
# ينسخ واجهة الويب إلى أصول Flutter قبل البناء.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/mobile/assets/www"
rm -rf "$DEST"
mkdir -p "$DEST/css" "$DEST/js" "$DEST/fonts"
cp "$ROOT/index.html" "$ROOT/favicon.svg" "$DEST/"
cp -R "$ROOT/css/." "$DEST/css/"
cp -R "$ROOT/js/." "$DEST/js/"
cp -R "$ROOT/fonts/." "$DEST/fonts/"
echo "نُسخت واجهة الويب إلى mobile/assets/www"
