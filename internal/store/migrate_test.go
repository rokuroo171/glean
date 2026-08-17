package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/note"
)

func writeLegacy(t *testing.T, configDir string, notes []note.Note) {
	t.Helper()
	legacyDir := filepath.Join(configDir, "glean")
	if err := os.MkdirAll(legacyDir, 0o755); err != nil {
		t.Fatal(err)
	}
	coll := note.Collection{Notes: notes}
	raw, err := json.Marshal(coll)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "glean.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	adj := adjacency.AdjacencyLog{Pairs: []adjacency.PairCount{
		{NoteA: "a", NoteB: "b", Count: 6},
	}}
	rawA, err := json.Marshal(adj)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "adjacency.json"), rawA, 0o644); err != nil {
		t.Fatal(err)
	}
	act := activity.Activity{DailyCounts: map[string]int{"2026-08-17": 3}}
	rawS, err := json.Marshal(act)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "activity.json"), rawS, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestMigrateCopiesEverything(t *testing.T) {
	now := time.Now()
	configDir := setTestConfigDir(t)
	writeLegacy(t, configDir, []note.Note{{
		ID: "legacy1", Title: "First spark", Body: "# spark\n\nbody",
		CreatedAt: now, LastVisited: now, VisitCount: 4,
		WorldX: 10, WorldY: -4, Positioned: true,
	}})

	skyDir := t.TempDir()
	_ = CreateSky(skyDir, "Migrated")
	report, err := Migrate(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if report.Imported != 1 || len(report.Failures) != 0 {
		t.Fatalf("report = %+v", report)
	}

	body, err := ReadNoteFile(filepath.Join(skyDir, "First spark.md"))
	if err != nil || body != "# spark\n\nbody" {
		t.Fatalf("md body wrong: %q, %v", body, err)
	}
	reg, _ := OpenRegistry(skyDir)
	n, ok := reg.Get("legacy1")
	if !ok {
		t.Fatal("registry entry missing")
	}
	if n.Title != "First spark" || n.VisitCount != 4 || n.WorldX != 10 {
		t.Fatalf("metadata lost: %+v", n)
	}
	if _, err := os.Stat(filepath.Join(skyDir, ".glean", "trails.json")); err != nil {
		t.Fatal("trails.json not written")
	}
	if _, err := os.Stat(filepath.Join(skyDir, ".glean", "stats.json")); err != nil {
		t.Fatal("stats.json not written")
	}
	// Legacy files untouched.
	for _, name := range []string{"glean.json", "adjacency.json", "activity.json"} {
		if _, err := os.Stat(filepath.Join(configDir, "glean", name)); err != nil {
			t.Fatalf("legacy %s was touched: %v", name, err)
		}
	}
}

func TestHasLegacy(t *testing.T) {
	setTestConfigDir(t)
	ok, err := HasLegacy()
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("HasLegacy() = true on empty config dir")
	}
}

func TestHasLegacyFindsFiles(t *testing.T) {
	configDir := setTestConfigDir(t)
	writeLegacy(t, configDir, nil)
	ok, err := HasLegacy()
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("HasLegacy() = false with legacy files present")
	}
}
