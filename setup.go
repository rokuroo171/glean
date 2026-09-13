package main

import (
	"github.com/glean/glean/internal/core"
)

// Setup and sky lifecycle bindings delegate to the core service

func (a *App) SkyState() core.SkyStateView {
	return a.svc.SkyState()
}

func (a *App) DefaultSkyPath(name string) (string, error) {
	return a.svc.DefaultSkyPath(name)
}

func (a *App) SetupSky(name, dir string) (core.SkyStateView, error) {
	return a.svc.SetupSky(name, dir)
}

func (a *App) OpenSky(dir string) (core.SkyStateView, error) {
	return a.svc.OpenSky(dir)
}

func (a *App) SkipMigration() error {
	return a.svc.SkipMigration()
}
