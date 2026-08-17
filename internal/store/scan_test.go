package store

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glean/glean/internal/note"
)

func TestScanFindsNewFiles(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	if err := WriteNoteFile(filepath.Join(skyDir, "Fresh idea.md"), "# fresh"); err != nil {
		t.Fatal(err)
	}

	added, removed, err := Scan(skyDir, reg)
	if err != nil {
		t.Fatal(err)
	}
	if len(removed) != 0 {
		t.Fatalf("unexpected removals: %v", removed)
	}
	if len(added) != 1 {
		t.Fatalf("added = %d, want 1", len(added))
	}
	if added[0].Title != "Fresh idea" {
		t.Fatalf("added title = %q, want %q", added[0].Title, "Fresh idea")
	}
	body, err := ReadNoteFile(filepath.Join(skyDir, "Fresh idea.md"))
	if err != nil || body != "# fresh" {
		t.Fatalf("body not preserved: %q, %v", body, err)
	}
}

func TestScanRemovesMissingFiles(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Gone note", Positioned: true, WorldX: 0, WorldY: 0}
	if err := WriteNoteFile(filepath.Join(skyDir, "Gone note.md"), "x"); err != nil {
		t.Fatal(err)
	}
	_ = reg.Create(n)

	if err := os.Remove(filepath.Join(skyDir, "Gone note.md")); err != nil {
		t.Fatal(err)
	}
	_, removed, err := Scan(skyDir, reg)
	if err != nil {
		t.Fatal(err)
	}
	if len(removed) != 1 || removed[0] != n.ID {
		t.Fatalf("removed = %v, want [%s]", removed, n.ID)
	}
	if _, ok := reg.Get(n.ID); ok {
		t.Fatal("registry entry not deleted")
	}
}

func TestScanKeepsExistingNotes(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Stable", Positioned: true, WorldX: 1, WorldY: 1}
	_ = reg.Create(n)
	_ = WriteNoteFile(filepath.Join(skyDir, "Stable.md"), "keep")

	added, removed, err := Scan(skyDir, reg)
	if err != nil {
		t.Fatal(err)
	}
	if len(added) != 0 || len(removed) != 0 {
		t.Fatalf("scan should be a no-op, added=%d removed=%d", len(added), len(removed))
	}
}
