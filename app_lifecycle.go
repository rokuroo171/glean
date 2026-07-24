package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startup(ctx context.Context) {
	runtime.LogInfo(ctx, "glean started")
}
