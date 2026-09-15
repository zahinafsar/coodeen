#!/usr/bin/env bash
set -euo pipefail

SRC="${SRCROOT}/../desktop/resources/bin/opencode"
DEST_DIR="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/bin"

if [ ! -f "$SRC" ]; then
  if [ "${CONFIGURATION}" = "Release" ]; then
    echo "error: opencode binary not found at $SRC. Run: bun run --cwd apps/desktop fetch-opencode"
    exit 1
  fi
  echo "warning: opencode binary not found at $SRC. Run: bun run --cwd apps/desktop fetch-opencode"
  exit 0
fi

mkdir -p "$DEST_DIR"
if [ ! -f "$DEST_DIR/opencode" ] || [ "$SRC" -nt "$DEST_DIR/opencode" ]; then
  cp -f "$SRC" "$DEST_DIR/opencode"
  chmod +x "$DEST_DIR/opencode"
fi

IDENTITY="${EXPANDED_CODE_SIGN_IDENTITY:-}"
if [ -z "$IDENTITY" ]; then
  IDENTITY="-"
fi

codesign --force --options runtime --timestamp=none \
  --entitlements "${SRCROOT}/Coodeen/Coodeen.entitlements" \
  --sign "$IDENTITY" "$DEST_DIR/opencode"
