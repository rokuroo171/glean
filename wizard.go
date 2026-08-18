package main

import (
	"os"
	"path/filepath"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/store"
)

// SkyStateView is what the frontend uses to decide wizard, recovery, or
// workspace.
type SkyStateView struct {
	Configured       bool   `json:"configured"`
	SkyMissing       bool   `json:"sky_missing"`
	SkyName          string `json:"sky_name"`
	SkyPath          string `json:"sky_path"`
	HasLegacy        bool   `json:"has_legacy"`
	RegistryEmpty    bool   `json:"registry_empty"`
	MigrationSkipped bool   `json:"migration_skipped"`
}

// SkyState reports the current setup state.
func (a *App) SkyState() SkyStateView {
	skyDir, ok, err := store.ResolveSky()
	if err != nil || !ok {
		return SkyStateView{}
	}
	info, err := os.Stat(skyDir)
	if err != nil || !info.IsDir() {
		return SkyStateView{Configured: true, SkyMissing: true, SkyPath: skyDir}
	}
	name, err := store.LoadSkyName(skyDir)
	if err != nil {
		name = filepath.Base(skyDir)
	}
	hasLegacy, _ := store.HasLegacy()
	empty := true
	if a.store != nil {
		empty = len(a.store.All()) == 0
	}
	p, _, _ := store.LoadPointer()
	return SkyStateView{
		Configured: true, SkyName: name, SkyPath: skyDir,
		HasLegacy: hasLegacy, RegistryEmpty: empty,
		MigrationSkipped: p.MigrationSkipped,
	}
}

// DefaultSkyPath returns Documents/<sanitized name>, falling back to home.
func (a *App) DefaultSkyPath(name string) (string, error) {
	clean, err := store.SanitizeSkyName(name)
	if err != nil {
		return "", err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	docs := filepath.Join(home, "Documents", clean)
	if _, err := os.Stat(filepath.Join(home, "Documents")); err == nil {
		return docs, nil
	}
	return filepath.Join(home, clean), nil
}

// openSkyAt wires the stores for a sky folder and scans it.
func (a *App) openSkyAt(skyDir string) error {
	reg, err := store.OpenRegistry(skyDir)
	if err != nil {
		return err
	}
	if _, _, err := store.Scan(skyDir, reg); err != nil {
		return err
	}
	adj, _ := adjacency.Open(skyDir)
	act, _ := activity.Open(skyDir)
	ws, err := store.OpenWorkspace(skyDir)
	if err != nil {
		return err
	}
	a.store = reg
	a.adjacency = adj
	a.activity = act
	a.workspace = ws
	a.skyDir = skyDir
	return nil
}

// SetupSky creates a new sky with a name, points the app at it, and scans.
func (a *App) SetupSky(name, dir string) (SkyStateView, error) {
	clean, err := store.SanitizeSkyName(name)
	if err != nil {
		return SkyStateView{}, err
	}
	if err := store.CreateSky(dir, clean); err != nil {
		return SkyStateView{}, err
	}
	if err := store.SavePointer(store.SkyPointer{SkyPath: dir}); err != nil {
		return SkyStateView{}, err
	}
	if err := a.openSkyAt(dir); err != nil {
		return SkyStateView{}, err
	}
	return a.SkyState(), nil
}

// OpenSky adopts an existing folder, reusing its name when it is already a
// sky and deriving one otherwise.
func (a *App) OpenSky(dir string) (SkyStateView, error) {
	name := filepath.Base(dir)
	if _, err := os.Stat(filepath.Join(store.SidecarDir(dir), "sky.json")); err == nil {
		if n, err := store.LoadSkyName(dir); err == nil && n != "" {
			name = n
		}
	} else if err := store.CreateSky(dir, name); err != nil {
		return SkyStateView{}, err
	}
	if err := store.SavePointer(store.SkyPointer{SkyPath: dir}); err != nil {
		return SkyStateView{}, err
	}
	if err := a.openSkyAt(dir); err != nil {
		return SkyStateView{}, err
	}
	return a.SkyState(), nil
}

// MigrateSky imports the legacy store into the current sky.
func (a *App) MigrateSky() (store.MigrateReport, error) {
	if a.skyDir == "" {
		return store.MigrateReport{}, nil
	}
	return store.Migrate(a.skyDir)
}

// SkipMigration records that the user declined the legacy import.
func (a *App) SkipMigration() error {
	p, _, err := store.LoadPointer()
	if err != nil {
		return err
	}
	p.MigrationSkipped = true
	return store.SavePointer(p)
}
