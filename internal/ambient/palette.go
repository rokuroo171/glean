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
	Primary   string
	Secondary string
	Accent    string
	Muted     string
	Heading   string
	List      string
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
	switch month {
	case time.December, time.January, time.February:
		primary = blend(primary, "#B0C4DE")
		secondary = blend(secondary, "#8899AA")
	case time.March, time.April, time.May:
		primary = blend(primary, "#90EE90")
		secondary = blend(secondary, "#6BAA6B")
	case time.June, time.July, time.August:
		primary = blend(primary, "#FFD700")
		secondary = blend(secondary, "#DAA520")
	case time.September, time.October, time.November:
		primary = blend(primary, "#CD853F")
		secondary = blend(secondary, "#A0522D")
	}

	return ColorSet{
		Primary:   primary,
		Secondary: secondary,
		Accent:    accent,
		Muted:     "#666666",
		Heading:   accent,
		List:      secondary,
	}
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
