package main

import (
	"os"
	"path/filepath"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/store"
)

// SkyStateView is what the frontend uses to decide setup, recovery, or
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

// SetupSky creates a new sky with a name and points the app at it.
// It does NOT scan for existing files -- a fresh sky starts empty.
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
	// Wire stores without scanning -- a new sky has no files yet.
	reg, err := store.OpenRegistry(dir)
	if err != nil {
		return SkyStateView{}, err
	}
	adj, _ := adjacency.Open(dir)
	act, _ := activity.Open(dir)
	ws, err := store.OpenWorkspace(dir)
	if err != nil {
		return SkyStateView{}, err
	}
	a.store = reg
	a.adjacency = adj
	a.activity = act
	a.workspace = ws
	a.skyDir = dir
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

// MigrateSky imports the legacy store into the current sky and
// removes the legacy files so the offer does not reappear.
func (a *App) MigrateSky() (store.MigrateReport, error) {
	if a.skyDir == "" {
		return store.MigrateReport{}, nil
	}
	report, err := store.Migrate(a.skyDir)
	if err == nil {
		store.RemoveLegacy()
	}
	return report, err
}

// SkipMigration records that the user declined the legacy import and
// removes the legacy store files so the offer never appears again.
func (a *App) SkipMigration() error {
	p, _, err := store.LoadPointer()
	if err != nil {
		return err
	}
	p.MigrationSkipped = true
	if err := store.SavePointer(p); err != nil {
		return err
	}
	// Remove legacy files so the offer does not reappear.
	store.RemoveLegacy()
	return nil
}
