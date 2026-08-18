package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/world"
)

// LegacyPaths returns the three legacy JSON paths in the config dir.
func LegacyPaths() (notesPath, trailsPath, statsPath string, err error) {
	dir, err := AppConfigDir()
	if err != nil {
		return "", "", "", err
	}
	return filepath.Join(dir, "glean.json"),
		filepath.Join(dir, "adjacency.json"),
		filepath.Join(dir, "activity.json"), nil
}

// HasLegacy reports whether any legacy JSON store exists.
func HasLegacy() (bool, error) {
	notes, trails, stats, err := LegacyPaths()
	if err != nil {
		return false, err
	}
	for _, p := range []string{notes, trails, stats} {
		if _, err := os.Stat(p); err == nil {
			return true, nil
		} else if !os.IsNotExist(err) {
			return false, err
		}
	}
	return false, nil
}

// MigrateReport summarizes a legacy import.
type MigrateReport struct {
	Imported int      `json:"imported"`
	Failures []string `json:"failures,omitempty"`
}

// Migrate copies the legacy store into a Sky folder. Legacy files are
// read-only here.
func Migrate(skyDir string) (MigrateReport, error) {
	notesPath, trailsPath, statsPath, err := LegacyPaths()
	if err != nil {
		return MigrateReport{}, err
	}

	var coll note.Collection
	if raw, err := os.ReadFile(notesPath); err == nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, &coll); err != nil {
			return MigrateReport{}, fmt.Errorf("parse legacy notes: %w", err)
		}
	}
	var adj adjacency.AdjacencyLog
	if raw, err := os.ReadFile(trailsPath); err == nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, &adj)
	}
	var act activity.Activity
	if raw, err := os.ReadFile(statsPath); err == nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, &act)
	}

	if err := os.MkdirAll(SidecarDir(skyDir), 0o755); err != nil {
		return MigrateReport{}, fmt.Errorf("create sidecar: %w", err)
	}

	reg, err := OpenRegistry(skyDir)
	if err != nil {
		return MigrateReport{}, err
	}

	report := MigrateReport{}
	for _, n := range coll.Notes {
		name, err := FileNameFor(skyDir, n.Title)
		if err != nil {
			report.Failures = append(report.Failures, n.Title)
			continue
		}
		if err := WriteNoteFile(name, n.Body); err != nil {
			report.Failures = append(report.Failures, n.Title)
			continue
		}
		if n.ID == "" {
			n.ID = NewID()
		}
		n.File = filepath.Base(name)
		if !n.Positioned {
			p := world.NextSpiralPosition(reg.All(), n.ID)
			n.WorldX, n.WorldY, n.Positioned = p.X, p.Y, true
		}
		if err := reg.Create(n); err != nil {
			report.Failures = append(report.Failures, n.Title)
			continue
		}
		report.Imported++
	}

	writeJSON := func(path string, v any) error {
		raw, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			return err
		}
		tmp := path + ".tmp"
		if err := os.WriteFile(tmp, raw, 0o644); err != nil {
			return err
		}
		return os.Rename(tmp, path)
	}
	if err := writeJSON(filepath.Join(SidecarDir(skyDir), "trails.json"), adj); err != nil {
		return report, err
	}
	if err := writeJSON(filepath.Join(SidecarDir(skyDir), "stats.json"), act); err != nil {
		return report, err
	}
	return report, nil
}
