// Package assets manages images imported into a sky (vault).
//
// Imported files live in <sky>/.glean/assets/ so the note scanner
// (which skips the .glean sidecar dir) never treats them as notes.
// Notes reference them with vault-relative paths, keeping the .md
// files portable: the same note renders on any machine that has the
// sky folder.
package assets

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glean/glean/internal/store"
)

// MaxImageBytes caps a single imported image. 20 MB is generous for
// screenshots and photos while keeping the sidecar from ballooning.
const MaxImageBytes = 20 << 20

// Extensions glean accepts for imported images, keyed by lowercase ext.
var Extensions = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".gif":  true,
	".webp": true,
	".svg":  true,
}

// ErrTooLarge is returned when an image exceeds MaxImageBytes.
var ErrTooLarge = errors.New("image exceeds the 20 MB size limit")

// ErrUnsupported is returned when the filename has no accepted extension.
var ErrUnsupported = errors.New("unsupported image format")

// AssetsDir returns the sidecar assets folder for a sky.
func AssetsDir(skyDir string) string {
	return filepath.Join(store.SidecarDir(skyDir), "assets")
}

// uniqueName picks a safe filename inside dir that does not exist yet.
// The original extension is preserved; duplicates get a numeric suffix.
func uniqueName(dir, name string) (string, error) {
	clean := filepath.Base(name)
	if clean == "." || clean == string(filepath.Separator) {
		return "", errors.New("invalid image name")
	}
	ext := strings.ToLower(filepath.Ext(clean))
	stem := strings.TrimSuffix(clean, filepath.Ext(clean))
	if !Extensions[ext] {
		return "", ErrUnsupported
	}
	// Reuse the title sanitizer the rest of the app uses for filenames,
	// then re-append the real extension.
	stem = store.SanitizeTitle(stem)
	if stem == "" {
		stem = "image"
	}
	candidate := stem + ext
	for i := 1; ; i++ {
		p := filepath.Join(dir, candidate)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d%s", stem, i, ext)
	}
}

// ImportImage writes data as name inside the sky's assets dir and
// returns the vault-relative path to embed in a note (e
// ".glean/assets/sunset.png"). The file is written to a random temp
// name first, then renamed into place once it has been read back and
// hash-verified, so a failed copy never leaves a half-written image
// behind.
func ImportImage(skyDir, name string, data []byte) (string, error) {
	if len(data) == 0 {
		return "", errors.New("empty image")
	}
	if len(data) > MaxImageBytes {
		return "", ErrTooLarge
	}
	dir := AssetsDir(skyDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create assets dir: %w", err)
	}
	rel, err := uniqueName(dir, name)
	if err != nil {
		return "", err
	}
	full := filepath.Join(dir, rel)

	// Write to a random temp file in the same dir, verify, then rename.
	tmp := full + ".tmp-" + randHex(6)
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return "", fmt.Errorf("write image: %w", err)
	}
	got, err := os.ReadFile(tmp)
	if err != nil {
		os.Remove(tmp)
		return "", fmt.Errorf("verify image: %w", err)
	}
	if sha256.Sum256(got) != sha256.Sum256(data) {
		os.Remove(tmp)
		return "", errors.New("image write failed verification")
	}
	if err := os.Rename(tmp, full); err != nil {
		os.Remove(tmp)
		return "", fmt.Errorf("finalize image: %w", err)
	}
	// The note embeds the vault-relative path with forward slashes so
	// the same markdown reads the same on every OS.
	return filepath.ToSlash(filepath.Join(".glean", "assets", rel)), nil
}

// randHex returns n random bytes hex-encoded, for temp filenames.
func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
