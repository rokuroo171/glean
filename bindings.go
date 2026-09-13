package main

import (
	"github.com/glean/glean/internal/core"
	"github.com/glean/glean/internal/store"
)

// Bindings for every core service method the frontend calls. Each is a
// one-line pass-through; the behavior lives in internal/core

func (a *App) GetNotes() []core.NoteView { return a.svc.GetNotes() }

func (a *App) ScanSky() []core.NoteView { return a.svc.ScanSky() }

func (a *App) GetNote(id string) (core.NoteView, bool) { return a.svc.GetNote(id) }

func (a *App) CreateNote(title, contextID, folder string) (core.NoteView, error) {
	return a.svc.CreateNote(title, contextID, folder)
}

func (a *App) SaveNote(id, title, body string) error { return a.svc.SaveNote(id, title, body) }

func (a *App) ImportImage(name, dataURI string) (string, error) {
	return a.svc.ImportImage(name, dataURI)
}

func (a *App) DeleteNote(id string) error { return a.svc.DeleteNote(id) }

func (a *App) WaterNote(id string) (bool, error) { return a.svc.WaterNote(id) }

func (a *App) OpenNote(id string) (core.NoteView, error) { return a.svc.OpenNote(id) }

func (a *App) GetLinks() []core.TrailView { return a.svc.GetLinks() }

func (a *App) GetStats() core.StatsView { return a.svc.GetStats() }

func (a *App) GetSkyName() string { return a.svc.GetSkyName() }

func (a *App) GetSkyPath() string { return a.svc.GetSkyPath() }

func (a *App) GetSystemInfo() core.SystemInfo { return a.svc.GetSystemInfo() }

func (a *App) OpenURL(url string) error { return a.svc.OpenURL(url) }

func (a *App) GetPalette() core.PaletteView { return a.svc.GetPalette() }

func (a *App) CreateFolder(name, folder string) error { return a.svc.CreateFolder(name, folder) }

func (a *App) ListFolders() []string { return a.svc.ListFolders() }

func (a *App) MoveNote(id, targetFolder string) error { return a.svc.MoveNote(id, targetFolder) }

func (a *App) RenameFolder(folder, newName string) error {
	return a.svc.RenameFolder(folder, newName)
}

func (a *App) DeleteFolder(folder string) error { return a.svc.DeleteFolder(folder) }

func (a *App) GetKnownSkies() []core.KnownSkyView { return a.svc.GetKnownSkies() }

func (a *App) SwitchSky(path string) (string, error) { return a.svc.SwitchSky(path) }

func (a *App) RemoveKnownSky(path string) error { return a.svc.RemoveKnownSky(path) }

func (a *App) GetPreferences() core.PreferencesView { return a.svc.GetPreferences() }

func (a *App) SavePreferences(p core.PreferencesView) error { return a.svc.SavePreferences(p) }

func (a *App) OpenVaultFolder() error { return a.svc.OpenVaultFolder() }

func (a *App) ExportSky() (string, error) { return a.svc.ExportSky() }

func (a *App) ImportNotes(data string) error { return a.svc.ImportNotes(data) }

func (a *App) DeleteSky() error { return a.svc.DeleteSky() }

// MigrateSky imports the legacy store; the report type stays concrete so
// the generated TS model keeps its shape
func (a *App) MigrateSky() (store.MigrateReport, error) { return a.svc.MigrateSky() }
