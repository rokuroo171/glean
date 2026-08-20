package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Preferences holds all user customization settings.
type Preferences struct {
	Theme    ThemePrefs    `json:"theme"`
	Layout   LayoutPrefs   `json:"layout"`
	Editor   EditorPrefs   `json:"editor"`
}

// ThemePrefs controls colors and visual appearance.
type ThemePrefs struct {
	Preset     string `json:"preset"`      // "midnight", "aurora", "ember", "ocean", "lavender"
	AccentHex  string `json:"accent_hex"`  // e.g. "#5b9fd4"
}

// LayoutPrefs controls panel positions and density.
type LayoutPrefs struct {
	SidebarPosition string `json:"sidebar_position"` // "left" (default), "right"
	Density         string `json:"density"`          // "comfortable" (default), "compact", "dense"
	ShowStatusBar   *bool  `json:"show_status_bar"`  // nil = true (default)
}

// EditorPrefs controls editor behavior and appearance.
type EditorPrefs struct {
	CursorTrailMode  string `json:"cursor_trail_mode"`  // "kitty" (default), "sparkle", "ink"
	CursorTrailColor string `json:"cursor_trail_color"` // "accent" (default), or hex
	CursorTrailIntensity string `json:"cursor_trail_intensity"` // "subtle", "normal" (default), "vivid"
}

// DefaultPreferences returns the built-in defaults.
func DefaultPreferences() Preferences {
	showStatus := true
	return Preferences{
		Theme: ThemePrefs{
			Preset:    "midnight",
			AccentHex: "#5b9fd4",
		},
		Layout: LayoutPrefs{
			SidebarPosition: "left",
			Density:         "comfortable",
			ShowStatusBar:   &showStatus,
		},
		Editor: EditorPrefs{
			CursorTrailMode:      "kitty",
			CursorTrailColor:     "accent",
			CursorTrailIntensity: "normal",
		},
	}
}

// PreferencesPath returns the path to preferences.json.
func PreferencesPath() (string, error) {
	dir, err := AppConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "preferences.json"), nil
}

// LoadPreferences reads preferences from disk, returning defaults when
// the file is missing or corrupt.
func LoadPreferences() Preferences {
	path, err := PreferencesPath()
	if err != nil {
		return DefaultPreferences()
	}
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return DefaultPreferences()
	}
	if err != nil {
		return DefaultPreferences()
	}
	var p Preferences
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &p); err != nil {
			return DefaultPreferences()
		}
	}
	// Merge nil fields with defaults.
	def := DefaultPreferences()
	if p.Theme.Preset == "" {
		p.Theme.Preset = def.Theme.Preset
	}
	if p.Theme.AccentHex == "" {
		p.Theme.AccentHex = def.Theme.AccentHex
	}
	if p.Layout.SidebarPosition == "" {
		p.Layout.SidebarPosition = def.Layout.SidebarPosition
	}
	if p.Layout.Density == "" {
		p.Layout.Density = def.Layout.Density
	}
	if p.Layout.ShowStatusBar == nil {
		p.Layout.ShowStatusBar = def.Layout.ShowStatusBar
	}
	if p.Editor.CursorTrailMode == "" {
		p.Editor.CursorTrailMode = def.Editor.CursorTrailMode
	}
	if p.Editor.CursorTrailColor == "" {
		p.Editor.CursorTrailColor = def.Editor.CursorTrailColor
	}
	if p.Editor.CursorTrailIntensity == "" {
		p.Editor.CursorTrailIntensity = def.Editor.CursorTrailIntensity
	}
	return p
}

// SavePreferences writes preferences to disk atomically.
func SavePreferences(p Preferences) error {
	dir, err := AppConfigDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	raw, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal preferences: %w", err)
	}
	path, err := PreferencesPath()
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write preferences: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("rename preferences: %w", err)
	}
	return nil
}
