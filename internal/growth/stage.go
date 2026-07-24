package growth

import (
	"github.com/glean/glean/internal/note"
)

// Stage represents the visual brightness phase of a note,
// from a faint speck (FaintSpeck) to a brilliant star (BrilliantStar).
type Stage int

const (
	FaintSpeck   Stage = iota // visit_count == 1
	DimStar                   // visit_count 2–4
	SteadyStar                // visit_count 5–9
	BrightStar                // visit_count 10–19
	BrilliantStar             // visit_count 20+
)

// BrightnessStage returns the brightness stage for a note based solely on visit count.
func BrightnessStage(n note.Note) Stage {
	switch {
	case n.VisitCount >= 20:
		return BrilliantStar
	case n.VisitCount >= 10:
		return BrightStar
	case n.VisitCount >= 5:
		return SteadyStar
	case n.VisitCount >= 2:
		return DimStar
	default:
		return FaintSpeck
	}
}
