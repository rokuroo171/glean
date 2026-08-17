package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/world"
)

// RegistryEntry is the persisted per-note behavior metadata. No body.
type RegistryEntry struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	CreatedAt       time.Time `json:"created_at"`
	LastVisited     time.Time `json:"last_visited"`
	VisitCount      int       `json:"visit_count"`
	LastManualWater time.Time `json:"last_manual_water"`
	WorldX          int       `json:"world_x"`
	WorldY          int       `json:"world_y"`
	Positioned      bool      `json:"positioned"`
}

func entryFromNote(n note.Note) RegistryEntry {
	return RegistryEntry{
		ID: n.ID, Title: n.Title, CreatedAt: n.CreatedAt,
		LastVisited: n.LastVisited, VisitCount: n.VisitCount,
		LastManualWater: n.LastManualWater, WorldX: n.WorldX,
		WorldY: n.WorldY, Positioned: n.Positioned,
	}
}

func entryToNote(e RegistryEntry) note.Note {
	return note.Note{
		ID: e.ID, Title: e.Title, CreatedAt: e.CreatedAt,
		LastVisited: e.LastVisited, VisitCount: e.VisitCount,
		LastManualWater: e.LastManualWater, WorldX: e.WorldX,
		WorldY: e.WorldY, Positioned: e.Positioned,
	}
}

// RegistryStore persists RegistryEntry as .glean/notes.json.
type RegistryStore struct {
	mu      sync.Mutex
	path    string
	entries []RegistryEntry
}

// NewID returns a random hex note id.
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// OpenRegistry loads the registry, positioning any note missing coordinates.
func OpenRegistry(skyDir string) (*RegistryStore, error) {
	path := filepath.Join(SidecarDir(skyDir), "notes.json")
	s := &RegistryStore{path: path, entries: []RegistryEntry{}}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create sidecar dir: %w", err)
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return s, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read registry: %w", err)
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &s.entries); err != nil {
			return nil, fmt.Errorf("parse registry: %w", err)
		}
	}
	if s.entries == nil {
		s.entries = []RegistryEntry{}
	}
	notes := make([]note.Note, len(s.entries))
	for i, e := range s.entries {
		notes[i] = entryToNote(e)
	}
	if positioned, changed := world.LockMissingPositions(notes); changed {
		s.entries = s.entries[:0]
		for _, n := range positioned {
			s.entries = append(s.entries, entryFromNote(n))
		}
		if err := s.saveUnlocked(); err != nil {
			return nil, err
		}
	}
	return s, nil
}

// All returns all entries as notes with empty bodies.
func (s *RegistryStore) All() []note.Note {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]note.Note, len(s.entries))
	for i, e := range s.entries {
		out[i] = entryToNote(e)
	}
	return out
}

// Get returns one entry by id.
func (s *RegistryStore) Get(id string) (note.Note, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.entries {
		if e.ID == id {
			return entryToNote(e), true
		}
	}
	return note.Note{}, false
}

// Create appends an entry and persists.
func (s *RegistryStore) Create(n note.Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = append(s.entries, entryFromNote(n))
	return s.saveUnlocked()
}

// Update replaces an entry by id and persists.
func (s *RegistryStore) Update(n note.Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, e := range s.entries {
		if e.ID == n.ID {
			s.entries[i] = entryFromNote(n)
			return s.saveUnlocked()
		}
	}
	return fmt.Errorf("note not found: %s", n.ID)
}

// Delete removes an entry by id and persists.
func (s *RegistryStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, e := range s.entries {
		if e.ID == id {
			s.entries = append(s.entries[:i], s.entries[i+1:]...)
			return s.saveUnlocked()
		}
	}
	return fmt.Errorf("note not found: %s", id)
}

func (s *RegistryStore) saveUnlocked() error {
	raw, err := json.MarshalIndent(s.entries, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal registry: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write registry: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename registry: %w", err)
	}
	return nil
}
