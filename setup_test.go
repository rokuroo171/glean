package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
)

// setTestEnv redirects AppConfigDir to a fresh temp tree.
func setTestEnv(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	switch runtime.GOOS {
	case "windows":
		t.Setenv("APPDATA", dir)
	case "darwin":
		libDir := filepath.Join(dir, "Library", "Application Support")
		os.MkdirAll(libDir, 0o755)
		t.Setenv("HOME", dir)
	default:
		t.Setenv("XDG_CONFIG_HOME", dir)
	}
}

func testApp(t *testing.T) *App {
	t.Helper()
	setTestEnv(t)
	return &App{}
}

func writeLegacyStore(t *testing.T, notes []note.Note) {
	t.Helper()
	// Legacy files live at AppConfigDir()/glean.json etc.
	configDir, err := store.AppConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(note.Collection{Notes: notes})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDir, "glean.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	rawA, _ := json.Marshal(adjacency.AdjacencyLog{Pairs: []adjacency.PairCount{}})
	if err := os.WriteFile(filepath.Join(configDir, "adjacency.json"), rawA, 0o644); err != nil {
		t.Fatal(err)
	}
	rawS, _ := json.Marshal(activity.Activity{DailyCounts: map[string]int{}})
	if err := os.WriteFile(filepath.Join(configDir, "activity.json"), rawS, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestSkyStateUnconfigured(t *testing.T) {
	a := testApp(t)
	st := a.SkyState()
	if st.Configured || st.SkyMissing {
		t.Fatalf("unexpected state: %+v", st)
	}
}

func TestSetupSkyConfigures(t *testing.T) {
	a := testApp(t)
	skyDir := filepath.Join(t.TempDir(), "My Sky")
	st, err := a.SetupSky("My Sky", skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if !st.Configured || st.SkyName != "My Sky" || st.SkyPath != skyDir {
		t.Fatalf("state = %+v", st)
	}
	if !st.RegistryEmpty {
		t.Fatal("fresh sky should have an empty registry")
	}
	// A second app sees the same configuration.
	a2 := &App{}
	if !a2.SkyState().Configured {
		t.Fatal("pointer not persisted")
	}
}

func TestSetupSkyDoesNotScan(t *testing.T) {
	a := testApp(t)
	skyDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(skyDir, "Fresh.md"), []byte("# hi"), 0o644)
	st, err := a.SetupSky("Fresh", skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if !st.RegistryEmpty {
		t.Fatal("SetupSky should not scan -- fresh sky starts empty")
	}
}

func TestOpenSkyScansExistingFolder(t *testing.T) {
	a := testApp(t)
	skyDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(skyDir, "Fresh.md"), []byte("# hi"), 0o644)
	st, err := a.OpenSky(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if st.RegistryEmpty {
		t.Fatal("OpenSky should scan existing md files")
	}
}

func TestOpenSkyReusesName(t *testing.T) {
	a := testApp(t)
	skyDir := filepath.Join(t.TempDir(), "ThePrism")
	if _, err := a.SetupSky("ThePrism", skyDir); err != nil {
		t.Fatal(err)
	}
	a2 := &App{}
	st, err := a2.OpenSky(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if st.SkyName != "ThePrism" {
		t.Fatalf("name = %q, want ThePrism", st.SkyName)
	}
}

func TestMigrateAndSkip(t *testing.T) {
	a := testApp(t)
	writeLegacyStore(t, []note.Note{{
		ID: "l1", Title: "Old note", Body: "old body", Positioned: true, WorldX: 1, WorldY: 1,
	}})

	skyDir := filepath.Join(t.TempDir(), "Migrated")
	if _, err := a.SetupSky("Migrated", skyDir); err != nil {
		t.Fatal(err)
	}
	if !a.SkyState().HasLegacy {
		t.Fatal("HasLegacy should be true")
	}
	report, err := a.MigrateSky()
	if err != nil {
		t.Fatal(err)
	}
	if report.Imported != 1 {
		t.Fatalf("imported = %d, want 1", report.Imported)
	}
	if err := a.SkipMigration(); err != nil {
		t.Fatal(err)
	}
	p, ok, err := store.LoadPointer()
	if err != nil || !ok || !p.MigrationSkipped {
		t.Fatalf("skip flag not persisted: %+v %v %v", p, ok, err)
	}
	if !a.SkyState().MigrationSkipped {
		t.Fatal("SkyState should report the skip flag")
	}
}
