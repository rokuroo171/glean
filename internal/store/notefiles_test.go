package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSanitizeTitle(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"hello", "hello"},
		{"<script>alert(1)</script>", "scriptalert(1)script"},
		{"/etc/passwd", "etcpasswd"},
		{`C:\Users\evil`, "CUsersevil"},
		{"CON", "_CON"},
		{"  padded  ", "padded"},
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
	got, err := FileNameFor(skyDir, "", "Steady light")
	if err != nil {
		t.Fatal(err)
	}
	if got != filepath.Join(skyDir, "Steady light 3.md") {
		t.Fatalf("FileNameFor() = %q, want %q", got, filepath.Join(skyDir, "Steady light 3.md"))
	}
}

func TestWriteReadDelete(t *testing.T) {
	skyDir := t.TempDir()
	path := filepath.Join(skyDir, "test.md")
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
		t.Fatal("file should be deleted")
	}
}

func TestValidateInsideDir(t *testing.T) {
	root := t.TempDir()

	// Valid path inside root.
	inner := filepath.Join(root, "sub", "file.md")
	if err := ValidateInsideDir(root, inner); err != nil {
		t.Fatalf("expected no error for inner path, got: %v", err)
	}

	// Path traversal with ..
	outer := filepath.Join(root, "..", "escape")
	if err := ValidateInsideDir(root, outer); err == nil {
		t.Fatal("expected error for path escaping root")
	}

	// Absolute path outside root.
	if err := ValidateInsideDir(root, "/etc/passwd"); err == nil {
		t.Fatal("expected error for /etc/passwd")
	}

	// Same directory is fine.
	if err := ValidateInsideDir(root, root); err != nil {
		t.Fatalf("root itself should be valid: %v", err)
	}
}

func TestFileNameForCapsAtLimit(t *testing.T) {
	skyDir := t.TempDir()
	// Create many duplicates to test the cap.
	for i := 0; i < 5; i++ {
		name := filepath.Join(skyDir, "dup"+string(rune('0'+i))+".md")
		os.WriteFile(name, []byte("x"), 0o644)
	}
	// Should still work (under the 10000 limit).
	got, err := FileNameFor(skyDir, "", "dup")
	if err != nil {
		t.Fatal(err)
	}
	if got == "" {
		t.Fatal("FileNameFor returned empty path")
	}
}
