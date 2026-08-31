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
  echo "glean needs webkit2gtk 4.1 (not 4.0) to run."
  echo "Your system is missing libwebkit2gtk-4.1.so."
  echo ""
  echo "Install it for your distro:"
  echo ""
  if command -v pacman >/dev/null 2>&1; then
    echo "  Arch / CachyOS / Manjaro:"
    echo "    sudo pacman -S webkit2gtk-4.1"
  elif command -v dnf >/dev/null 2>&1; then
    echo "  Fedora 40+:"
    echo "    sudo dnf install webkit2gtk4.1"
  elif command -v apt >/dev/null 2>&1; then
    echo "  Ubuntu 22.04+ / Debian 12+:"
    echo "    sudo apt install libwebkit2gtk-4.1-dev"
  elif command -v zypper >/dev/null 2>&1; then
    echo "  openSUSE:"
    echo "    sudo zypper install libwebkit2gtk-4_1-0-devel"
  elif command -v xbps-install >/dev/null 2>&1; then
    echo "  Void Linux:"
    echo "    sudo xbps-install -S webkit2gtk-4.1"
  elif command -v apk >/dev/null 2>&1; then
    echo "  Alpine:"
    echo "    sudo apk add webkit2gtk-4.1"
  elif command -v nix-shell >/dev/null 2>&1; then
    echo "  NixOS / Nix:"
    echo "    Add webkitgtk_4_1 to environment.systemPackages"
  elif command -v emerge >/dev/null 2>&1; then
    echo "  Gentoo:"
    echo "    sudo emerge net-libs/webkit-gtk:4.1"
  else
    echo "  Install webkit2gtk 4.1 for your distribution."
    echo "  The old webkit2gtk 4.0 package does NOT work."
  fi
  echo ""
  echo "Note: Ubuntu 20.04 and Fedora 39 or older do NOT have"
  echo "webkit2gtk 4.1. You need a newer distro release."
  echo ""
  exit 1
fi

exec "$HOME/.local/bin/glean" "$@"

__GLEAN_ARCHIVE__
