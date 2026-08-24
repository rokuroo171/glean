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

sh "$TMP/install.sh"

rm -rf "$TMP"
trap - INT TERM EXIT

# Check for webkit2gtk before launching. The binary is built against a
# specific webkit ABI; if the library is missing, print distro-specific
# install instructions instead of a cryptic linker error.
WK_LIB="libwebkit2gtk-4.1.so"
if ! ldconfig -p 2>/dev/null | grep -q "$WK_LIB"; then
  echo ""
  echo "glean needs webkit2gtk to run. Install it:"
  echo ""
  if command -v dnf >/dev/null 2>&1; then
    echo "  sudo dnf install webkit2gtk4.1"
  elif command -v apt >/dev/null 2>&1; then
    echo "  sudo apt install libwebkit2gtk-4.1-dev"
  elif command -v pacman >/dev/null 2>&1; then
    echo "  sudo pacman -S webkit2gtk"
  else
    echo "  Install webkit2gtk for your distribution"
  fi
  echo ""
  exit 1
fi

exec "$HOME/.local/bin/glean" "$@"

__GLEAN_ARCHIVE__
