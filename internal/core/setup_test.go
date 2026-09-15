package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

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

func testService(t *testing.T) *Service {
	t.Helper()
	setTestEnv(t)
	return &Service{}
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
	s := testService(t)
	st := s.SkyState()
	if st.Configured || st.SkyMissing {
		t.Fatalf("unexpected state: %+v", st)
	}
}

func TestSetupSkyConfigures(t *testing.T) {
	s := testService(t)
	skyDir := filepath.Join(t.TempDir(), "My Sky")
	st, err := s.SetupSky("My Sky", skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if !st.Configured || st.SkyName != "My Sky" || st.SkyPath != skyDir {
		t.Fatalf("state = %+v", st)
	}
	if st.RegistryEmpty {
		t.Fatal("fresh sky should have the seeded starter notes")
	}
	// A second service sees the same configuration.
	s2 := &Service{}
	if !s2.SkyState().Configured {
		t.Fatal("pointer not persisted")
	}
}

func TestSetupSkyDoesNotScan(t *testing.T) {
	s := testService(t)
	skyDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(skyDir, "Fresh.md"), []byte("# hi"), 0o644)
	st, err := s.SetupSky("Fresh", skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if st.RegistryEmpty {
		t.Fatal("SetupSky should not scan -- registry must hold only the seed set")
	}
	if got := len(s.Store.All()); got != 4 {
		t.Fatalf("expected exactly the 4 starter notes, got %d", got)
	}
}

func TestOpenSkyScansExistingFolder(t *testing.T) {
	s := testService(t)
	skyDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(skyDir, "Fresh.md"), []byte("# hi"), 0o644)
	st, err := s.OpenSky(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if st.RegistryEmpty {
		t.Fatal("OpenSky should scan existing md files")
	}
}

func TestOpenSkyReusesName(t *testing.T) {
	s := testService(t)
	skyDir := filepath.Join(t.TempDir(), "ThePrism")
	if _, err := s.SetupSky("ThePrism", skyDir); err != nil {
		t.Fatal(err)
	}
	s2 := &Service{}
	st, err := s2.OpenSky(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if st.SkyName != "ThePrism" {
		t.Fatalf("name = %q, want ThePrism", st.SkyName)
	}
}

func TestMigrateAndSkip(t *testing.T) {
	s := testService(t)
	writeLegacyStore(t, []note.Note{{
		ID: "l1", Title: "Old note", Body: "old body", Positioned: true, WorldX: 1, WorldY: 1,
	}})

	skyDir := filepath.Join(t.TempDir(), "Migrated")
	if _, err := s.SetupSky("Migrated", skyDir); err != nil {
		t.Fatal(err)
	}
	if !s.SkyState().HasLegacy {
		t.Fatal("HasLegacy should be true")
	}
	report, err := s.MigrateSky()
	if err != nil {
		t.Fatal(err)
	}
	if report.Imported != 1 {
		t.Fatalf("imported = %d, want 1", report.Imported)
	}
	if err := s.SkipMigration(); err != nil {
		t.Fatal(err)
	}
	p, ok, err := store.LoadPointer()
	if err != nil || !ok || !p.MigrationSkipped {
		t.Fatalf("skip flag not persisted: %+v %v %v", p, ok, err)
	}
	if !s.SkyState().MigrationSkipped {
		t.Fatal("SkyState should report the skip flag")
	}
}

func TestGetLinksMergesVisits(t *testing.T) {
	s := testService(t)
	skyDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(skyDir, "Alpha.md"), []byte("# Alpha\n\nSee [[Beta]]."), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skyDir, "Beta.md"), []byte("# Beta\n\nBack to [[Alpha]]."), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.OpenSky(skyDir); err != nil {
		t.Fatal(err)
	}
	var alphaID, betaID string
	for _, n := range s.Store.All() {
		switch n.Title {
		case "Alpha":
			alphaID = n.ID
		case "Beta":
			betaID = n.ID
		}
	}
	if alphaID == "" || betaID == "" {
		t.Fatalf("scan missed notes: %+v", s.Store.All())
	}
	// Reinforce from both directions; the pair is undirected so this is one trail
	now := time.Now()
	if err := s.Adjacency.Reinforce(alphaID, betaID, now); err != nil {
		t.Fatal(err)
	}
	if err := s.Adjacency.Reinforce(betaID, alphaID, now); err != nil {
		t.Fatal(err)
	}
	links := s.GetLinks()
	if len(links) != 1 {
		t.Fatalf("links = %d, want 1", len(links))
	}
	if links[0].Visits != 2 {
		t.Fatalf("visits = %d, want 2", links[0].Visits)
	}
}
