package activity

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenWritesStatsInSidecar(t *testing.T) {
	skyDir := t.TempDir()
	s, err := Open(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(skyDir, ".glean", "stats.json")); err != nil {
		t.Fatalf("stats.json missing: %v", err)
	}
	if s.Data().DailyCounts == nil {
		t.Fatal("daily counts not initialized")
	}
}
