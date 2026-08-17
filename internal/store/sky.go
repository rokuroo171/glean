package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// SkyPointer is the app-level pointer to the configured Sky folder.
type SkyPointer struct {
	SkyPath          string `json:"sky_path"`
	MigrationSkipped bool   `json:"migration_skipped,omitempty"`
}

// AppConfigDir returns the glean config dir honoring XDG_CONFIG_HOME.
func AppConfigDir() (string, error) {
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		configHome = filepath.Join(home, ".config")
	}
	return filepath.Join(configHome, "glean"), nil
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
