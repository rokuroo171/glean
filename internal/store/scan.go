package store

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/world"
)

// Scan reconciles the sky folder with the registry. Root-level md files
// without a registry entry become new notes; entries whose derived file is
// gone are removed.
func Scan(skyDir string, reg *RegistryStore) (added []note.Note, removedIDs []string, err error) {
	entries, err := os.ReadDir(skyDir)
	if err != nil {
		return nil, nil, fmt.Errorf("list sky folder: %w", err)
	}

	files := map[string]string{} // lowercase stem -> actual filename
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			continue
		}
		stem := strings.ToLower(strings.TrimSuffix(e.Name(), filepath.Ext(e.Name())))
		files[stem] = e.Name()
	}

	claimed := map[string]bool{} // lowercase stems already matched to an entry
	var removed []string
	for _, n := range reg.All() {
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
	for stem, filename := range files {
		if claimed[stem] {
			continue
		}
		title := strings.TrimSuffix(filename, filepath.Ext(filename))
		n := note.Note{ID: NewID(), Title: title}
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
