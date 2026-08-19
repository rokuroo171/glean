package store

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/world"
)

// scanDir recursively collects md files under dir, returning relative paths
// from skyRoot. It skips the .glean sidecar directory.
func scanDir(dir, skyRoot string) (map[string]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	files := map[string]string{}
	for _, e := range entries {
		full := filepath.Join(dir, e.Name())
		rel, _ := filepath.Rel(skyRoot, full)
		if e.IsDir() {
			// Skip the sidecar directory and hidden directories.
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			sub, err := scanDir(full, skyRoot)
			if err != nil {
				return nil, err
			}
			for k, v := range sub {
				files[k] = v
			}
			continue
		}
		if !strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			continue
		}
		// Key is the lowercase relative path without extension.
		key := strings.ToLower(strings.TrimSuffix(rel, filepath.Ext(rel)))
		files[key] = rel
	}
	return files, nil
}

// Scan reconciles the sky folder with the registry. Md files anywhere in
// the tree without a registry entry become new notes; entries whose file
// is gone are removed. The File field stores the relative path from sky root.
func Scan(skyDir string, reg *RegistryStore) (added []note.Note, removedIDs []string, err error) {
	files, err := scanDir(skyDir, skyDir)
	if err != nil {
		return nil, nil, fmt.Errorf("scan sky folder: %w", err)
	}

	claimed := map[string]bool{}
	var removed []string
	for _, n := range reg.All() {
		if n.File != "" {
			key := strings.ToLower(strings.TrimSuffix(n.File, filepath.Ext(n.File)))
			if _, ok := files[key]; ok && !claimed[key] {
				claimed[key] = true
				continue
			}
		}
		stem := strings.ToLower(SanitizeTitle(n.Title))
		if _, ok := files[stem]; ok && !claimed[stem] {
			claimed[stem] = true
			continue
		}
		removed = append(removed, n.ID)
	}
	for _, id := range removed {
		if err := reg.Delete(id); err != nil {
			return nil, nil, err
		}
	}

	all := reg.All()
	for key, relPath := range files {
		if claimed[key] {
			continue
		}
		// Title is the filename without extension.
		base := filepath.Base(relPath)
		title := strings.TrimSuffix(base, filepath.Ext(base))
		n := note.Note{ID: NewID(), Title: title, File: relPath}
		p := world.NextSpiralPosition(all, n.ID)
		n.WorldX, n.WorldY, n.Positioned = p.X, p.Y, true
		if err := reg.Create(n); err != nil {
			return nil, nil, err
		}
		all = append(all, n)
		added = append(added, n)
	}
	return added, removed, nil
}

// ScanAddOnly is like Scan but never removes notes. It only adds new md
// files that have no registry entry. Safe to call on window focus without
// risking data loss from matching failures.
func ScanAddOnly(skyDir string, reg *RegistryStore) ([]note.Note, error) {
	files, err := scanDir(skyDir, skyDir)
	if err != nil {
		return nil, fmt.Errorf("scan sky folder: %w", err)
	}

	claimed := map[string]bool{}
	for _, n := range reg.All() {
		if n.File != "" {
			key := strings.ToLower(strings.TrimSuffix(n.File, filepath.Ext(n.File)))
			if _, ok := files[key]; ok && !claimed[key] {
				claimed[key] = true
			}
		}
		stem := strings.ToLower(SanitizeTitle(n.Title))
		if _, ok := files[stem]; ok && !claimed[stem] {
			claimed[stem] = true
		}
	}

	all := reg.All()
	var added []note.Note
	for key, relPath := range files {
		if claimed[key] {
			continue
		}
		base := filepath.Base(relPath)
		title := strings.TrimSuffix(base, filepath.Ext(base))
		n := note.Note{ID: NewID(), Title: title, File: relPath}
		p := world.NextSpiralPosition(all, n.ID)
		n.WorldX, n.WorldY, n.Positioned = p.X, p.Y, true
		if err := reg.Create(n); err != nil {
			return nil, err
		}
		all = append(all, n)
		added = append(added, n)
	}
	return added, nil
}
