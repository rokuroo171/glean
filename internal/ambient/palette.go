package ambient

import (
	"fmt"
	"strings"
	"time"
)

// ColorSet holds cosmetic hex-color strings for sky rendering.
// The frontend will interpret these as CSS colors; the Go side
// computes them purely from time-of-day and season.
type ColorSet struct {
	Primary     string
	Secondary   string
	Accent      string
	Muted       string
	Heading     string
	List        string
	Sky         string // deep constellation background tint for the season
	Nebula      string // seasonal nebula hue ("" = theme default clouds)
	Aurora      bool   // aurora nights: winter skies after dark
	MeteorBoost int    // meteor-shower multiplier during known shower weeks
}

// Palette computes a cosmetic color set from wall-clock time.
// Time-of-day and seasonal layers are independent of brightness stage logic.
func Palette(now time.Time) ColorSet {
	hour := now.Hour()
	month := now.Month()

	var primary, secondary, accent string

	// Time-of-day layer.
	switch {
	case hour < 12:
		primary = "#7EB8DA"
		secondary = "#5A9BC4"
		accent = "#A8D4F0"
	case hour < 20:
		primary = "#6BAA75"
		secondary = "#4A8F55"
		accent = "#8FD699"
	default:
		primary = "#D4A574"
		secondary = "#B8895A"
		accent = "#E8C9A0"
	}

	// Seasonal layer. Shift palette by calendar month.
	sky := "#0B0F19"
	nebula := ""
	aurora := false
	meteorBoost := 1
	switch month {
	case time.December, time.January, time.February:
		primary = blend(primary, "#B0C4DE")
		secondary = blend(secondary, "#8899AA")
		sky = "#0B1220" // slate night
		nebula = "#2a3a6a"
	case time.March, time.April, time.May:
		primary = blend(primary, "#90EE90")
		secondary = blend(secondary, "#6BAA6B")
		sky = "#0B1418" // teal-green night
		nebula = "#1f3a2e"
	case time.June, time.July, time.August:
		primary = blend(primary, "#FFD700")
		secondary = blend(secondary, "#DAA520")
		sky = "#0B0F1E" // deep indigo night
		nebula = "#2a2140"
	case time.September, time.October, time.November:
		primary = blend(primary, "#CD853F")
		secondary = blend(secondary, "#A0522D")
		sky = "#140F0B" // amber-brown night
		nebula = "#3a2a1a"
	}

	// Aurora nights: winter, after dark. The northern lights only show
	// when the sun is down.
	if month == time.December || month == time.January || month == time.February {
		if hour >= 19 || hour < 6 {
			aurora = true
		}
	}

	// Meteor-shower weeks: boost the spawn rate during the big annual
	// showers so the sky feels alive exactly when it really is.
	switch {
	case isShower(now, 1, 1, 5): // Quadrantids
		meteorBoost = 4
	case isShower(now, 4, 21, 23): // Lyrids
		meteorBoost = 3
	case isShower(now, 8, 9, 13): // Perseids
		meteorBoost = 4
	case isShower(now, 10, 20, 22): // Orionids
		meteorBoost = 3
	case isShower(now, 11, 16, 18): // Leonids
		meteorBoost = 3
	case isShower(now, 12, 4, 17): // Geminids
		meteorBoost = 4
	}

	return ColorSet{
		Primary:     primary,
		Secondary:   secondary,
		Accent:      accent,
		Muted:       "#666666",
		Heading:     accent,
		List:        secondary,
		Sky:         sky,
		Nebula:      nebula,
		Aurora:      aurora,
		MeteorBoost: meteorBoost,
	}
}

// isShower reports whether now falls within a meteor-shower window
// (month m, day d1 through day d2 inclusive, in real-world dates).
func isShower(now time.Time, m time.Month, d1, d2 int) bool {
	if now.Month() != m {
		return false
	}
	return now.Day() >= d1 && now.Day() <= d2
}

// blend mixes two hex colors by averaging channels (cosmetic only).
func blend(a, b string) string {
	ar, ag, ab := parseHex(a)
	br, bg, bb := parseHex(b)
	return fmt.Sprintf("#%02x%02x%02x",
		(ar+br)/2, (ag+bg)/2, (ab+bb)/2)
}

func parseHex(s string) (r, g, b uint8) {
	s = strings.TrimPrefix(s, "#")
	if len(s) != 6 {
		return 128, 128, 128
	}
	var rv, gv, bv int
	fmt.Sscanf(s, "%02x%02x%02x", &rv, &gv, &bv)
	return uint8(rv), uint8(gv), uint8(bv)
}
