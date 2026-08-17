package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSanitizeTitle(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Steady light", "Steady light"},
		{`Bad: "name" / with? *stars*`, "Bad name  with stars"},
		{"  padded  ", "padded"},
		{"trailing dots...", "trailing dots"},
		{"CON", "_CON"},
		{"LPT1", "_LPT1"},
		{"nul", "_nul"},
	}
	for _, c := range cases {
		if got := SanitizeTitle(c.in); got != c.want {
			t.Errorf("SanitizeTitle(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestFileNameForDedupes(t *testing.T) {
	skyDir := t.TempDir()
	if err := WriteNoteFile(filepath.Join(skyDir, "Steady light.md"), "a"); err != nil {
		t.Fatal(err)
	}
	if err := WriteNoteFile(filepath.Join(skyDir, "Steady light 2.md"), "b"); err != nil {
		t.Fatal(err)
	}
	got, err := FileNameFor(skyDir, "Steady light")
	if err != nil {
		t.Fatal(err)
	}
	if got != filepath.Join(skyDir, "Steady light 3.md") {
		t.Fatalf("FileNameFor() = %q, want %q", got, filepath.Join(skyDir, "Steady light 3.md"))
	}
}

func TestWriteReadDelete(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "note.md")
	if err := WriteNoteFile(path, "# hello\n\nbody"); err != nil {
		t.Fatal(err)
	}
	got, err := ReadNoteFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got != "# hello\n\nbody" {
		t.Fatalf("ReadNoteFile() = %q", got)
	}
	if err := DeleteNoteFile(path); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("file still exists after delete")
	}
}
