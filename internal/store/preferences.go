package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Preferences holds all user customization settings.
type Preferences struct {
	Theme  ThemePrefs  `json:"theme"`
	Layout LayoutPrefs `json:"layout"`
	Editor EditorPrefs `json:"editor"`
	Sky    SkyPrefs    `json:"sky"`
}

// ThemePrefs controls colors and visual appearance.
type ThemePrefs struct {
	Preset    string `json:"preset"`     // "midnight", "aurora", "ember", "ocean", "lavender"
	AccentHex string `json:"accent_hex"` // e.g. "#5b9fd4"
}

// LayoutPrefs controls panel positions and density.
type LayoutPrefs struct {
	SidebarPosition string `json:"sidebar_position"` // "left" (default), "right"
	Density         string `json:"density"`          // "comfortable" (default), "compact", "dense"
	ShowStatusBar   *bool  `json:"show_status_bar"`  // nil = true (default)
}

// SkyPrefs controls the starfield appearance in the Sky view.
type SkyPrefs struct {
	Density       string `json:"density"`        // "sparse", "normal" (default), "dense"
	TwinkleSpeed  string `json:"twinkle_speed"`  // "slow", "normal" (default), "fast"
	StarColor     string `json:"star_color"`     // "natural" (default), "warm", "cool"
	NebulaEnabled *bool  `json:"nebula_enabled"` // nil = true (default)
}

// EditorPrefs controls editor behavior and appearance.
type EditorPrefs struct {
	FontFamily                string  `json:"font_family"`                  // CSS font-family value
	FontSize                  int     `json:"font_size"`                    // px
	LineHeight                float64 `json:"line_height"`                  // e.g. 1.6
	SpellCheckEnabled         *bool   `json:"spell_check_enabled"`          // nil = true (default); native spelling squiggles
	CursorTrailEnabled        *bool   `json:"cursor_trail_enabled"`         // nil = false (default)
	CursorTrailMode           string  `json:"cursor_trail_mode"`            // "beam" (default), "sparkle", "ink"
	CursorTrailColor          string  `json:"cursor_trail_color"`           // "accent" (default), or hex
	CursorTrailIntensity      string  `json:"cursor_trail_intensity"`       // "subtle", "normal" (default), "vivid"
	CursorTrailDecayFast      int     `json:"cursor_trail_decay_fast"`      // ms, fast fade stage
	CursorTrailDecaySlow      int     `json:"cursor_trail_decay_slow"`      // ms, slow tail stage
	CursorTrailLength         int     `json:"cursor_trail_length"`          // trail buffer size (points)
	CursorTrailStartThreshold int     `json:"cursor_trail_start_threshold"` // px, movement needed to trigger
	AnimatedTextEnabled       *bool   `json:"animated_text_enabled"`        // nil = false (default)
	AnimatedTextStyle         string  `json:"animated_text_style"`          // "drop" (default), "fade", "pop"
}

// DefaultPreferences returns the built-in defaults.
func DefaultPreferences() Preferences {
	showStatus := true
	spell := true
	nebula := true
	return Preferences{
		Theme: ThemePrefs{
			Preset:    "midnight",
			AccentHex: "#5b9fd4",
		},
		Sky: SkyPrefs{
			Density:       "normal",
			TwinkleSpeed:  "normal",
			StarColor:     "natural",
			NebulaEnabled: &nebula,
		},
		Layout: LayoutPrefs{
			SidebarPosition: "left",
			Density:         "comfortable",
			ShowStatusBar:   &showStatus,
		},
		Editor: EditorPrefs{
			FontFamily:                "monospace",
			FontSize:                  14,
			LineHeight:                1.6,
			SpellCheckEnabled:         &spell,
			CursorTrailEnabled:        nil,
			CursorTrailMode:           "beam",
			CursorTrailColor:          "accent",
			CursorTrailIntensity:      "normal",
			CursorTrailDecayFast:      80,
			CursorTrailDecaySlow:      300,
			CursorTrailLength:         12,
			CursorTrailStartThreshold: 4,
			AnimatedTextStyle:         "drop",
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
	if p.Sky.Density == "" {
		p.Sky.Density = def.Sky.Density
	}
	if p.Sky.TwinkleSpeed == "" {
		p.Sky.TwinkleSpeed = def.Sky.TwinkleSpeed
	}
	if p.Sky.StarColor == "" {
		p.Sky.StarColor = def.Sky.StarColor
	}
	if p.Sky.NebulaEnabled == nil {
		p.Sky.NebulaEnabled = def.Sky.NebulaEnabled
	}
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
	if p.Editor.FontFamily == "" {
		p.Editor.FontFamily = def.Editor.FontFamily
	}
	if p.Editor.FontSize <= 0 {
		p.Editor.FontSize = def.Editor.FontSize
	}
	if p.Editor.LineHeight <= 0 {
		p.Editor.LineHeight = def.Editor.LineHeight
	}
	if p.Editor.SpellCheckEnabled == nil {
		p.Editor.SpellCheckEnabled = def.Editor.SpellCheckEnabled
	}
	if p.Editor.CursorTrailEnabled == nil {
		p.Editor.CursorTrailEnabled = def.Editor.CursorTrailEnabled
	}
	if p.Editor.AnimatedTextStyle == "" {
		p.Editor.AnimatedTextStyle = def.Editor.AnimatedTextStyle
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
	if p.Editor.CursorTrailDecayFast <= 0 {
		p.Editor.CursorTrailDecayFast = def.Editor.CursorTrailDecayFast
	}
	if p.Editor.CursorTrailDecaySlow <= 0 {
		p.Editor.CursorTrailDecaySlow = def.Editor.CursorTrailDecaySlow
	}
	if p.Editor.CursorTrailLength <= 0 {
		p.Editor.CursorTrailLength = def.Editor.CursorTrailLength
	}
	if p.Editor.CursorTrailStartThreshold <= 0 {
		p.Editor.CursorTrailStartThreshold = def.Editor.CursorTrailStartThreshold
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
