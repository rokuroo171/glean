#!/bin/sh
# glean-desktop: single-file installer for glean.
#
# This file is a self-extracting bundle. The header you are reading is a
# small POSIX sh script; the compressed payload (the glean binary, the
# 512px icon, glean.desktop and install.sh) is appended right after the
# __GLEAN_ARCHIVE__ marker at the end of this file.
#
# Running it installs glean under ~/.local and launches the app, so first
# run lands on the 'Welcome to your Night Sky' setup screen.
set -e

# Find where the payload starts (the marker is the last line of the header).
# awk is byte-safe here; grep would treat the appended tarball as binary.
LINE=$(awk '/^__GLEAN_ARCHIVE__$/{ print NR; exit }' "$0")
if [ -z "$LINE" ]; then
  echo "glean-desktop: corrupt bundle (payload marker not found)" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' INT TERM EXIT

tail -n +"$((LINE + 1))" "$0" | tar -xzf - -C "$TMP"

"$TMP/install.sh"

rm -rf "$TMP"
trap - INT TERM EXIT

exec "$HOME/.local/bin/glean" "$@"

__GLEAN_ARCHIVE__
