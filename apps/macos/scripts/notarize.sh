#!/usr/bin/env bash
set -euo pipefail

APP="$1"
PROFILE="${COODEEN_NOTARY_PROFILE:?Set COODEEN_NOTARY_PROFILE to a notarytool keychain profile}"
ZIP="$(dirname "$APP")/Coodeen-notarize.zip"

ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$APP"
rm -f "$ZIP"
