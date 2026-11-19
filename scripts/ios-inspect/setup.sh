#!/usr/bin/env bash
# Prépare Chromium pour l'inspection iOS sur Linux / WSL sans droits root.
# On utilise le Chromium embarqué de Playwright (Google Chrome n'est pas requis), et
# les bibliothèques système manquantes sont extraites dans .playwright/libs.
set -euo pipefail
cd "$(dirname "$0")/../.."

LIB_ROOT=".playwright/libs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"

npx playwright install chromium

SHELL_BIN=$(find "$HOME/.cache/ms-playwright" -name chrome-headless-shell -type f | sort | tail -1)
MISSING=$(LD_LIBRARY_PATH="$LIB_DIR" ldd "$SHELL_BIN" | awk '/not found/ {print $1}')
if [ -z "$MISSING" ]; then
  echo "✓ Chromium prêt (aucune bibliothèque manquante)"
  exit 0
fi

echo "Bibliothèques manquantes : $MISSING"
mkdir -p "$LIB_ROOT/debs"
(
  cd "$LIB_ROOT/debs"
  apt-get download libnspr4 libnss3
  apt-get download libasound2t64 2>/dev/null || apt-get download libasound2
)
for deb in "$LIB_ROOT"/debs/*.deb; do dpkg-deb -x "$deb" "$LIB_ROOT"; done

STILL=$(LD_LIBRARY_PATH="$LIB_DIR" ldd "$SHELL_BIN" | awk '/not found/ {print $1}')
if [ -n "$STILL" ]; then
  echo "✗ Toujours manquantes : $STILL" >&2
  exit 1
fi
echo "✓ Chromium prêt (bibliothèques extraites dans $LIB_DIR)"
