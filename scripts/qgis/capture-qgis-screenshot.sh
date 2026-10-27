#!/usr/bin/env bash
# Opens QGIS with the demo's PostGIS view and the Arches QGIS plugin, and
# saves a screenshot to assets/screenshots/qgis-spatial-view.png. Uses a
# throwaway QGIS profile, with the plugin installed into it, so your own
# settings and plugins aren't touched.
#
#   scripts/qgis/capture-qgis-screenshot.sh
#
#   QGIS_APP            default /Applications/QGIS-LTR.app (the plugin needs
#                       QGIS 3: it imports PyQt5)
#   ARCHES_QGIS_BRANCH  default stable/1.0.0 (github.com/archesproject/arches-qgis)
#   ARCHES_URL          default http://localhost:8003
#
# Needs the demo instance running on ARCHES_URL, for the plugin's sign-in.
set -euo pipefail

deck_directory="$(cd "$(dirname "$0")/../.." && pwd)"
qgis_app="${QGIS_APP:-/Applications/QGIS-LTR.app}"
qgis_binary="$(find "$qgis_app/Contents/MacOS" -maxdepth 1 -name 'QGIS*' -type f | head -1)"
plugin_branch="${ARCHES_QGIS_BRANCH:-stable/1.0.0}"
profiles_directory="$(mktemp -d)"
trap 'rm -rf "$profiles_directory"' EXIT

plugin_checkout="$profiles_directory/arches-qgis"
git clone --quiet --depth 1 --branch "$plugin_branch" \
    https://github.com/archesproject/arches-qgis.git "$plugin_checkout"
profile_directory="$profiles_directory/profiles/default"
mkdir -p "$profile_directory/python/plugins" "$profile_directory/QGIS"
cp -R "$plugin_checkout/arches_project" "$profile_directory/python/plugins/"
cat > "$profile_directory/QGIS/QGIS3.ini" <<'SETTINGS'
[PythonPlugins]
arches_project=true
SETTINGS

export QGIS_SCREENSHOT_PATH="$deck_directory/assets/screenshots/qgis-spatial-view.png"
export ARCHES_URL="${ARCHES_URL:-http://localhost:8003}"
"$qgis_binary" \
    --nologo \
    --noversioncheck \
    --profiles-path "$profiles_directory" \
    --code "$deck_directory/scripts/qgis/capture_qgis_screenshot.py"

# The slide shows the map, attribute table and plugin panel, so crop away
# QGIS's toolbars, the table's filter bar and the status bar (the layer panel
# is hidden). The grab is 2x: 3400×2000 for a 1700×1000 window.
ffmpeg -v error -y -i "$QGIS_SCREENSHOT_PATH" \
    -vf "crop=3352:1672:0:156" \
    "$deck_directory/assets/screenshots/qgis-spatial-view-cropped.png"
