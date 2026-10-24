#!/usr/bin/env bash
# Opens QGIS with the demo's PostGIS view and saves a screenshot to
# assets/screenshots/qgis-spatial-view.png. Uses a throwaway QGIS profile so
# your own settings and plugins aren't touched.
#
#   scripts/qgis/capture-qgis-screenshot.sh
#
#   QGIS_APP  default /Applications/QGIS-final-4_2_3.app
set -euo pipefail

deck_directory="$(cd "$(dirname "$0")/../.." && pwd)"
qgis_app="${QGIS_APP:-/Applications/QGIS-final-4_2_3.app}"
qgis_binary="$(find "$qgis_app/Contents/MacOS" -maxdepth 1 -name 'QGIS*' -type f | head -1)"
profiles_directory="$(mktemp -d)"
trap 'rm -rf "$profiles_directory"' EXIT

export QGIS_SCREENSHOT_PATH="$deck_directory/assets/screenshots/qgis-spatial-view.png"
"$qgis_binary" \
    --nologo \
    --noversioncheck \
    --noplugins \
    --profiles-path "$profiles_directory" \
    --code "$deck_directory/scripts/qgis/capture_qgis_screenshot.py"

# The slide needs the map and attribute table to be readable when projected,
# so crop away QGIS's toolbars, layer panel and status bar.
ffmpeg -v error -y -i "$QGIS_SCREENSHOT_PATH" \
    -vf "crop=2580:1520:600:160" \
    "$deck_directory/assets/screenshots/qgis-spatial-view-cropped.png"
