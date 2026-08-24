#!/usr/bin/env sh
# Install glean for the current user without sudo.
# Usage: ./install.sh [prefix]   (default: ~/.local)
set -e

PREFIX="${1:-$HOME/.local}"
BINDIR="$PREFIX/bin"
ICONDIR="$PREFIX/share/icons/hicolor/512x512/apps"
APPDIR="$PREFIX/share/applications"

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

install -d "$BINDIR" "$ICONDIR" "$APPDIR"

install -m 0755 "$SRC_DIR/glean" "$BINDIR/glean"
install -m 0644 "$SRC_DIR/glean.png" "$ICONDIR/glean.png"

# Desktop entry with the absolute Exec path so the launcher finds the binary.
sed -e "s|^Exec=.*|Exec=$BINDIR/glean|" "$SRC_DIR/glean.desktop" > "$APPDIR/glean.desktop"
chmod 0644 "$APPDIR/glean.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPDIR" >/dev/null 2>&1 || true
fi

echo "glean installed to $BINDIR/glean"
echo "Add $BINDIR to your PATH if it is not already there."