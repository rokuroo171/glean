package world

import (
	"fmt"
	"hash/fnv"

	"github.com/glean/glean/internal/note"
)

const (
	SpiralXSpacing = 220
	SpiralYSpacing = 220
	NearXSpacing   = 220
	NearYSpacing   = 220
)

// Point is a stable coordinate in the sky.
type Point struct {
	X int
	Y int
}

// Trail is a render-only path between two note IDs.
// Kept as a data type; rendering moves to the frontend.
type Trail struct {
	NoteA  string
	NoteB  string
	Dimmed bool
}

// PositionForNew returns the locked position for a note created now.
func PositionForNew(notes []note.Note, contextID, newID string) Point {
	occupied := occupiedPositions(notes)
	if contextID != "" {
		if context, ok := findNote(notes, contextID); ok && context.Positioned {
			if p, ok := nearbyPosition(context, occupied, newID); ok {
				return p
			}
		}
	}
	return NextSpiralPosition(notes, newID)
}

// NextSpiralPosition returns the next unoccupied default spiral position.
func NextSpiralPosition(notes []note.Note, seed string) Point {
	occupied := occupiedPositions(notes)
	for i := 0; ; i++ {
		p := seedJitter(scaleSpiral(spiralPoint(i)), seed)
		if !occupied[key(p)] {
			return p
		}
	}
}

// LockMissingPositions assigns stable positions to legacy notes with no position.
func LockMissingPositions(notes []note.Note) ([]note.Note, bool) {
	out := make([]note.Note, len(notes))
	copy(out, notes)

	changed := false
	for i := range out {
		if out[i].Positioned {
			continue
		}
		p := NextSpiralPosition(out, "") // no jitter for legacy positions
		out[i].WorldX = p.X
		out[i].WorldY = p.Y
		out[i].Positioned = true
		changed = true
	}
	return out, changed
}

// NoteAt returns the note whose locked base position is p.
func NoteAt(notes []note.Note, p Point) (note.Note, bool) {
	for _, n := range notes {
		if n.Positioned && n.WorldX == p.X && n.WorldY == p.Y {
			return n, true
		}
	}
	return note.Note{}, false
}

// NearestNote returns the closest positioned note to p.
func NearestNote(notes []note.Note, p Point) (note.Note, bool) {
	var best note.Note
	bestDist := 0
	found := false
	for _, n := range notes {
		if !n.Positioned {
			continue
		}
		d := abs(n.WorldX-p.X) + abs(n.WorldY-p.Y)
		if !found || d < bestDist {
			best = n
			bestDist = d
			found = true
		}
	}
	return best, found
}

// Line returns all integer grid points between a and b (for future path rendering).
func Line(a, b Point) []Point {
	return line(a, b)
}

func nearbyPosition(context note.Note, occupied map[string]bool, seed string) (Point, bool) {
	offsets := nearbyOffsets()
	start := int(seedHash(seed) % uint64(len(offsets)))
	for i := 0; i < len(offsets); i++ {
		o := offsets[(start+i)%len(offsets)]
		p := Point{X: context.WorldX + o.X, Y: context.WorldY + o.Y}
		if !occupied[key(p)] {
			return p, true
		}
	}
	return Point{}, false
}

func nearbyOffsets() []Point {
	var out []Point
	for ring := 1; ring <= 4; ring++ {
		for dx := -ring; dx <= ring; dx++ {
			for dy := -ring; dy <= ring; dy++ {
				if abs(dx) != ring && abs(dy) != ring {
					continue
				}
				out = append(out, Point{X: dx * NearXSpacing, Y: dy * NearYSpacing})
			}
		}
	}
	return out
}

func occupiedPositions(notes []note.Note) map[string]bool {
	occupied := map[string]bool{}
	for _, n := range notes {
		if n.Positioned {
			occupied[key(Point{X: n.WorldX, Y: n.WorldY})] = true
		}
	}
	return occupied
}

func findNote(notes []note.Note, id string) (note.Note, bool) {
	for _, n := range notes {
		if n.ID == id {
			return n, true
		}
	}
	return note.Note{}, false
}

func spiralPoint(index int) Point {
	if index <= 0 {
		return Point{}
	}

	x, y := 0, 0
	step := 1
	seen := 0
	for {
		for i := 0; i < step; i++ {
			x++
			seen++
			if seen == index {
				return Point{X: x, Y: y}
			}
		}
		for i := 0; i < step; i++ {
			y++
			seen++
			if seen == index {
				return Point{X: x, Y: y}
			}
		}
		step++
		for i := 0; i < step; i++ {
			x--
			seen++
			if seen == index {
				return Point{X: x, Y: y}
			}
		}
		for i := 0; i < step; i++ {
			y--
			seen++
			if seen == index {
				return Point{X: x, Y: y}
			}
		}
		step++
	}
}

func scaleSpiral(p Point) Point {
	return Point{X: p.X * SpiralXSpacing, Y: p.Y * SpiralYSpacing}
}

// seedJitter applies a deterministic offset to p, seeded from id.
// Range is ±35% of spacing in each axis (~77px for 220px spacing),
// enough to break the grid while keeping min gap ≥ 68px between
// adjacent candidates (well above any star glow radius ~25px).
func seedJitter(p Point, id string) Point {
	if id == "" {
		return p
	}
	h := seedHash(id)
	jitterX := SpiralXSpacing * 35 / 100 // 77
	jitterY := SpiralYSpacing * 35 / 100 // 77
	jx := int(int32(h>>32)) % jitterX
	jy := int(int32(h)) % jitterY
	return Point{X: p.X + jx, Y: p.Y + jy}
}

func line(a, b Point) []Point {
	dx := b.X - a.X
	dy := b.Y - a.Y
	steps := max(abs(dx), abs(dy))
	if steps == 0 {
		return []Point{a}
	}
	out := make([]Point, 0, steps+1)
	for i := 0; i <= steps; i++ {
		x := a.X + dx*i/steps
		y := a.Y + dy*i/steps
		out = append(out, Point{X: x, Y: y})
	}
	return out
}

func seedHash(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}

func key(p Point) string {
	return fmt.Sprintf("%d:%d", p.X, p.Y)
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
