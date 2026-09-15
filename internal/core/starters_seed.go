package core

import (
	"embed"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/world"
)

//go:embed starters
var starterFS embed.FS

// starterNote is one file of the seed set with its registry metadata
type starterNote struct {
	// Path is relative to the embedded starters dir, using forward slashes
	path string
	// Folder is the sky-relative folder the note lands in, empty for root
	folder string
	// SeedVisits puts the four starters at different rungs of the
	// brightness ladder so a fresh sky already shows the mechanic
	seedVisits int
}

// starterSet is the first-run content written to every brand-new sky.
// Welcome links out to all three; each links back, so the constellation
// opens with a real hub-and-spoke shape
var starterSet = []starterNote{
	{path: "Welcome.md", folder: "", seedVisits: 1},
	{path: "getting-started/Bright and Dim.md", folder: "Getting Started", seedVisits: 3},
	{path: "getting-started/Wishes.md", folder: "Getting Started", seedVisits: 5},
	{path: "getting-started/Starlines.md", folder: "Getting Started", seedVisits: 5},
}

// seedStarterNotes writes the embedded starter files into a fresh sky,
// registers the notes with seeded visit counts and spiral positions, and
// pre-registers the hub-and-spoke adjacency pairs so the constellation has
// trails on first launch. Only called from SetupSky on a brand-new sky
func seedStarterNotes(s *Service) error {
	now := time.Now()
	ids := make(map[string]string, len(starterSet)) // title -> id
	for _, sn := range starterSet {
		body, err := starterFS.ReadFile("starters/" + sn.path)
		if err != nil {
			return fmt.Errorf("read starter %s: %w", sn.path, err)
		}
		title := fileStem(sn.path)
		path, err := store.FileNameFor(s.SkyDir, sn.folder, title)
		if err != nil {
			return fmt.Errorf("starter path for %s: %w", title, err)
		}
		if err := store.WriteNoteFile(path, string(body)); err != nil {
			return fmt.Errorf("write starter %s: %w", title, err)
		}
		rel, err := filepath.Rel(s.SkyDir, path)
		if err != nil {
			rel = path
		}
		id := store.NewID()
		ids[title] = id
		p := world.PositionForNew(s.Store.All(), "", id)
		if err := s.Store.Create(note.Note{
			ID:          id,
			Title:       title,
			File:        rel,
			CreatedAt:   now,
			LastVisited: now,
			VisitCount:  sn.seedVisits,
			WorldX:      p.X,
			WorldY:      p.Y,
			Positioned:  true,
		}); err != nil {
			return fmt.Errorf("register starter %s: %w", title, err)
		}
	}
	// Hub-and-spoke trails on day one: Welcome to each mechanic note and
	// back, so the constellation renders the starter shape before any
	// real navigation happens
	if s.Adjacency != nil {
		for _, sn := range starterSet[1:] {
			title := fileStem(sn.path)
			if id, ok := ids[title]; ok {
				if err := s.Adjacency.Reinforce(ids["Welcome"], id, now); err != nil {
					return fmt.Errorf("seed trail to %s: %w", title, err)
				}
			}
		}
	}
	// First launch opens on Welcome with the three mechanics notes closed;
	// Welcome as the active tab is the natural first screen after setup
	if s.Workspace != nil {
		welcomeID := ids["Welcome"]
		if err := s.Workspace.Set(store.WorkspaceState{OpenIDs: []string{welcomeID}, ActiveID: welcomeID}); err != nil {
			return fmt.Errorf("seed workspace state: %w", err)
		}
	}
	return nil
}

// fileStem returns the base name of a starter path without its extension
func fileStem(p string) string {
	base := filepath.Base(p)
	return strings.TrimSuffix(base, filepath.Ext(base))
}
