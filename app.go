package main

import (
	"context"
	"fmt"
	"hash/fnv"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/ambient"
	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/wikilink"
	"github.com/glean/glean/internal/world"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails application struct. Bound methods are exposed to the React frontend.
type App struct {
	ctx          context.Context
	store        *store.RegistryStore
	skyDir       string
	adjacency    *adjacency.Store
	activity     *activity.Store
	workspace    *store.WorkspaceStore
	lastNoteID   string
	lastNoteOpen time.Time
}

// SetWindowTitle updates the window title bar and taskbar preview text.
// Call from the frontend as notes are opened or closed.
func (a *App) SetWindowTitle(title string) {
	runtime.WindowSetTitle(a.ctx, title)
}

// NewApp wires the sky-based stores when a sky is configured. Without a
// pointer the stores stay nil and the frontend shows the setup screen.
func NewApp() (*App, error) {
	skyDir, ok, err := store.ResolveSky()
	if err != nil {
		return nil, err
	}
	if !ok {
		return &App{}, nil
	}
	// Check the sky folder actually exists before opening stores.
	// Without this, a deleted folder opens empty stores and the frontend
	// shows a ghost workspace instead of the recovery screen.
	info, err := os.Stat(skyDir)
	if err != nil || !info.IsDir() {
		return &App{}, nil
	}
	a := &App{}
	if err := a.openSkyAt(skyDir); err != nil {
		return nil, err
	}
	return a, nil
}

// NoteView is the JSON-safe note representation sent to the frontend.
type NoteView struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	Folder          string    `json:"folder"`
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
		Folder:          store.FolderOf(n.File),
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

// GetNotes returns all notes as views for the sky canvas. Bodies stay
// empty here; they load on open.
func (a *App) GetNotes() []NoteView {
	if a.store == nil {
		return nil
	}
	notes := a.store.All()
	views := make([]NoteView, len(notes))
	for i, n := range notes {
		v := noteToView(n)
		if path, err := a.notePath(n); err == nil {
			if body, err := store.ReadNoteFile(path); err == nil {
				v.Body = body
			}
		}
		views[i] = v
	}
	return views
}

// ScanSky re-scans the sky folder for new md files and returns the
// updated note list. Called on window focus so external files become
// stars without a relaunch. Unlike the startup scan, this never removes
// notes -- it only adds new ones -- to avoid losing bodies.
func (a *App) ScanSky() []NoteView {
	if a.store == nil {
		return nil
	}
	added, _ := store.ScanAddOnly(a.skyDir, a.store)
	_ = added // new notes are already in the registry
	notes := a.store.All()
	views := make([]NoteView, len(notes))
	for i, n := range notes {
		v := noteToView(n)
		if path, err := a.notePath(n); err == nil {
			if body, err := store.ReadNoteFile(path); err == nil {
				v.Body = body
			}
		}
		views[i] = v
	}
	return views
}

// notePath resolves a note's md file from the registry's recorded path.
// File stores the relative path from skyDir (e.g. "glean/arch.md").
func (a *App) notePath(n note.Note) (string, error) {
	var p string
	if n.File != "" {
		p = filepath.Join(a.skyDir, n.File)
	} else {
		// Legacy entry without File -- derive from title at root.
		var err error
		p, err = store.FileNameFor(a.skyDir, "", n.Title)
		if err != nil {
			return "", err
		}
	}
	if err := store.ValidateInsideDir(a.skyDir, p); err != nil {
		return "", err
	}
	return p, nil
}

// GetNote returns a single note by ID, loading its body from the md file
// without recording a visit.
func (a *App) GetNote(id string) (NoteView, bool) {
	if a.store == nil {
		return NoteView{}, false
	}
	n, ok := a.store.Get(id)
	if !ok {
		return NoteView{}, false
	}
	path, err := a.notePath(n)
	if err != nil {
		return NoteView{}, false
	}
	body, err := store.ReadNoteFile(path)
	if err != nil {
		return NoteView{}, false
	}
	n.Body = body
	return noteToView(n), true
}

// CreateNote creates a new note with a title and returns it.
// The optional folder param places the note in a subfolder directly.
func (a *App) CreateNote(title string, contextID string, folder string) (NoteView, error) {
	if a.store == nil {
		return NoteView{}, fmt.Errorf("no sky configured")
	}
	if title == "" {
		title = "Untitled"
	}
	id := store.NewID()
	notes := a.store.All()
	p := world.PositionForNew(notes, contextID, id)

	// If folder is provided directly, use it. Otherwise derive from contextID.
	if folder == "" && contextID != "" {
		if ctx, ok := a.store.Get(contextID); ok && ctx.File != "" {
			folder = store.FolderOf(ctx.File)
		}
	}

	n := note.Note{
		ID:         id,
		Title:      title,
		CreatedAt:  time.Now(),
		WorldX:     p.X,
		WorldY:     p.Y,
		Positioned: true,
	}
	name, err := store.FileNameFor(a.skyDir, folder, title)
	if err != nil {
		return NoteView{}, err
	}
	if err := store.ValidateInsideDir(a.skyDir, name); err != nil {
		return NoteView{}, err
	}
	if err := store.WriteNoteFile(name, ""); err != nil {
		return NoteView{}, err
	}
	rel, _ := filepath.Rel(a.skyDir, name)
	n.File = rel
	if err := a.store.Create(n); err != nil {
		return NoteView{}, err
	}
	a.recordActivity()
	return noteToView(n), nil
}

// SaveNote writes the md file, renames on title change, updates the registry.
func (a *App) SaveNote(id, title, body string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := a.store.Get(id)
	if !ok {
		return fmt.Errorf("note not found: %s", id)
	}
	oldPath, err := a.notePath(n)
	if err != nil {
		return err
	}
	if strings.EqualFold(store.SanitizeTitle(title), store.SanitizeTitle(n.Title)) {
		// Same title, keep the existing file.
		if err := store.WriteNoteFile(oldPath, body); err != nil {
			return err
		}
		n.Title = title
		return a.store.Update(n)
	}
	// Title changed -- create new file in the same folder, remove old.
	folder := store.FolderOf(n.File)
	newPath, err := store.FileNameFor(a.skyDir, folder, title)
	if err != nil {
		return err
	}
	if err := store.WriteNoteFile(newPath, body); err != nil {
		return err
	}
	_ = os.Remove(oldPath)
	n.Title = title
	rel, _ := filepath.Rel(a.skyDir, newPath)
	n.File = rel
	return a.store.Update(n)
}

// DeleteNote removes the registry entry and the md file.
func (a *App) DeleteNote(id string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := a.store.Get(id)
	if !ok {
		return nil
	}
	path, err := a.notePath(n)
	if err != nil {
		return err
	}
	_ = os.Remove(path)
	if a.lastNoteID == id {
		a.lastNoteID = ""
		a.lastNoteOpen = time.Time{}
	}
	return a.store.Delete(id)
}

// WaterNote performs a manual wish on a note (once per day).
func (a *App) WaterNote(id string) (bool, error) {
	if a.store == nil {
		return false, nil
	}
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

// OpenNote records a visit (passive wish) and returns the note, loading
// its body from the md file. Also records adjacency transitions for
// constellation line rendering.
func (a *App) OpenNote(id string) (NoteView, error) {
	if a.store == nil {
		return NoteView{}, fmt.Errorf("no sky configured")
	}
	n, ok := a.store.Get(id)
	if !ok {
		return NoteView{}, nil
	}
	path, err := a.notePath(n)
	if err != nil {
		return NoteView{}, err
	}
	body, err := store.ReadNoteFile(path)
	if err != nil {
		return NoteView{}, err
	}
	n.Body = body

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
} // TrailView is the JSON-safe trail representation for the frontend.
// Wails auto-serializes return values, so we return this directly.
type TrailView struct {
	NoteA  string `json:"note_a"`
	NoteB  string `json:"note_b"`
	Dimmed bool   `json:"dimmed"`
}

// GetLinks returns all resolved wikilink edges across the sky's notes.
// Each pair is the IDs of two notes connected by at least one [[Title]]
// reference (either direction), deduped and sorted. Unresolved links
// ([[Missing]]) are excluded here; the preview styles them itself.
func (a *App) GetLinks() []TrailView {
	if a.store == nil {
		return nil
	}
	notes := a.store.All()
	byTitle := make(map[string]string, len(notes)) // lowercase title -> id
	for _, n := range notes {
		byTitle[strings.ToLower(n.Title)] = n.ID
	}
	edgeSet := make(map[string]bool)
	views := make([]TrailView, 0, len(notes))
	for _, n := range notes {
		path, err := a.notePath(n)
		if err != nil {
			continue
		}
		body, err := store.ReadNoteFile(path)
		if err != nil {
			continue
		}
		for _, l := range wikilink.Scan(body) {
			to, ok := byTitle[strings.ToLower(l.Target)]
			if !ok || to == n.ID {
				continue
			}
			key := linkPairKey(n.ID, to)
			if edgeSet[key] {
				continue
			}
			edgeSet[key] = true
			views = append(views, TrailView{NoteA: n.ID, NoteB: to, Dimmed: false})
		}
	}
	return views
}

// linkPairKey returns a canonical, order-independent key for a note pair.
func linkPairKey(a, b string) string {
	if a < b {
		return a + "\x00" + b
	}
	return b + "\x00" + a
}

// StatsView is the JSON-safe stats representation for the frontend.
type StatsView struct {
	TotalNotes     int            `json:"total_notes"`
	StageCounts    map[string]int `json:"stage_counts"`
	CurrentStreak  int            `json:"current_streak"`
	LongestStreak  int            `json:"longest_streak"`
	LastActiveDate string         `json:"last_active_date"`
	Milestones     MilestonesView `json:"milestones"`
	DailyCounts    map[string]int `json:"daily_counts"`
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
	if a.store == nil {
		return StatsView{}
	}
	notes := a.store.All()
	stageCounts := map[string]int{}
	for _, n := range notes {
		stageCounts[stageName(growth.BrightnessStage(n))]++
	}

	view := StatsView{
		TotalNotes:  len(notes),
		StageCounts: stageCounts,
		DailyCounts: map[string]int{},
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

// GetSkyName returns the configured sky's display name.
func (a *App) GetSkyName() string {
	name, err := store.LoadSkyName(a.skyDir)
	if err != nil {
		return "My Sky"
	}
	return name
}

// GetSkyPath returns the configured sky folder path.
func (a *App) GetSkyPath() string {
	return a.skyDir
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
	_ = a.activity.Record(time.Now(), a.store.All())
}

// PickFolder opens the native OS directory picker and returns the selected
// path, or empty string if cancelled. Works on Windows, macOS, and Linux
// (uses whatever GTK/Qt file chooser the desktop environment provides).
func (a *App) PickFolder() string {
	if a.ctx == nil {
		return ""
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose your Sky folder",
	})
	if err != nil {
		return ""
	}
	return dir
}

// CreateFolder creates a new empty directory under the sky.
func (a *App) CreateFolder(name, folder string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	if name == "" {
		return fmt.Errorf("folder name is empty")
	}

	// Build the full folder path: skyDir/folder/name
	var folderPath string
	if folder == "" {
		folderPath = filepath.Join(a.skyDir, name)
	} else {
		folderPath = filepath.Join(a.skyDir, folder, name)
	}

	// Create the actual directory on disk
	if err := os.MkdirAll(folderPath, 0o755); err != nil {
		return fmt.Errorf("create folder: %w", err)
	}
	return nil
}

// ListFolders returns all subdirectories in the sky as a flat list of
// relative paths (e.g. ["A", "A/B", "A/B/C"]). Empty for root-only skies.
func (a *App) ListFolders() []string {
	if a.skyDir == "" {
		return []string{}
	}
	var result []string
	var walk func(dir, prefix string)
	walk = func(dir, prefix string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			rel := e.Name()
			if prefix != "" {
				rel = prefix + "/" + e.Name()
			}
			result = append(result, rel)
			walk(filepath.Join(dir, e.Name()), rel)
		}
	}
	walk(a.skyDir, "")
	return result
}

// MoveNote moves a note to a different folder within the sky.
func (a *App) MoveNote(id, targetFolder string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := a.store.Get(id)
	if !ok {
		return fmt.Errorf("note not found: %s", id)
	}
	oldPath, err := a.notePath(n)
	if err != nil {
		return err
	}
	newPath, err := store.FileNameFor(a.skyDir, targetFolder, n.Title)
	if err != nil {
		return err
	}
	if err := store.ValidateInsideDir(a.skyDir, newPath); err != nil {
		return err
	}
	body, err := store.ReadNoteFile(oldPath)
	if err != nil {
		return err
	}
	if err := store.WriteNoteFile(newPath, body); err != nil {
		return err
	}
	_ = os.Remove(oldPath)
	rel, _ := filepath.Rel(a.skyDir, newPath)
	n.File = rel
	return a.store.Update(n)
}

// folderNameValid rejects names that are unsafe or illegal as a folder name.
// Names must stay a single path segment and be usable on Windows too.
func folderNameValid(name string) error {
	if name == "" {
		return fmt.Errorf("folder name is empty")
	}
	if name == "." || name == ".." {
		return fmt.Errorf("invalid folder name: %s", name)
	}
	if strings.HasPrefix(name, ".") {
		return fmt.Errorf("folder name cannot start with a dot")
	}
	if strings.ContainsAny(name, `/\:*?"<>|`) {
		return fmt.Errorf("folder name cannot contain path or invalid characters")
	}
	return nil
}

// folderPathValid validates every segment of a relative folder path.
func folderPathValid(folder string) error {
	folder = strings.Trim(folder, "/")
	if folder == "" {
		return fmt.Errorf("folder is empty")
	}
	for _, seg := range strings.Split(folder, "/") {
		if err := folderNameValid(seg); err != nil {
			return err
		}
	}
	return nil
}

// RenameFolder renames a folder inside the sky and updates the registry
// paths of every note that lives under it.
func (a *App) RenameFolder(folder, newName string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	newName = strings.TrimSpace(newName)
	if err := folderNameValid(newName); err != nil {
		return err
	}
	folder = filepath.ToSlash(folder)
	if err := folderPathValid(folder); err != nil {
		return err
	}

	oldAbs := filepath.Join(a.skyDir, filepath.FromSlash(folder))
	if err := store.ValidateInsideDir(a.skyDir, oldAbs); err != nil {
		return err
	}
	info, err := os.Stat(oldAbs)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("folder not found: %s", folder)
	}
	newAbs := filepath.Join(filepath.Dir(oldAbs), newName)
	if _, err := os.Stat(newAbs); err == nil {
		return fmt.Errorf("a folder named %s already exists", newName)
	}

	relOld, _ := filepath.Rel(a.skyDir, oldAbs)
	relNew, _ := filepath.Rel(a.skyDir, newAbs)
	relOld = filepath.ToSlash(relOld)
	relNew = filepath.ToSlash(relNew)

	if err := os.Rename(oldAbs, newAbs); err != nil {
		return fmt.Errorf("rename folder: %w", err)
	}

	// Update registry entries whose file lives under the renamed folder.
	prefix := relOld + "/"
	for _, n := range a.store.All() {
		f := filepath.ToSlash(n.File)
		if f != relOld && !strings.HasPrefix(f, prefix) {
			continue
		}
		n.File = relNew + "/" + filepath.ToSlash(filepath.Base(n.File))
		if err := a.store.Update(n); err != nil {
			return err
		}
	}
	return nil
}

// DeleteFolder removes a folder (and everything in it) from the sky and
// drops the registry entries of every note it contained.
func (a *App) DeleteFolder(folder string) error {
	if a.store == nil {
		return fmt.Errorf("no sky configured")
	}
	folder = filepath.ToSlash(folder)
	if err := folderPathValid(folder); err != nil {
		return err
	}

	folderAbs := filepath.Join(a.skyDir, filepath.FromSlash(folder))
	if err := store.ValidateInsideDir(a.skyDir, folderAbs); err != nil {
		return err
	}
	info, err := os.Stat(folderAbs)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("folder not found: %s", folder)
	}

	rel, _ := filepath.Rel(a.skyDir, folderAbs)
	rel = filepath.ToSlash(rel)
	prefix := rel + "/"

	if err := os.RemoveAll(folderAbs); err != nil {
		return fmt.Errorf("delete folder: %w", err)
	}

	// Drop every registry entry under the deleted folder.
	for _, n := range a.store.All() {
		f := filepath.ToSlash(n.File)
		if f != rel && !strings.HasPrefix(f, prefix) {
			continue
		}
		_ = a.store.Delete(n.ID)
		if a.lastNoteID == n.ID {
			a.lastNoteID = ""
			a.lastNoteOpen = time.Time{}
		}
	}
	return nil
}

// SetWindowSize resizes the OS window. Used by the setup intro to show a
// small welcome card, then expand to full size for the setup forms.
func (a *App) SetWindowSize(width, height int) {
	if a.ctx == nil {
		return
	}
	runtime.WindowSetSize(a.ctx, width, height)
	runtime.WindowCenter(a.ctx)
}

// KnownSkyView is the JSON-safe known sky entry for the frontend.
type KnownSkyView struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// GetKnownSkies returns all remembered skies for the manage-skies UI.
// Skies whose folder no longer exists on disk are filtered out, so the
// list never shows stale entries for deleted/moved folders.
func (a *App) GetKnownSkies() []KnownSkyView {
	p, _, err := store.LoadPointer()
	if err != nil || p.KnownSkies == nil {
		return nil
	}
	views := make([]KnownSkyView, 0, len(p.KnownSkies))
	for _, ks := range p.KnownSkies {
		info, statErr := os.Stat(ks.Path)
		if statErr != nil || !info.IsDir() {
			continue
		}
		views = append(views, KnownSkyView{Name: ks.Name, Path: ks.Path})
	}
	return views
}

// SwitchSky changes the active sky to the given path and reloads everything.
// Returns the new sky name on success.
func (a *App) SwitchSky(path string) (string, error) {
	if err := store.SwitchSky(path); err != nil {
		return "", err
	}
	// Close old stores.
	a.store = nil
	a.adjacency = nil
	a.activity = nil
	a.workspace = nil
	// Open the new sky.
	if err := a.openSkyAt(path); err != nil {
		return "", err
	}
	return a.GetSkyName(), nil
}

// RemoveKnownSky removes a sky from the known list. Does not delete files.
func (a *App) RemoveKnownSky(path string) error {
	return store.RemoveKnownSky(path)
}

// PreferencesView is the JSON-safe preferences representation for the frontend.
type PreferencesView struct {
	Theme  ThemePrefsView  `json:"theme"`
	Layout LayoutPrefsView `json:"layout"`
	Editor EditorPrefsView `json:"editor"`
	Sky    SkyPrefsView    `json:"sky"`
}

type ThemePrefsView struct {
	Preset    string `json:"preset"`
	AccentHex string `json:"accent_hex"`
}

type LayoutPrefsView struct {
	SidebarPosition string `json:"sidebar_position"`
	Density         string `json:"density"`
	ShowStatusBar   bool   `json:"show_status_bar"`
}

type EditorPrefsView struct {
	FontFamily                string  `json:"font_family"`
	FontSize                  int     `json:"font_size"`
	LineHeight                float64 `json:"line_height"`
	SpellCheckEnabled         bool    `json:"spell_check_enabled"`
	CursorTrailEnabled        bool    `json:"cursor_trail_enabled"`
	CursorTrailMode           string  `json:"cursor_trail_mode"`
	CursorTrailColor          string  `json:"cursor_trail_color"`
	CursorTrailIntensity      string  `json:"cursor_trail_intensity"`
	CursorTrailDecayFast      int     `json:"cursor_trail_decay_fast"`
	CursorTrailDecaySlow      int     `json:"cursor_trail_decay_slow"`
	CursorTrailLength         int     `json:"cursor_trail_length"`
	CursorTrailStartThreshold int     `json:"cursor_trail_start_threshold"`
	AnimatedTextEnabled       bool    `json:"animated_text_enabled"`
	AnimatedTextStyle         string  `json:"animated_text_style"`
}

type SkyPrefsView struct {
	Density       string `json:"density"`
	TwinkleSpeed  string `json:"twinkle_speed"`
	StarColor     string `json:"star_color"`
	NebulaEnabled bool   `json:"nebula_enabled"`
}

// GetPreferences returns the user's customization preferences.
func (a *App) GetPreferences() PreferencesView {
	p := store.LoadPreferences()
	showStatus := true
	if p.Layout.ShowStatusBar != nil {
		showStatus = *p.Layout.ShowStatusBar
	}
	return PreferencesView{
		Theme: ThemePrefsView{
			Preset:    p.Theme.Preset,
			AccentHex: p.Theme.AccentHex,
		},
		Layout: LayoutPrefsView{
			SidebarPosition: p.Layout.SidebarPosition,
			Density:         p.Layout.Density,
			ShowStatusBar:   showStatus,
		},
		Editor: EditorPrefsView{
			FontFamily:                p.Editor.FontFamily,
			FontSize:                  p.Editor.FontSize,
			LineHeight:                p.Editor.LineHeight,
			SpellCheckEnabled:         p.Editor.SpellCheckEnabled != nil && *p.Editor.SpellCheckEnabled,
			CursorTrailEnabled:        p.Editor.CursorTrailEnabled != nil && *p.Editor.CursorTrailEnabled,
			CursorTrailMode:           p.Editor.CursorTrailMode,
			CursorTrailColor:          p.Editor.CursorTrailColor,
			CursorTrailIntensity:      p.Editor.CursorTrailIntensity,
			CursorTrailDecayFast:      p.Editor.CursorTrailDecayFast,
			CursorTrailDecaySlow:      p.Editor.CursorTrailDecaySlow,
			CursorTrailLength:         p.Editor.CursorTrailLength,
			CursorTrailStartThreshold: p.Editor.CursorTrailStartThreshold,
			AnimatedTextEnabled:       p.Editor.AnimatedTextEnabled != nil && *p.Editor.AnimatedTextEnabled,
			AnimatedTextStyle:         p.Editor.AnimatedTextStyle,
		},
		Sky: SkyPrefsView{
			Density:       p.Sky.Density,
			TwinkleSpeed:  p.Sky.TwinkleSpeed,
			StarColor:     p.Sky.StarColor,
			NebulaEnabled: p.Sky.NebulaEnabled != nil && *p.Sky.NebulaEnabled,
		},
	}
}

// SavePreferences persists the user's customization preferences.
func (a *App) SavePreferences(p PreferencesView) error {
	// Validate and sanitize inputs.
	validPresets := map[string]bool{"midnight": true, "aurora": true, "ember": true, "ocean": true, "lavender": true, "nord": true, "gruvbox": true, "tokyo-night": true, "catppuccin-mocha": true, "paper": true, "catppuccin-latte": true}
	if !validPresets[p.Theme.Preset] {
		p.Theme.Preset = "midnight"
	}
	if !isValidHex(p.Theme.AccentHex) {
		p.Theme.AccentHex = "#5b9fd4"
	}
	// "kitty" was the original reference name for the default trail;
	// normalize it to "beam" so saved prefs keep working.
	if p.Editor.CursorTrailMode == "kitty" {
		p.Editor.CursorTrailMode = "beam"
	}
	validTrails := map[string]bool{"beam": true, "sparkle": true, "ink": true, "off": true}
	if !validTrails[p.Editor.CursorTrailMode] {
		p.Editor.CursorTrailMode = "beam"
	}
	if p.Editor.CursorTrailColor != "accent" && !isValidHex(p.Editor.CursorTrailColor) {
		p.Editor.CursorTrailColor = "accent"
	}
	validIntensity := map[string]bool{"subtle": true, "normal": true, "vivid": true}
	if !validIntensity[p.Editor.CursorTrailIntensity] {
		p.Editor.CursorTrailIntensity = "normal"
	}
	// Decay invariant: fast must be <= slow, or the two-stage fade inverts.
	if p.Editor.CursorTrailDecayFast < 10 || p.Editor.CursorTrailDecayFast > 500 {
		p.Editor.CursorTrailDecayFast = 80
	}
	if p.Editor.CursorTrailDecaySlow < 50 || p.Editor.CursorTrailDecaySlow > 2000 {
		p.Editor.CursorTrailDecaySlow = 300
	}
	if p.Editor.CursorTrailDecaySlow < p.Editor.CursorTrailDecayFast {
		p.Editor.CursorTrailDecaySlow = p.Editor.CursorTrailDecayFast
	}
	if p.Editor.CursorTrailLength < 4 || p.Editor.CursorTrailLength > 64 {
		p.Editor.CursorTrailLength = 12
	}
	if p.Editor.CursorTrailStartThreshold < 1 || p.Editor.CursorTrailStartThreshold > 32 {
		p.Editor.CursorTrailStartThreshold = 4
	}
	validTyping := map[string]bool{"drop": true, "fade": true, "pop": true}
	if !validTyping[p.Editor.AnimatedTextStyle] {
		p.Editor.AnimatedTextStyle = "drop"
	}
	validDensity := map[string]bool{"comfortable": true, "compact": true, "dense": true}
	if !validDensity[p.Layout.Density] {
		p.Layout.Density = "comfortable"
	}
	validSidebar := map[string]bool{"left": true, "right": true}
	if !validSidebar[p.Layout.SidebarPosition] {
		p.Layout.SidebarPosition = "left"
	}
	showStatus := &p.Layout.ShowStatusBar
	enabled := p.Editor.CursorTrailEnabled
	spell := p.Editor.SpellCheckEnabled
	animated := p.Editor.AnimatedTextEnabled
	// Sky validation: fall back to defaults when out of range.
	validSkyDensity := map[string]bool{"sparse": true, "normal": true, "dense": true}
	if !validSkyDensity[p.Sky.Density] {
		p.Sky.Density = "normal"
	}
	validSkySpeed := map[string]bool{"slow": true, "normal": true, "fast": true}
	if !validSkySpeed[p.Sky.TwinkleSpeed] {
		p.Sky.TwinkleSpeed = "normal"
	}
	validSkyColor := map[string]bool{"natural": true, "warm": true, "cool": true}
	if !validSkyColor[p.Sky.StarColor] {
		p.Sky.StarColor = "natural"
	}
	nebula := p.Sky.NebulaEnabled
	return store.SavePreferences(store.Preferences{
		Theme: store.ThemePrefs{
			Preset:    p.Theme.Preset,
			AccentHex: p.Theme.AccentHex,
		},
		Layout: store.LayoutPrefs{
			SidebarPosition: p.Layout.SidebarPosition,
			Density:         p.Layout.Density,
			ShowStatusBar:   showStatus,
		},
		Editor: store.EditorPrefs{
			FontFamily:                p.Editor.FontFamily,
			FontSize:                  p.Editor.FontSize,
			LineHeight:                p.Editor.LineHeight,
			SpellCheckEnabled:         &spell,
			CursorTrailEnabled:        &enabled,
			CursorTrailMode:           p.Editor.CursorTrailMode,
			CursorTrailColor:          p.Editor.CursorTrailColor,
			CursorTrailIntensity:      p.Editor.CursorTrailIntensity,
			CursorTrailDecayFast:      p.Editor.CursorTrailDecayFast,
			CursorTrailDecaySlow:      p.Editor.CursorTrailDecaySlow,
			CursorTrailLength:         p.Editor.CursorTrailLength,
			CursorTrailStartThreshold: p.Editor.CursorTrailStartThreshold,
			AnimatedTextEnabled:       &animated,
			AnimatedTextStyle:         p.Editor.AnimatedTextStyle,
		},
		Sky: store.SkyPrefs{
			Density:       p.Sky.Density,
			TwinkleSpeed:  p.Sky.TwinkleSpeed,
			StarColor:     p.Sky.StarColor,
			NebulaEnabled: &nebula,
		},
	})
}

// isValidHex checks that a string is a valid 6-digit hex color like "#aabbcc".
func isValidHex(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for i := 1; i < 7; i++ {
		c := s[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
