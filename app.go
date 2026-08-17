package main

import (
	"crypto/rand"
	"encoding/hex"
	"hash/fnv"
	"path/filepath"
	"time"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/ambient"
	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/world"
)

// App is the Wails application struct. Bound methods are exposed to the React frontend.
type App struct {
	store        *store.Store
	adjacency    *adjacency.Store
	activity     *activity.Store
	lastNoteID   string
	lastNoteOpen time.Time
}

// NewApp creates the application with all stores loaded.
// Transitional: adjacency and activity already live in the sky sidecar;
// the note store is rewired in the md model milestone.
func NewApp() (*App, error) {
	skyDir, err := resolveSkyDir()
	if err != nil {
		return nil, err
	}
	s, err := store.Open()
	if err != nil {
		return nil, err
	}
	adj, _ := adjacency.Open(skyDir)
	act, _ := activity.Open(skyDir)
	return &App{store: s, adjacency: adj, activity: act}, nil
}

// resolveSkyDir returns the configured sky, bootstrapping a default one
// when no pointer exists. Transitional until the wizard milestone lands.
func resolveSkyDir() (string, error) {
	skyDir, ok, err := store.ResolveSky()
	if err != nil {
		return "", err
	}
	if ok {
		return skyDir, nil
	}
	dir, err := store.AppConfigDir()
	if err != nil {
		return "", err
	}
	skyDir = filepath.Join(dir, "sky")
	if err := store.CreateSky(skyDir, "My Sky"); err != nil {
		return "", err
	}
	if err := store.SavePointer(store.SkyPointer{SkyPath: skyDir}); err != nil {
		return "", err
	}
	return skyDir, nil
}

// NoteView is the JSON-safe note representation sent to the frontend.
type NoteView struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	CreatedAt       time.Time `json:"created_at"`
	LastVisited     time.Time `json:"last_visited"`
	VisitCount      int       `json:"visit_count"`
	LastManualWater time.Time `json:"last_manual_water"`
	WorldX          int       `json:"world_x"`
	WorldY          int       `json:"world_y"`
	Positioned      bool      `json:"positioned"`
	Stage           string    `json:"stage"`
	Species         string    `json:"species"`
}

func noteToView(n note.Note) NoteView {
	return NoteView{
		ID:              n.ID,
		Title:           n.Title,
		Body:            n.Body,
		CreatedAt:       n.CreatedAt,
		LastVisited:     n.LastVisited,
		VisitCount:      n.VisitCount,
		LastManualWater: n.LastManualWater,
		WorldX:          n.WorldX,
		WorldY:          n.WorldY,
		Positioned:      n.Positioned,
		Stage:           stageName(growth.BrightnessStage(n)),
		Species:         colorTempFromID(n.ID),
	}
}

func stageName(s growth.Stage) string {
	switch s {
	case growth.FaintSpeck:
		return "faintspeck"
	case growth.DimStar:
		return "dimstar"
	case growth.SteadyStar:
		return "steadystar"
	case growth.BrightStar:
		return "brightstar"
	case growth.BrilliantStar:
		return "brilliantstar"
	default:
		return "faintspeck"
	}
}

// colorTempFromID derives a deterministic star color temperature from the note ID.
// Uses the same FNV hash as world positioning for consistency.
func colorTempFromID(id string) string {
	temps := []string{"warm", "cool", "neutral", "hot"}
	h := fnvHash(id)
	return temps[h%uint64(len(temps))]
}

func fnvHash(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}

// GetNotes returns all notes as views for the sky canvas.
func (a *App) GetNotes() []NoteView {
	notes := a.store.Notes()
	views := make([]NoteView, len(notes))
	for i, n := range notes {
		views[i] = noteToView(n)
	}
	return views
}

// GetNote returns a single note by ID.
func (a *App) GetNote(id string) (NoteView, bool) {
	n, ok := a.store.Get(id)
	if !ok {
		return NoteView{}, false
	}
	return noteToView(n), true
}

// CreateNote creates a new note with a title and returns it.
func (a *App) CreateNote(title string, contextID string) (NoteView, error) {
	if title == "" {
		title = "Untitled"
	}
	id := generateID()
	notes := a.store.Notes()
	p := world.PositionForNew(notes, contextID, id)

	n := note.Note{
		ID:         id,
		Title:      title,
		Body:       "",
		CreatedAt:  time.Now(),
		WorldX:     p.X,
		WorldY:     p.Y,
		Positioned: true,
	}
	if err := a.store.Create(n); err != nil {
		return NoteView{}, err
	}
	a.recordActivity()
	return noteToView(n), nil
}

// SaveNote updates a note's body and title.
func (a *App) SaveNote(id, title, body string) error {
	n, ok := a.store.Get(id)
	if !ok {
		return nil
	}
	n.Title = title
	n.Body = body
	return a.store.Update(n)
}

// DeleteNote removes a note by ID.
func (a *App) DeleteNote(id string) error {
	if a.lastNoteID == id {
		a.lastNoteID = ""
		a.lastNoteOpen = time.Time{}
	}
	return a.store.Delete(id)
}

// WaterNote performs a manual wish on a note (once per day).
func (a *App) WaterNote(id string) (bool, error) {
	n, ok := a.store.Get(id)
	if !ok {
		return false, nil
	}
	if !note.CanWishToday(n) {
		return false, nil
	}
	n.VisitCount++
	n.LastManualWater = time.Now()
	if err := a.store.Update(n); err != nil {
		return false, err
	}
	a.recordActivity()
	return true, nil
}

// OpenNote records a visit (passive wish) and returns the note.
// Also records adjacency transitions for constellation line rendering.
func (a *App) OpenNote(id string) (NoteView, error) {
	n, ok := a.store.Get(id)
	if !ok {
		return NoteView{}, nil
	}

	now := time.Now()

	// Record adjacency transition from previous note to this one.
	if a.adjacency != nil && a.lastNoteID != "" && !a.lastNoteOpen.IsZero() {
		_, _ = a.adjacency.RecordTransition(
			adjacency.VisitEvent{NoteID: a.lastNoteID, OpenedAt: a.lastNoteOpen, ClosedAt: now},
			adjacency.VisitEvent{NoteID: id, OpenedAt: now, ClosedAt: time.Time{}},
			now,
		)
	}
	a.lastNoteID = id
	a.lastNoteOpen = now

	n.VisitCount++
	n.LastVisited = now
	if err := a.store.Update(n); err != nil {
		return NoteView{}, err
	}
	a.recordActivity()
	return noteToView(n), nil
}// TrailView is the JSON-safe trail representation for the frontend.
// Wails auto-serializes return values, so we return this directly.
type TrailView struct {
	NoteA  string `json:"note_a"`
	NoteB  string `json:"note_b"`
	Dimmed bool   `json:"dimmed"`
}

// GetTrails returns adjacency pairs that meet the rendering threshold (count >= 5).
func (a *App) GetTrails() []TrailView {
	if a.adjacency == nil {
		return nil
	}
	pairs := a.adjacency.Pairs()
	views := make([]TrailView, 0, len(pairs))
	now := time.Now()
	for _, pair := range pairs {
		if pair.Count < 5 {
			continue
		}
		dimmed := adjacency.IsDimmed(pair, now)
		views = append(views, TrailView{
			NoteA:  pair.NoteA,
			NoteB: pair.NoteB,
			Dimmed: dimmed,
		})
	}
	return views
}

// StatsView is the JSON-safe stats representation for the frontend.
type StatsView struct {
	TotalNotes    int            `json:"total_notes"`
	StageCounts   map[string]int `json:"stage_counts"`
	CurrentStreak int            `json:"current_streak"`
	LongestStreak int            `json:"longest_streak"`
	LastActiveDate string        `json:"last_active_date"`
	Milestones    MilestonesView `json:"milestones"`
	DailyCounts   map[string]int `json:"daily_counts"`
}

// MilestonesView mirrors activity.Milestones for JSON serialization.
type MilestonesView struct {
	FirstSproutAt *string `json:"first_sprout_at,omitempty"`
	FirstTreeAt   *string `json:"first_tree_at,omitempty"`
	TenNotesAt    *string `json:"ten_notes_at,omitempty"`
	TwentyNotesAt *string `json:"twenty_notes_at,omitempty"`
}

// GetStats returns sky stats: stage counts, streaks, milestones, daily activity.
func (a *App) GetStats() StatsView {
	notes := a.store.Notes()
	stageCounts := map[string]int{}
	for _, n := range notes {
		stageCounts[stageName(growth.BrightnessStage(n))]++
	}

	view := StatsView{
		TotalNotes:   len(notes),
		StageCounts:   stageCounts,
		DailyCounts:   map[string]int{},
	}

	if a.activity != nil {
		data := a.activity.Data()
		view.CurrentStreak = data.CurrentStreak
		view.LongestStreak = data.LongestStreak
		view.LastActiveDate = data.LastActiveDate
		for k, v := range data.DailyCounts {
			view.DailyCounts[k] = v
		}
		view.Milestones = MilestonesView{
			FirstSproutAt: timeToStr(data.Milestones.FirstSproutAt),
			FirstTreeAt:   timeToStr(data.Milestones.FirstTreeAt),
			TenNotesAt:    timeToStr(data.Milestones.TenNotesAt),
			TwentyNotesAt: timeToStr(data.Milestones.TwentyNotesAt),
		}
	}
	return view
}

func timeToStr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

// PaletteView is the JSON-safe ambient palette for the frontend.
type PaletteView struct {
	Primary   string `json:"primary"`
	Secondary string `json:"secondary"`
	Accent    string `json:"accent"`
	Muted     string `json:"muted"`
	Heading   string `json:"heading"`
	List      string `json:"list"`
}

// GetPalette returns the ambient color palette based on current time-of-day and season.
func (a *App) GetPalette() PaletteView {
	p := ambient.Palette(time.Now())
	return PaletteView{
		Primary:   p.Primary,
		Secondary: p.Secondary,
		Accent:    p.Accent,
		Muted:     p.Muted,
		Heading:   p.Heading,
		List:      p.List,
	}
}

func (a *App) recordActivity() {
	if a.activity == nil {
		return
	}
	_ = a.activity.Record(time.Now(), a.store.Notes())
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
