package adjacency

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// AdjacencyLog is the persisted inferred path data.
type AdjacencyLog struct {
	Pairs []PairCount `json:"pairs"`
}

// PairCount records inferred co-visit strength between two notes.
type PairCount struct {
	NoteA          string    `json:"note_a"`
	NoteB          string    `json:"note_b"`
	Count          int       `json:"count"`
	LastReinforced time.Time `json:"last_reinforced"`
}

// VisitEvent is an in-memory note open/close event for this app session.
type VisitEvent struct {
	NoteID   string
	OpenedAt time.Time
	ClosedAt time.Time
}

// Store persists AdjacencyLog as adjacency.json.
type Store struct {
	mu   sync.Mutex
	path string
	data AdjacencyLog
}

// ConfigPath returns the trails path inside the sky sidecar.
func ConfigPath(skyDir string) (string, error) {
	return filepath.Join(skyDir, ".glean", "trails.json"), nil
}

// Open loads trails.json from the sky sidecar, creating it if missing.
func Open(skyDir string) (*Store, error) {
	path, err := ConfigPath(skyDir)
	if err != nil {
		return nil, err
	}
	s := &Store{path: path, data: AdjacencyLog{Pairs: []PairCount{}}}

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
		return nil, fmt.Errorf("read adjacency: %w", err)
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, fmt.Errorf("parse adjacency: %w", err)
		}
	}
	if s.data.Pairs == nil {
		s.data.Pairs = []PairCount{}
	}
	return s, nil
}

// Pairs returns a copy of all inferred pairs.
func (s *Store) Pairs() []PairCount {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]PairCount, len(s.data.Pairs))
	copy(out, s.data.Pairs)
	return out
}

// RecordTransition reinforces the pair if two consecutive visits qualify.
func (s *Store) RecordTransition(previous, next VisitEvent, now time.Time) (bool, error) {
	if !Qualifies(previous, next) {
		return false, nil
	}
	return true, s.Reinforce(previous.NoteID, next.NoteID, now)
}

// Reinforce increments an inferred pair without reducing or deleting old counts.
func (s *Store) Reinforce(noteA, noteB string, now time.Time) error {
	a, b := NormalizePair(noteA, noteB)
	if a == "" || b == "" || a == b {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data.Pairs {
		if s.data.Pairs[i].NoteA == a && s.data.Pairs[i].NoteB == b {
			s.data.Pairs[i].Count++
			s.data.Pairs[i].LastReinforced = now
			return s.saveUnlocked()
		}
	}

	s.data.Pairs = append(s.data.Pairs, PairCount{
		NoteA:          a,
		NoteB:          b,
		Count:          1,
		LastReinforced: now,
	})
	sort.Slice(s.data.Pairs, func(i, j int) bool {
		if s.data.Pairs[i].NoteA == s.data.Pairs[j].NoteA {
			return s.data.Pairs[i].NoteB < s.data.Pairs[j].NoteB
		}
		return s.data.Pairs[i].NoteA < s.data.Pairs[j].NoteA
	})
	return s.saveUnlocked()
}

// Qualifies implements session adjacency with intent.
func Qualifies(previous, next VisitEvent) bool {
	if previous.NoteID == "" || next.NoteID == "" || previous.NoteID == next.NoteID {
		return false
	}
	if previous.OpenedAt.IsZero() || previous.ClosedAt.IsZero() || next.OpenedAt.IsZero() {
		return false
	}
	if previous.ClosedAt.Sub(previous.OpenedAt) < 30*time.Second {
		return false
	}
	gap := next.OpenedAt.Sub(previous.ClosedAt)
	return gap >= 0 && gap <= 10*time.Minute
}

// IsDimmed reports whether a rendered path should appear faded.
func IsDimmed(pair PairCount, now time.Time) bool {
	if pair.LastReinforced.IsZero() {
		return true
	}
	return now.Sub(pair.LastReinforced) > 14*24*time.Hour
}

// NormalizePair makes pair counting undirected while preserving the pair fields.
func NormalizePair(noteA, noteB string) (string, string) {
	if noteA <= noteB {
		return noteA, noteB
	}
	return noteB, noteA
}

func (s *Store) saveUnlocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal adjacency: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write adjacency: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename adjacency: %w", err)
	}
	return nil
}
