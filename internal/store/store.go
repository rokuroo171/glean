package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/world"
)

type Store struct {
	mu   sync.Mutex
	path string
	data note.Collection
}

func ConfigPath() (string, error) {
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		configHome = filepath.Join(home, ".config")
	}
	return filepath.Join(configHome, "glean", "glean.json"), nil
}

func Open() (*Store, error) {
	path, err := ConfigPath()
	if err != nil {
		return nil, err
	}

	s := &Store{path: path, data: note.Collection{Notes: []note.Note{}}}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := s.saveUnlocked(); err != nil {
			return nil, err
		}
		return s, nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read store: %w", err)
	}

	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, fmt.Errorf("parse store: %w", err)
		}
	}
	if s.data.Notes == nil {
		s.data.Notes = []note.Note{}
	}
	if positioned, changed := world.LockMissingPositions(s.data.Notes); changed {
		s.data.Notes = positioned
		if err := s.saveUnlocked(); err != nil {
			return nil, err
		}
	}

	return s, nil
}

// Notes returns a copy of all notes.
func (s *Store) Notes() []note.Note {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]note.Note, len(s.data.Notes))
	copy(out, s.data.Notes)
	return out
}

// Get returns a note by ID.
func (s *Store) Get(id string) (note.Note, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, n := range s.data.Notes {
		if n.ID == id {
			return n, true
		}
	}
	return note.Note{}, false
}

// Create appends a note and persists.
func (s *Store) Create(n note.Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !n.Positioned {			p := world.NextSpiralPosition(s.data.Notes, n.ID)
			n.WorldX = p.X
		n.WorldY = p.Y
		n.Positioned = true
	}
	s.data.Notes = append(s.data.Notes, n)
	return s.saveUnlocked()
}

// Update replaces a note by ID and persists.
func (s *Store) Update(n note.Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, existing := range s.data.Notes {
		if existing.ID == n.ID {
			s.data.Notes[i] = n
			return s.saveUnlocked()
		}
	}
	return fmt.Errorf("note not found: %s", n.ID)
}

// Delete removes a note by ID and persists.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, n := range s.data.Notes {
		if n.ID == id {
			s.data.Notes = append(s.data.Notes[:i], s.data.Notes[i+1:]...)
			return s.saveUnlocked()
		}
	}
	return fmt.Errorf("note not found: %s", id)
}

func (s *Store) saveUnlocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal store: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write store: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename store: %w", err)
	}
	return nil
}
