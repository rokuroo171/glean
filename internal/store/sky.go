package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// KnownSky is a remembered sky entry for the manage-skies UI.
type KnownSky struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// SkyPointer is the app-level pointer to the configured Sky folder.
type SkyPointer struct {
	SkyPath          string     `json:"sky_path"`
	MigrationSkipped bool       `json:"migration_skipped,omitempty"`
	KnownSkies       []KnownSky `json:"known_skies,omitempty"`
}

// AppConfigDir returns the platform-appropriate config directory for glean.
//
// Linux:  $XDG_CONFIG_HOME/glean  (defaults to ~/.config/glean)
// Windows: %APPDATA%/glean       (C:\Users\<user>\AppData\Roaming\glean)
// macOS:  ~/Library/Application Support/glean
func AppConfigDir() (string, error) {
	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "glean"), nil
		}
		// Fallback: use home directory
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		return filepath.Join(home, "AppData", "Roaming", "glean"), nil

	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		return filepath.Join(home, "Library", "Application Support", "glean"), nil

	default: // linux, freebsd, etc.
		if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
			return filepath.Join(xdg, "glean"), nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		return filepath.Join(home, ".config", "glean"), nil
	}
}

// PointerPath returns the path to the app pointer file.
func PointerPath() (string, error) {
	dir, err := AppConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "app.json"), nil
}

// LoadPointer reads the pointer, returning ok=false when the file is missing.
func LoadPointer() (SkyPointer, bool, error) {
	path, err := PointerPath()
	if err != nil {
		return SkyPointer{}, false, err
	}
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return SkyPointer{}, false, nil
	}
	if err != nil {
		return SkyPointer{}, false, fmt.Errorf("read pointer: %w", err)
	}
	var p SkyPointer
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &p); err != nil {
			return SkyPointer{}, false, fmt.Errorf("parse pointer: %w", err)
		}
	}
	return p, true, nil
}

// SavePointer writes the pointer atomically.
func SavePointer(p SkyPointer) error {
	dir, err := AppConfigDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	raw, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal pointer: %w", err)
	}
	path, err := PointerPath()
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write pointer: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename pointer: %w", err)
	}
	return nil
}

// ResolveSky returns the configured sky folder and whether one exists.
func ResolveSky() (string, bool, error) {
	p, ok, err := LoadPointer()
	if err != nil || !ok {
		return "", ok, err
	}
	if p.SkyPath == "" {
		return "", false, nil
	}
	return p.SkyPath, true, nil
}

// SidecarDir returns the hidden sidecar folder inside a Sky folder.
func SidecarDir(skyDir string) string {
	return filepath.Join(skyDir, ".glean")
}

type skyMeta struct {
	Name string `json:"name"`
}

// CreateSky creates the Sky folder and its sidecar, writing the sky name.
func CreateSky(dir, name string) error {
	if err := os.MkdirAll(SidecarDir(dir), 0o755); err != nil {
		return fmt.Errorf("create sky folder: %w", err)
	}
	raw, err := json.MarshalIndent(skyMeta{Name: name}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal sky meta: %w", err)
	}
	path := filepath.Join(SidecarDir(dir), "sky.json")
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write sky meta: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename sky meta: %w", err)
	}
	return nil
}

// LoadSkyName reads the sky name from the sidecar.
func LoadSkyName(skyDir string) (string, error) {
	raw, err := os.ReadFile(filepath.Join(SidecarDir(skyDir), "sky.json"))
	if err != nil {
		return "", fmt.Errorf("read sky meta: %w", err)
	}
	var m skyMeta
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", fmt.Errorf("parse sky meta: %w", err)
	}
	return m.Name, nil
}

// SanitizeSkyName makes a sky name safe as a folder name and caps it.
// Errors when nothing survives sanitizing.
func SanitizeSkyName(name string) (string, error) {
	out := SanitizeTitle(name)
	if len(out) > 60 {
		out = out[:60]
	}
	if out == "" {
		return "", fmt.Errorf("sky name is empty after sanitizing")
	}
	return out, nil
}

// AddKnownSky adds a sky to the known list if not already present.
func AddKnownSky(name, path string) error {
	p, ok, err := LoadPointer()
	if err != nil {
		return err
	}
	if !ok {
		p = SkyPointer{}
	}
	// Dedupe by path.
	for _, ks := range p.KnownSkies {
		if ks.Path == path {
			return nil
		}
	}
	p.KnownSkies = append(p.KnownSkies, KnownSky{Name: name, Path: path})
	return SavePointer(p)
}

// RemoveKnownSky removes a sky from the known list by path.
func RemoveKnownSky(path string) error {
	p, ok, err := LoadPointer()
	if err != nil || !ok {
		return err
	}
	filtered := p.KnownSkies[:0]
	for _, ks := range p.KnownSkies {
		if ks.Path != path {
			filtered = append(filtered, ks)
		}
	}
	p.KnownSkies = filtered
	return SavePointer(p)
}

// SwitchSky updates the active sky path and reloads the pointer.
func SwitchSky(path string) error {
	p, ok, err := LoadPointer()
	if err != nil {
		return err
	}
	if !ok {
		p = SkyPointer{}
	}
	p.SkyPath = path
	return SavePointer(p)
}
