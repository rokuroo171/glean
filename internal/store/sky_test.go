package store

import (
	"os"
	"path/filepath"
	"testing"
)

func setTestConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)
	return dir
}

func TestAppConfigDirHonorsXDG(t *testing.T) {
	dir := setTestConfigDir(t)
	got, err := AppConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "glean")
	if got != want {
		t.Fatalf("AppConfigDir() = %q, want %q", got, want)
	}
}

func TestPointerSaveLoadRoundTrip(t *testing.T) {
	setTestConfigDir(t)
	p := SkyPointer{SkyPath: filepath.Join("E:", "Storage", "My Sky")}
	if err := SavePointer(p); err != nil {
		t.Fatal(err)
	}
	got, ok, err := LoadPointer()
	if err != nil || !ok {
		t.Fatalf("LoadPointer() = %v, %v, %v", got, ok, err)
	}
	if got != p {
		t.Fatalf("pointer mismatch: %+v != %+v", got, p)
	}
}

func TestLoadPointerMissingFile(t *testing.T) {
	setTestConfigDir(t)
	_, ok, err := LoadPointer()
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expected ok=false for missing pointer")
	}
}

func TestPointerFileIsAtomic(t *testing.T) {
	setTestConfigDir(t)
	p := SkyPointer{SkyPath: "C:\\sky"}
	if err := SavePointer(p); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(filepath.Dir(mustPointerPath(t)))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if e.Name() == "app.json.tmp" {
			t.Fatal("tmp file left behind after atomic save")
		}
	}
}

func mustPointerPath(t *testing.T) string {
	t.Helper()
	p, err := PointerPath()
	if err != nil {
		t.Fatal(err)
	}
	return p
}
