package note

import "time"

// Note is a single markdown note with visit-tracking metadata.
type Note struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	File            string    `json:"file,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	LastVisited     time.Time `json:"last_visited"`
	VisitCount      int       `json:"visit_count"`
	LastManualWater time.Time `json:"last_manual_water"`
	WorldX          int       `json:"world_x"`
	WorldY          int       `json:"world_y"`
	Positioned      bool      `json:"positioned"`
}
