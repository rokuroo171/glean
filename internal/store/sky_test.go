package store

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

func setTestConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	switch runtime.GOOS {
	case "windows":
		t.Setenv("APPDATA", dir)
	case "darwin":
		// macOS uses ~/Library/Application Support. Create the subdirs so
		// AppConfigDir resolves into our temp tree.
		libDir := filepath.Join(dir, "Library", "Application Support")
		os.MkdirAll(libDir, 0o755)
		t.Setenv("HOME", dir)
	default:
		t.Setenv("XDG_CONFIG_HOME", dir)
	}
	// Return the actual config dir that AppConfigDir will resolve to,
	// so callers can write files where the code expects them.
	cfgDir, err := AppConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	return filepath.Dir(cfgDir) // parent of "glean"
}

func TestAppConfigDirHonorsXDG(t *testing.T) {
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		t.Skip("XDG only applies on Linux")
	}
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

func TestAppConfigDirPlatform(t *testing.T) {
	got, err := AppConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	switch runtime.GOOS {
	case "windows":
		// Should contain AppData\Roaming\glean or fallback path
		if filepath.Base(got) != "glean" {
			t.Fatalf("expected path ending in glean, got %q", got)
		}
	case "darwin":
		want := filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "glean")
		if got != want {
			t.Fatalf("AppConfigDir() = %q, want %q", got, want)
		}
	default:
		// Linux: should end with .config/glean (or XDG override)
		if filepath.Base(got) != "glean" {
			t.Fatalf("expected path ending in glean, got %q", got)
		}
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
	if !reflect.DeepEqual(got, p) {
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

func TestCreateSkyWritesName(t *testing.T) {
	dir := t.TempDir()
	skyDir := filepath.Join(dir, "My Sky")
	if err := CreateSky(skyDir, "My Sky"); err != nil {
		t.Fatal(err)
	}
	name, err := LoadSkyName(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if name != "My Sky" {
		t.Fatalf("LoadSkyName() = %q, want %q", name, "My Sky")
	}
	if _, err := os.Stat(filepath.Join(skyDir, ".glean", "sky.json")); err != nil {
		t.Fatalf("sky.json missing: %v", err)
	}
}

func TestCreateSkyIdempotent(t *testing.T) {
	dir := t.TempDir()
	skyDir := filepath.Join(dir, "sky")
	if err := CreateSky(skyDir, "sky"); err != nil {
		t.Fatal(err)
	}
	if err := CreateSky(skyDir, "sky"); err != nil {
		t.Fatalf("second CreateSky failed: %v", err)
	}
}

func TestResolveSky(t *testing.T) {
	setTestConfigDir(t)
	if _, ok, err := ResolveSky(); err != nil || ok {
		t.Fatalf("ResolveSky() = %v, %v", ok, err)
	}
	dir := t.TempDir()
	if err := SavePointer(SkyPointer{SkyPath: dir}); err != nil {
		t.Fatal(err)
	}
	got, ok, err := ResolveSky()
	if err != nil || !ok || got != dir {
		t.Fatalf("ResolveSky() = %q, %v, %v", got, ok, err)
	}
}

func TestSanitizeSkyName(t *testing.T) {
	cases := []struct{ in, want string }{
		{"My Sky", "My Sky"},
		{`Weird: "name" / with? *stars*`, "Weird name  with stars"},
		{"  padded  ", "padded"},
		{"CON", "_CON"},
	}
	for _, c := range cases {
		got, err := SanitizeSkyName(c.in)
		if err != nil {
			t.Fatalf("SanitizeSkyName(%q) errored: %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("SanitizeSkyName(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSanitizeSkyNameRejectsEmpty(t *testing.T) {
	for _, in := range []string{"", "   ", "***"} {
		if _, err := SanitizeSkyName(in); err == nil {
			t.Errorf("SanitizeSkyName(%q) should error", in)
		}
	}
}

func TestSanitizeSkyNameCapsAt60(t *testing.T) {
	long := ""
	for i := 0; i < 70; i++ {
		long += "a"
	}
	got, err := SanitizeSkyName(long)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 60 {
		t.Fatalf("len = %d, want 60", len(got))
	}
}
