package store

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ValidateInsideDir checks that target resolves to a path within root.
// Returns an error if the path escapes the root via symlink or .. traversal.
func ValidateInsideDir(root, target string) error {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return fmt.Errorf("resolve root: %w", err)
	}
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return fmt.Errorf("resolve target: %w", err)
	}
	// Check prefix. filepath.Rel gives us the relative path; if it
	// starts with ".." the target is outside root.
	rel, err := filepath.Rel(absRoot, absTarget)
	if err != nil {
		return fmt.Errorf("path check: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("path escapes sky directory: %s", target)
	}
	return nil
}

var reservedNames = map[string]bool{
	"CON": true, "PRN": true, "AUX": true, "NUL": true,
}

func isReserved(name string) bool {
	if reservedNames[strings.ToUpper(name)] {
		return true
	}
	base := strings.ToUpper(name)
	for i := 1; i <= 9; i++ {
		if base == fmt.Sprintf("COM%d", i) || base == fmt.Sprintf("LPT%d", i) {
			return true
		}
	}
	return false
}

// SanitizeTitle makes a title safe as a Windows filename stem.
func SanitizeTitle(title string) string {
	replacer := strings.NewReplacer(
		"<", "", ">", "", ":", "", `"`, "", "/", "",
		"\\", "", "|", "", "?", "", "*", "",
	)
	out := strings.TrimRight(strings.TrimLeft(replacer.Replace(title), " ."), " .")
	if len(out) > 200 {
		out = out[:200]
	}
	if isReserved(out) {
		out = "_" + out
	}
	return out
}

// FileNameFor returns a deduped .md path for a title inside a subfolder
// of the sky directory. folder is the relative path from skyDir (empty for
// root). It checks disk case-insensitively.
func FileNameFor(skyDir, folder, title string) (string, error) {
	stem := SanitizeTitle(title)
	if stem == "" {
		stem = "Untitled"
	}
	dir := filepath.Join(skyDir, folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create folder: %w", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("list folder: %w", err)
	}
	taken := map[string]bool{}
	for _, e := range entries {
		if !e.IsDir() && strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			taken[strings.ToLower(e.Name())] = true
		}
	}
	name := stem + ".md"
	if !taken[strings.ToLower(name)] {
		return filepath.Join(dir, name), nil
	}
	for i := 2; i < 10000; i++ {
		name = fmt.Sprintf("%s %d.md", stem, i)
		if !taken[strings.ToLower(name)] {
			return filepath.Join(dir, name), nil
		}
	}
	return "", fmt.Errorf("too many duplicates for title: %s", stem)
}

// WriteNoteFile writes a note body atomically.
func WriteNoteFile(path, body string) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(body), 0o644); err != nil {
		return fmt.Errorf("write note file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename note file: %w", err)
	}
	return nil
}

// ReadNoteFile reads a note body.
func ReadNoteFile(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read note file: %w", err)
	}
	return string(raw), nil
}

// DeleteNoteFile removes a note file.
func DeleteNoteFile(path string) error {
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete note file: %w", err)
	}
	return nil
}

// FolderOf returns the directory portion of a note's relative File path.
// "glean/arch" -> "glean", "note" -> "".
func FolderOf(file string) string {
	dir := filepath.Dir(file)
	if dir == "." {
		return ""
	}
	return dir
}

// CreateFolder creates an empty .md file inside the given subfolder so
// the folder appears in the file system and the explorer.
func CreateFolder(skyDir, folder, name string) (string, error) {
	return FileNameFor(skyDir, folder, name)
}
