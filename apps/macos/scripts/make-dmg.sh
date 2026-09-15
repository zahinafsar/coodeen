#!/usr/bin/env bash
set -euo pipefail

APP="$1"
DMG="$2"

if [ ! -d "$APP" ]; then
  echo "App not found at $APP. Build the app first."
  exit 1
fi

STAGE="$(mktemp -d)"
ditto "$APP" "$STAGE/Coodeen.app"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -volname Coodeen -srcfolder "$STAGE" -ov -format UDZO "$DMG"
rm -rf "$STAGE"
echo "Created $DMG"
