package main

import (
	"context"
	"os"

	"github.com/glean/glean/internal/winapi"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.LogInfo(ctx, "glean started")
	// Windows 11 Snap Layout via winapi
	hwnd := winapi.FindWindowByPID(uint32(os.Getpid()))
	if hwnd != 0 {
		winapi.EnableSnapLayouts(hwnd)
	}
}
