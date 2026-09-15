package core

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/wikilink"
)

func setupService(t *testing.T) *Service {
	t.Helper()
	skyDir := t.TempDir()
	if err := store.CreateSky(skyDir, "Seed Test"); err != nil {
		t.Fatal(err)
	}
	s := &Service{}
	if err := s.OpenSkyAt(skyDir); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestSetupSkySeedsStarters(t *testing.T) {
	setTestEnv(t)
	skyDir := t.TempDir()
	s := &Service{}
	if _, err := s.SetupSky("Seed Test", skyDir); err != nil {
		t.Fatal(err)
	}
	notes := s.Store.All()
	if len(notes) != 4 {
		t.Fatalf("expected 4 seeded notes, got %d", len(notes))
	}
	// Files exist on disk, including the folder
	for _, n := range notes {
		if _, err := os.Stat(filepath.Join(skyDir, n.File)); err != nil {
			t.Fatalf("seeded file missing: %s", n.File)
		}
	}
	var folder []string
	for _, n := range notes {
		if store.FolderOf(n.File) == "Getting Started" {
			folder = append(folder, n.Title)
		}
	}
	if len(folder) != 3 {
		t.Fatalf("expected 3 notes in Getting Started, got %d: %v", len(folder), folder)
	}
}

func TestSetupSkySeedVisitLadder(t *testing.T) {
	setTestEnv(t)
	skyDir := t.TempDir()
	s := &Service{}
	if _, err := s.SetupSky("Seed Test", skyDir); err != nil {
		t.Fatal(err)
	}
	visits := map[string]int{}
	for _, n := range s.Store.All() {
		visits[n.Title] = n.VisitCount
	}
	if visits["Welcome"] != 1 {
		t.Errorf("Welcome should be a faint speck (1 visit), got %d", visits["Welcome"])
	}
	if visits["Bright and Dim"] != 3 {
		t.Errorf("Bright and Dim should be dim (3 visits), got %d", visits["Bright and Dim"])
	}
	if visits["Wishes"] != 5 || visits["Starlines"] != 5 {
		t.Errorf("Wishes and Starlines should be steady (5 visits), got %d and %d", visits["Wishes"], visits["Starlines"])
	}
}

func TestSetupSkySeedAdjacencyPairs(t *testing.T) {
	setTestEnv(t)
	skyDir := t.TempDir()
	s := &Service{}
	if _, err := s.SetupSky("Seed Test", skyDir); err != nil {
		t.Fatal(err)
	}
	byTitle := map[string]string{}
	for _, n := range s.Store.All() {
		byTitle[n.Title] = n.ID
	}
	pairs := map[string]int{}
	for _, p := range s.Adjacency.Pairs() {
		pairs[p.NoteA+"\x00"+p.NoteB] = p.Count
	}
	for _, title := range []string{"Bright and Dim", "Wishes", "Starlines"} {
		id := byTitle[title]
		wid := byTitle["Welcome"]
		keyA := wid + "\x00" + id
		keyB := id + "\x00" + wid
		if pairs[keyA] == 0 && pairs[keyB] == 0 {
			t.Errorf("no adjacency pair seeded between Welcome and %s", title)
		}
	}
}

func TestOpenSkyDoesNotSeed(t *testing.T) {
	setTestEnv(t)
	skyDir := t.TempDir()
	s := &Service{}
	if _, err := s.SetupSky("Seed Test", skyDir); err != nil {
		t.Fatal(err)
	}
	// Delete the seed set, reopen: an adopted sky must stay empty
	notes := s.Store.All()
	for _, n := range notes {
		_ = os.Remove(filepath.Join(skyDir, n.File))
	}
	s2 := &Service{}
	if err := s2.OpenSkyAt(skyDir); err != nil {
		t.Fatal(err)
	}
	if got := len(s2.Store.All()); got != 0 {
		t.Fatalf("OpenSky seeded notes; adopted skies must stay as-is, got %d", got)
	}
}

func TestSeedLinksResolve(t *testing.T) {
	setTestEnv(t)
	skyDir := t.TempDir()
	s := &Service{}
	if _, err := s.SetupSky("Seed Test", skyDir); err != nil {
		t.Fatal(err)
	}
	// Every [[Target]] in the seeded bodies must resolve to a real title,
	// or the day-one trails and starlines are dead links
	titles := map[string]bool{}
	for _, n := range s.Store.All() {
		titles[n.Title] = true
	}
	for _, n := range s.Store.All() {
		path := filepath.Join(skyDir, n.File)
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		for _, l := range wikilinkTargets(string(body)) {
			if !titles[l] {
				t.Errorf("%s links to missing title %q", n.Title, l)
			}
		}
	}
}

// wikilinkTargets returns the [[...]] targets in a body, lowercase-free
func wikilinkTargets(body string) []string {
	var out []string
	for _, l := range wikilink.Scan(body) {
		if l.Kind == wikilink.Wiki {
			out = append(out, l.Target)
		}
	}
	return out
}
