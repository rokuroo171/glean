package adjacency

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestOpenWritesTrailsInSidecar(t *testing.T) {
	skyDir := t.TempDir()
	s, err := Open(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(skyDir, ".glean", "trails.json")); err != nil {
		t.Fatalf("trails.json missing: %v", err)
	}
	now := time.Now()
	if err := s.Reinforce("a", "b", now); err != nil {
		t.Fatal(err)
	}
	s2, err := Open(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(s2.Pairs()) != 1 {
		t.Fatalf("pairs not persisted, got %d", len(s2.Pairs()))
	}
}
