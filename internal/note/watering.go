package note

import "time"

// CanWishOn reports whether a manual wish is allowed on now's local date.
func CanWishOn(n Note, now time.Time) bool {
	if n.LastManualWater.IsZero() {
		return true
	}
	y1, m1, d1 := n.LastManualWater.In(now.Location()).Date()
	y2, m2, d2 := now.Date()
	return y1 != y2 || m1 != m2 || d1 != d2
}

// CanWishToday reports whether a manual wish is allowed today.
func CanWishToday(n Note) bool {
	return CanWishOn(n, time.Now())
}
