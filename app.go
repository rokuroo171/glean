package main

import (
	"context"

	"github.com/glean/glean/internal/core"
	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding surface. Everything here delegates to
// internal/core; the methods that stay in this file are exactly the ones
// that need the Wails context (window management, native dialogs)
type App struct {
	ctx context.Context
	svc *core.Service
}

// NewApp wires the core service when a sky is configured
func NewApp() (*App, error) {
	svc, err := core.New()
	if err != nil {
		return nil, err
	}
	return &App{svc: svc}, nil
}

// SetWindowTitle updates the window title bar and taskbar preview text
// Call from the frontend as notes are opened or closed
func (a *App) SetWindowTitle(title string) {
	wailsrt.WindowSetTitle(a.ctx, title)
}

// PickFolder opens the native OS directory picker and returns the selected
// path, or empty string if cancelled. Works on Windows, macOS, and Linux
// (uses whatever GTK/Qt file chooser the desktop environment provides)
func (a *App) PickFolder() string {
	if a.ctx == nil {
		return ""
	}
	dir, err := wailsrt.OpenDirectoryDialog(a.ctx, wailsrt.OpenDialogOptions{
		Title: "Choose your Sky folder",
	})
	if err != nil {
		return ""
	}
	return dir
}

// SetWindowSize resizes the OS window and pins min and max size to the
// same value. Fixed-size windows carry a size hint every platform reads:
// tiling window managers (i3, sway, Hyprland) float them like dialogs, and
// Windows disables the resize border. The window boots hidden for gate
// screens, so this is also the first show: by the time the window maps,
// the pin is already set, and tiled first frames never happen.
// UnlockWindowSize removes the pin and restores normal resizing.
func (a *App) SetWindowSize(width, height int) {
	if a.ctx == nil {
		return
	}
	wailsrt.WindowSetMinSize(a.ctx, width, height)
	wailsrt.WindowSetMaxSize(a.ctx, width, height)
	wailsrt.WindowSetSize(a.ctx, width, height)
	wailsrt.WindowShow(a.ctx)
	wailsrt.WindowCenter(a.ctx)
}

// UnlockWindowSize removes the fixed-size pin from SetWindowSize so the
// workspace behaves like a normal resizable window again. The window is
// hidden and shown in the same breath: window managers only read size
// hints when the window maps, so a window that mapped while pinned stays
// floating forever; remapping it unpinned lets the WM tile it like any
// other resizable window
func (a *App) UnlockWindowSize() {
	if a.ctx == nil {
		return
	}
	wailsrt.WindowHide(a.ctx)
	wailsrt.WindowSetMinSize(a.ctx, 0, 0)
	wailsrt.WindowSetMaxSize(a.ctx, 0, 0)
	wailsrt.WindowSetSize(a.ctx, 1200, 800)
	wailsrt.WindowShow(a.ctx)
	wailsrt.WindowCenter(a.ctx)
}
