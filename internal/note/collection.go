package note

// Collection holds all notes persisted to disk.
type Collection struct {
	Notes []Note `json:"notes"`
}
