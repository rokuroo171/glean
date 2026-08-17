package activity

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
)

// Activity is the persisted sky activity summary.
type Activity struct {
	DailyCounts    map[string]int `json:"daily_counts"`
	CurrentStreak  int            `json:"current_streak"`
	LongestStreak  int            `json:"longest_streak"`
	LastActiveDate string         `json:"last_active_date"`
	Milestones     Milestones     `json:"milestones"`
}

// Milestones records the first time a sky-level threshold became true.
type Milestones struct {
	FirstSproutAt *time.Time `json:"first_sprout_at,omitempty"`
	FirstTreeAt   *time.Time `json:"first_tree_at,omitempty"`
	TenNotesAt    *time.Time `json:"ten_notes_at,omitempty"`
	TwentyNotesAt *time.Time `json:"twenty_notes_at,omitempty"`
}

// Store persists Activity as activity.json.
type Store struct {
	mu   sync.Mutex
	path string
	data Activity
}

// ConfigPath returns the stats path inside the sky sidecar.
func ConfigPath(skyDir string) (string, error) {
	return filepath.Join(skyDir, ".glean", "stats.json"), nil
}

// Open loads stats.json from the sky sidecar, creating it if missing.
func Open(skyDir string) (*Store, error) {
	path, err := ConfigPath(skyDir)
	if err != nil {
		return nil, err
	}
	s := &Store{path: path, data: emptyActivity()}

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
		return nil, fmt.Errorf("read activity: %w", err)
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, fmt.Errorf("parse activity: %w", err)
		}
	}
	if s.data.DailyCounts == nil {
		s.data.DailyCounts = map[string]int{}
	}
	return s, nil
}

// Data returns a copy of the activity summary.
func (s *Store) Data() Activity {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.data
	out.DailyCounts = make(map[string]int, len(s.data.DailyCounts))
	for k, v := range s.data.DailyCounts {
		out.DailyCounts[k] = v
	}
	out.Milestones = copyMilestones(s.data.Milestones)
	return out
}

// Record increments today's activity and refreshes streaks/milestones.
func (s *Store) Record(now time.Time, notes []note.Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.data.DailyCounts == nil {
		s.data.DailyCounts = map[string]int{}
	}
	date := dateKey(now)
	s.data.DailyCounts[date]++
	s.data.LastActiveDate = latestDate(s.data.LastActiveDate, date)
	updateMilestones(&s.data.Milestones, now, notes)
	pruneDailyCounts(s.data.DailyCounts, now)
	recomputeStreaks(&s.data, now)

	return s.saveUnlocked()
}

func emptyActivity() Activity {
	return Activity{DailyCounts: map[string]int{}}
}

func updateMilestones(m *Milestones, now time.Time, notes []note.Note) {
	if m.FirstSproutAt == nil {
		for _, n := range notes {
			if growth.BrightnessStage(n) >= growth.DimStar {
				m.FirstSproutAt = timePtr(now)
				break
			}
		}
	}
	if m.FirstTreeAt == nil {
		for _, n := range notes {
			if growth.BrightnessStage(n) == growth.BrightStar {
				m.FirstTreeAt = timePtr(now)
				break
			}
		}
	}
	if m.TenNotesAt == nil && len(notes) >= 10 {
		m.TenNotesAt = timePtr(now)
	}
	if m.TwentyNotesAt == nil && len(notes) >= 20 {
		m.TwentyNotesAt = timePtr(now)
	}
}

func pruneDailyCounts(counts map[string]int, now time.Time) {
	cutoff := dateOnly(now).AddDate(0, 0, -89)
	for key := range counts {
		d, err := time.ParseInLocation("2006-01-02", key, now.Location())
		if err != nil || d.Before(cutoff) {
			delete(counts, key)
		}
	}
}

func recomputeStreaks(a *Activity, now time.Time) {
	current := 0
	for d := dateOnly(now); ; d = d.AddDate(0, 0, -1) {
		if a.DailyCounts[dateKey(d)] == 0 {
			break
		}
		current++
	}
	a.CurrentStreak = current

	keys := make([]string, 0, len(a.DailyCounts))
	for key, count := range a.DailyCounts {
		if count > 0 {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)

	longest := 0
	run := 0
	var prev time.Time
	for _, key := range keys {
		d, err := time.ParseInLocation("2006-01-02", key, now.Location())
		if err != nil {
			continue
		}
		if run == 0 || d.Sub(prev) == 24*time.Hour {
			run++
		} else {
			run = 1
		}
		if run > longest {
			longest = run
		}
		prev = d
	}
	if longest > a.LongestStreak {
		a.LongestStreak = longest
	}
}

func latestDate(a, b string) string {
	if a == "" || b > a {
		return b
	}
	return a
}

func dateKey(t time.Time) string {
	return dateOnly(t).Format("2006-01-02")
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func copyMilestones(m Milestones) Milestones {
	return Milestones{
		FirstSproutAt: copyTimePtr(m.FirstSproutAt),
		FirstTreeAt:   copyTimePtr(m.FirstTreeAt),
		TenNotesAt:    copyTimePtr(m.TenNotesAt),
		TwentyNotesAt: copyTimePtr(m.TwentyNotesAt),
	}
}

func timePtr(t time.Time) *time.Time {
	copy := t
	return &copy
}

func copyTimePtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	copy := *t
	return &copy
}

func (s *Store) saveUnlocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal activity: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write activity: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename activity: %w", err)
	}
	return nil
}
