package store

import (
	"testing"
	"time"

	"github.com/glean/glean/internal/note"
)

func TestRegistryRoundTrip(t *testing.T) {
	skyDir := t.TempDir()
	reg, err := OpenRegistry(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	n := note.Note{ID: NewID(), Title: "First spark", Body: "ignored here",
		CreatedAt: now, LastVisited: now, VisitCount: 1,
		WorldX: 4, WorldY: -2, Positioned: true}
	if err := reg.Create(n); err != nil {
		t.Fatal(err)
	}
	got, ok := reg.Get(n.ID)
	if !ok {
		t.Fatal("note not found after create")
	}
	if got.Title != n.Title || got.Body != "" {
		t.Fatalf("Get() = %+v, want title %q and empty body", got, n.Title)
	}
	if got.VisitCount != 1 || got.WorldX != 4 {
		t.Fatalf("metadata lost: %+v", got)
	}
}

func TestRegistryPersistsAcrossReopen(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Persist me", Positioned: true, WorldX: 1, WorldY: 1}
	_ = reg.Create(n)

	reg2, err := OpenRegistry(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := reg2.Get(n.ID); !ok {
		t.Fatal("entry lost across reopen")
	}
}

func TestRegistryUpdateAndDelete(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Old title", Positioned: true, WorldX: 2, WorldY: 3}
	_ = reg.Create(n)

	n.Title = "New title"
	n.VisitCount = 7
	if err := reg.Update(n); err != nil {
		t.Fatal(err)
	}
	got, _ := reg.Get(n.ID)
	if got.Title != "New title" || got.VisitCount != 7 {
		t.Fatalf("update lost: %+v", got)
	}

	if err := reg.Delete(n.ID); err != nil {
		t.Fatal(err)
	}
	if _, ok := reg.Get(n.ID); ok {
		t.Fatal("entry still present after delete")
	}
}

func TestRegistryFileRoundTrip(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Steady light", File: "Steady light 2.md",
		Positioned: true, WorldX: 1, WorldY: 1}
	if err := reg.Create(n); err != nil {
		t.Fatal(err)
	}
	got, _ := reg.Get(n.ID)
	if got.File != "Steady light 2.md" {
		t.Fatalf("File lost in round trip: %+v", got)
	}
	reg2, err := OpenRegistry(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	got, _ = reg2.Get(n.ID)
	if got.File != "Steady light 2.md" {
		t.Fatalf("File lost across reopen: %+v", got)
	}
}

func TestRegistryBackfillsMissingFile(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Steady light", Positioned: true, WorldX: 1, WorldY: 1}
	_ = reg.Create(n)
	if n.File != "" {
		t.Fatal("test setup: entry should start without a file")
	}
	reg2, err := OpenRegistry(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := reg2.Get(n.ID)
	if got.File != "Steady light.md" {
		t.Fatalf("backfilled File = %q, want %q", got.File, "Steady light.md")
	}
}

func TestRegistryPositionsMissingNotes(t *testing.T) {
	skyDir := t.TempDir()
	reg, _ := OpenRegistry(skyDir)
	n := note.Note{ID: NewID(), Title: "Unplaced"}
	if err := reg.Create(n); err != nil {
		t.Fatal(err)
	}
	// A fresh open runs LockMissingPositions over the entries.
	reg2, err := OpenRegistry(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := reg2.Get(n.ID)
	if !got.Positioned {
		t.Fatal("note was not positioned on reopen")
	}
}
