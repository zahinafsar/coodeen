#!/usr/bin/env bash
set -euo pipefail

APP="$1"
OUT="$2"
NAME="Coodeen-mac-arm64"

if [ ! -d "$APP" ]; then
  echo "App not found at $APP"
  exit 1
fi

SIDECAR="$APP/Contents/Resources/bin/opencode"
if [ ! -x "$SIDECAR" ]; then
  echo "Bundled opencode sidecar missing at $SIDECAR"
  exit 1
fi

if ! lipo -archs "$APP/Contents/MacOS/Coodeen" | grep -q arm64; then
  echo "App binary is not arm64"
  exit 1
fi

"$SIDECAR" --version
codesign --verify --deep --strict --verbose=2 "$APP"

rm -rf "$OUT"
mkdir -p "$OUT"

ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/$NAME.zip"
bash "$(dirname "$0")/make-dmg.sh" "$APP" "$OUT/$NAME.dmg"
hdiutil verify "$OUT/$NAME.dmg"

ls -lh "$OUT"
