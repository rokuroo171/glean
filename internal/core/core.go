package core

import (
	"archive/zip"
	"encoding/base64"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/adjacency"
	"github.com/glean/glean/internal/ambient"
	vaultassets "github.com/glean/glean/internal/assets"
	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/wikilink"
	"github.com/glean/glean/internal/world"
)

// Service holds the sky domain logic: notes, links, stats, folders,
// preferences, import/export. It is transport-agnostic; Wails binds it on
// desktop and mobile bindings wrap the same calls
type Service struct {
	Store        *store.RegistryStore
	SkyDir       string
	Adjacency    *adjacency.Store
	Activity     *activity.Store
	Workspace    *store.WorkspaceStore
	lastNoteID   string
	lastNoteOpen time.Time
}

// New wires the sky-based stores when a sky is configured. Without a
// pointer the stores stay nil and the frontend shows the setup screen
func New() (*Service, error) {
	skyDir, ok, err := store.ResolveSky()
	if err != nil {
		return nil, err
	}
	if !ok {
		return &Service{}, nil
	}
	// Check the sky folder actually exists before opening stores
	// Without this, a deleted folder opens empty stores and the frontend
	// shows a ghost workspace instead of the recovery screen
	info, err := os.Stat(skyDir)
	if err != nil || !info.IsDir() {
		return &Service{}, nil
	}
	s := &Service{}
	if err := s.OpenSkyAt(skyDir); err != nil {
		return nil, err
	}
	return s, nil
}

// NoteView is the JSON-safe note representation sent to the frontend
type NoteView struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	Folder          string    `json:"folder"`
	CreatedAt       time.Time `json:"created_at"`
	LastVisited     time.Time `json:"last_visited"`
	VisitCount      int       `json:"visit_count"`
	LastWishAt time.Time `json:"last_manual_water"`
	WorldX          int       `json:"world_x"`
	WorldY          int       `json:"world_y"`
	Positioned      bool      `json:"positioned"`
	Stage           string    `json:"stage"`
	Species         string    `json:"species"`
	LinkCount       int       `json:"link_count"`
}

func noteToView(n note.Note, linkCounts map[string]int) NoteView {
	return NoteView{
		ID:              n.ID,
		Title:           n.Title,
		Body:            n.Body,
		Folder:          store.FolderOf(n.File),
		CreatedAt:       n.CreatedAt,
		LastVisited:     n.LastVisited,
		VisitCount:      n.VisitCount,
		LastWishAt: n.LastWishAt,
		WorldX:          n.WorldX,
		WorldY:          n.WorldY,
		Positioned:      n.Positioned,
		Stage:           stageName(growth.BrightnessStage(n)),
		Species:         colorTempFromID(n.ID),
		LinkCount:       linkCounts[n.ID],
	}
}

// outboundLinkCounts scans every note body once and counts how many
// distinct notes each note links to by [[wikilink]]. Unresolved targets
// (no matching note title) are skipped, matching GetLinks. Reading each
// body is the same cost GetLinks already pays, and the map is reused
// across the whole scan (files are read once, not per note)
func (s *Service) outboundLinkCounts() map[string]int {
	counts := make(map[string]int)
	if s.Store == nil {
		return counts
	}
	notes := s.Store.All()
	byTitle := make(map[string]string, len(notes))
	for _, n := range notes {
		byTitle[strings.ToLower(n.Title)] = n.ID
	}
	for _, n := range notes {
		path, err := s.notePath(n)
		if err != nil {
			continue
		}
		body, err := store.ReadNoteFile(path)
		if err != nil {
			continue
		}
		seen := make(map[string]bool)
		for _, l := range wikilink.Scan(body) {
			to, ok := byTitle[strings.ToLower(l.Target)]
			if !ok || to == n.ID {
				continue
			}
			if !seen[to] {
				seen[to] = true
				counts[n.ID]++
			}
		}
	}
	return counts
}

func stageName(st growth.Stage) string {
	switch st {
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

// colorTempFromID derives a deterministic star color temperature from the note ID
// Uses the same FNV hash as world positioning for consistency
func colorTempFromID(id string) string {
	temps := []string{"warm", "cool", "neutral", "hot"}
	h := fnvHash(id)
	return temps[h%uint64(len(temps))]
}

func fnvHash(st string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(st))
	return h.Sum64()
}

// GetNotes returns all notes as views for the sky canvas. Bodies stay
// empty here; they load on open
func (s *Service) GetNotes() []NoteView {
	if s.Store == nil {
		return nil
	}
	notes := s.Store.All()
	linkCounts := s.outboundLinkCounts()
	views := make([]NoteView, len(notes))
	for i, n := range notes {
		v := noteToView(n, linkCounts)
		if path, err := s.notePath(n); err == nil {
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
// notes -- it only adds new ones -- to avoid losing bodies
func (s *Service) ScanSky() []NoteView {
	if s.Store == nil {
		return nil
	}
	added, _ := store.ScanAddOnly(s.SkyDir, s.Store)
	_ = added // new notes are already in the registry
	notes := s.Store.All()
	linkCounts := s.outboundLinkCounts()
	views := make([]NoteView, len(notes))
	for i, n := range notes {
		v := noteToView(n, linkCounts)
		if path, err := s.notePath(n); err == nil {
			if body, err := store.ReadNoteFile(path); err == nil {
				v.Body = body
			}
		}
		views[i] = v
	}

	return views
}

// notePath resolves a note's md file from the registry's recorded path
// File stores the relative path from skyDir (e.g. "glean/arch.md")
func (s *Service) notePath(n note.Note) (string, error) {
	var p string
	if n.File != "" {
		p = filepath.Join(s.SkyDir, n.File)
	} else {
		// Legacy entry without File -- derive from title at root
		var err error
		p, err = store.FileNameFor(s.SkyDir, "", n.Title)
		if err != nil {
			return "", err
		}
	}
	if err := store.ValidateInsideDir(s.SkyDir, p); err != nil {
		return "", err
	}
	return p, nil
}

// GetNote returns a single note by ID, loading its body from the md file
// without recording a visit
func (s *Service) GetNote(id string) (NoteView, bool) {
	if s.Store == nil {
		return NoteView{}, false
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return NoteView{}, false
	}
	path, err := s.notePath(n)
	if err != nil {
		return NoteView{}, false
	}
	body, err := store.ReadNoteFile(path)
	if err != nil {
		return NoteView{}, false
	}
	n.Body = body
	return noteToView(n, nil), true
}

// CreateNote creates a new note with a title and returns it
// The optional folder param places the note in a subfolder directly
func (s *Service) CreateNote(title string, contextID string, folder string) (NoteView, error) {
	if s.Store == nil {
		return NoteView{}, fmt.Errorf("no sky configured")
	}
	if title == "" {
		title = "Untitled"
	}
	id := store.NewID()
	notes := s.Store.All()
	p := world.PositionForNew(notes, contextID, id)

	// If folder is provided directly, use it. Otherwise derive from contextID
	if folder == "" && contextID != "" {
		if ctx, ok := s.Store.Get(contextID); ok && ctx.File != "" {
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
	name, err := store.FileNameFor(s.SkyDir, folder, title)
	if err != nil {
		return NoteView{}, err
	}
	if err := store.ValidateInsideDir(s.SkyDir, name); err != nil {
		return NoteView{}, err
	}
	if err := store.WriteNoteFile(name, ""); err != nil {
		return NoteView{}, err
	}
	rel, _ := filepath.Rel(s.SkyDir, name)
	n.File = rel
	if err := s.Store.Create(n); err != nil {
		return NoteView{}, err
	}
	s.recordActivity()
	return noteToView(n, nil), nil
}

// SaveNote writes the md file, renames on title change, updates the registry
func (s *Service) SaveNote(id, title, body string) error {
	if s.Store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return fmt.Errorf("note not found: %s", id)
	}
	oldPath, err := s.notePath(n)
	if err != nil {
		return err
	}
	if strings.EqualFold(store.SanitizeTitle(title), store.SanitizeTitle(n.Title)) {
		// Same title, keep the existing file
		if err := store.WriteNoteFile(oldPath, body); err != nil {
			return err
		}
		n.Title = title
		return s.Store.Update(n)
	}
	// Title changed -- create new file in the same folder, remove old
	folder := store.FolderOf(n.File)
	newPath, err := store.FileNameFor(s.SkyDir, folder, title)
	if err != nil {
		return err
	}
	if err := store.WriteNoteFile(newPath, body); err != nil {
		return err
	}
	_ = os.Remove(oldPath)
	n.Title = title
	rel, _ := filepath.Rel(s.SkyDir, newPath)
	n.File = rel
	return s.Store.Update(n)
}

// ImportImage stores an image (base64 data URI) in the vault's
// .glean/assets/ folder and returns the vault-relative path to embed
// in a note, e.g. ".glean/assets/sunset.png". The md file stays
// portable: it references a location inside the vault, not an
// absolute path or a pasted blob
func (s *Service) ImportImage(name, dataURI string) (string, error) {
	if s.Store == nil {
		return "", fmt.Errorf("no sky configured")
	}
	raw, err := base64FromDataURI(dataURI)
	if err != nil {
		return "", err
	}
	return vaultassets.ImportImage(s.SkyDir, name, raw)
}

// base64FromDataURI strips the "data:<mime>;base64," prefix and
// decodes the rest. Anything without a comma is rejected
func base64FromDataURI(dataURI string) ([]byte, error) {
	_, b64, ok := strings.Cut(dataURI, ",")
	if !ok {
		return nil, errors.New("invalid image payload")
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}
	return raw, nil
}

// DeleteNote removes the registry entry and the md file
func (s *Service) DeleteNote(id string) error {
	if s.Store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return nil
	}
	path, err := s.notePath(n)
	if err != nil {
		return err
	}
	_ = os.Remove(path)
	if s.lastNoteID == id {
		s.lastNoteID = ""
		s.lastNoteOpen = time.Time{}
	}
	return s.Store.Delete(id)
}

// WishNote grants a manual wish on a note (once per day)
func (s *Service) WishNote(id string) (bool, error) {
	if s.Store == nil {
		return false, nil
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return false, nil
	}
	if !note.CanWishToday(n) {
		return false, nil
	}
	n.VisitCount++
	n.LastWishAt = time.Now()
	if err := s.Store.Update(n); err != nil {
		return false, err
	}
	s.recordActivity()
	return true, nil
}

// OpenNote records a visit (passive wish) and returns the note, loading
// its body from the md file. Also records adjacency transitions for
// constellation line rendering
func (s *Service) OpenNote(id string) (NoteView, error) {
	if s.Store == nil {
		return NoteView{}, fmt.Errorf("no sky configured")
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return NoteView{}, nil
	}
	path, err := s.notePath(n)
	if err != nil {
		return NoteView{}, err
	}
	body, err := store.ReadNoteFile(path)
	if err != nil {
		return NoteView{}, err
	}
	n.Body = body

	now := time.Now()

	// Record adjacency transition from previous note to this one
	if s.Adjacency != nil && s.lastNoteID != "" && !s.lastNoteOpen.IsZero() {
		_, _ = s.Adjacency.RecordTransition(
			adjacency.VisitEvent{NoteID: s.lastNoteID, OpenedAt: s.lastNoteOpen, ClosedAt: now},
			adjacency.VisitEvent{NoteID: id, OpenedAt: now, ClosedAt: time.Time{}},
			now,
		)
	}
	s.lastNoteID = id
	s.lastNoteOpen = now

	n.VisitCount++
	n.LastVisited = now
	if err := s.Store.Update(n); err != nil {
		return NoteView{}, err
	}
	s.recordActivity()
	return noteToView(n, nil), nil
}

// TrailView is the JSON-safe trail representation for the frontend
type TrailView struct {
	NoteA  string `json:"note_a"`
	NoteB  string `json:"note_b"`
	Dimmed bool   `json:"dimmed"`
	Visits int    `json:"visits"`
}

// GetLinks returns all resolved wikilink edges across the sky's notes
// Each pair is the IDs of two notes connected by at least one [[Title]]
// reference (either direction), deduped and sorted. Unresolved links
// ([[Missing]]) are excluded here; the preview styles them itself.
// Pairs carry their co-visit count from trails.json so the sky can
// weight trail display by real usage
func (s *Service) GetLinks() []TrailView {
	if s.Store == nil {
		return nil
	}
	visits := make(map[string]int)
	if s.Adjacency != nil {
		for _, p := range s.Adjacency.Pairs() {
			visits[linkPairKey(p.NoteA, p.NoteB)] = p.Count
		}
	}
	notes := s.Store.All()
	byTitle := make(map[string]string, len(notes)) // lowercase title -> id
	for _, n := range notes {
		byTitle[strings.ToLower(n.Title)] = n.ID
	}
	edgeSet := make(map[string]bool)
	views := make([]TrailView, 0, len(notes))
	for _, n := range notes {
		path, err := s.notePath(n)
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
			views = append(views, TrailView{NoteA: n.ID, NoteB: to, Dimmed: false, Visits: visits[key]})
		}
	}
	return views
}

// linkPairKey returns a canonical, order-independent key for a note pair
func linkPairKey(a, b string) string {
	if a < b {
		return a + "\x00" + b
	}
	return b + "\x00" + a
}

// StatsView is the JSON-safe stats representation for the frontend
type StatsView struct {
	TotalNotes     int            `json:"total_notes"`
	StageCounts    map[string]int `json:"stage_counts"`
	CurrentStreak  int            `json:"current_streak"`
	LongestStreak  int            `json:"longest_streak"`
	LastActiveDate string         `json:"last_active_date"`
	Milestones     MilestonesView `json:"milestones"`
	DailyCounts    map[string]int `json:"daily_counts"`
}

// MilestonesView mirrors activity.Milestones for JSON serialization
type MilestonesView struct {
	FirstSproutAt *string `json:"first_sprout_at,omitempty"`
	FirstTreeAt   *string `json:"first_tree_at,omitempty"`
	TenNotesAt    *string `json:"ten_notes_at,omitempty"`
	TwentyNotesAt *string `json:"twenty_notes_at,omitempty"`
}

// GetStats returns sky stats: stage counts, streaks, milestones, daily activity
func (s *Service) GetStats() StatsView {
	if s.Store == nil {
		return StatsView{}
	}
	notes := s.Store.All()
	stageCounts := map[string]int{}
	for _, n := range notes {
		stageCounts[stageName(growth.BrightnessStage(n))]++
	}

	view := StatsView{
		TotalNotes:  len(notes),
		StageCounts: stageCounts,
		DailyCounts: map[string]int{},
	}

	if s.Activity != nil {
		data := s.Activity.Data()
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
	st := t.Format("2006-01-02")
	return &st
}

// PaletteView is the JSON-safe ambient palette for the frontend
type PaletteView struct {
	Primary     string `json:"primary"`
	Secondary   string `json:"secondary"`
	Accent      string `json:"accent"`
	Muted       string `json:"muted"`
	Heading     string `json:"heading"`
	List        string `json:"list"`
	Sky         string `json:"sky"`
	Nebula      string `json:"nebula"`
	Aurora      bool   `json:"aurora"`
	MeteorBoost int    `json:"meteor_boost"`
}

// GetSkyName returns the configured sky's display name
func (s *Service) GetSkyName() string {
	name, err := store.LoadSkyName(s.SkyDir)
	if err != nil {
		return "My Sky"
	}
	return name
}

// GetSkyPath returns the configured sky folder path
func (s *Service) GetSkyPath() string {
	return s.SkyDir
}

// SystemInfo holds basic runtime information
type SystemInfo struct {
	OS   string `json:"os"`
	Arch string `json:"arch"`
}

// GetSystemInfo returns the host OS and architecture
func (s *Service) GetSystemInfo() SystemInfo {
	return SystemInfo{OS: runtime.GOOS, Arch: runtime.GOARCH}
}

// OpenURL opens a URL in the system default browser
func (s *Service) OpenURL(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

// GetPalette returns the ambient color palette based on current time-of-day and season
func (s *Service) GetPalette() PaletteView {
	// The user can pin a season in Customization to preview any sky;
	// an empty override means the real wall-clock palette
	season := ""
	if s.Store != nil {
		prefs := store.LoadPreferences()
		season = prefs.Sky.Season
	}
	when := time.Now()
	if season != "" {
		when = seasonDate(season)
	}
	p := ambient.Palette(when)
	return PaletteView{
		Primary:     p.Primary,
		Secondary:   p.Secondary,
		Accent:      p.Accent,
		Muted:       p.Muted,
		Heading:     p.Heading,
		List:        p.List,
		Sky:         p.Sky,
		Nebula:      p.Nebula,
		Aurora:      p.Aurora,
		MeteorBoost: p.MeteorBoost,
	}
}

// seasonDate returns a representative date for a pinned season so the
// ambient palette can render it. ("" is never passed here; the caller
// checks first.) Each choice lands mid-season with a nearby meteor
// shower so previews show the seasonal extras too
func seasonDate(season string) time.Time {
	year := time.Now().Year()
	switch season {
	case "winter":
		return time.Date(year, time.January, 3, 22, 0, 0, 0, time.Local) // Quadrantids
	case "spring":
		return time.Date(year, time.April, 22, 22, 0, 0, 0, time.Local) // Lyrids
	case "summer":
		return time.Date(year, time.August, 11, 22, 0, 0, 0, time.Local) // Perseids
	case "autumn":
		return time.Date(year, time.October, 21, 22, 0, 0, 0, time.Local) // Orionids
	default:
		return time.Now()
	}
}

func (s *Service) recordActivity() {
	if s.Activity == nil {
		return
	}
	_ = s.Activity.Record(time.Now(), s.Store.All())
}

// CreateFolder creates a new empty directory under the sky
func (s *Service) CreateFolder(name, folder string) error {
	if s.Store == nil {
		return fmt.Errorf("no sky configured")
	}
	if name == "" {
		return fmt.Errorf("folder name is empty")
	}

	// Build the full folder path: skyDir/folder/name
	var folderPath string
	if folder == "" {
		folderPath = filepath.Join(s.SkyDir, name)
	} else {
		folderPath = filepath.Join(s.SkyDir, folder, name)
	}

	// Create the actual directory on disk
	if err := os.MkdirAll(folderPath, 0o755); err != nil {
		return fmt.Errorf("create folder: %w", err)
	}
	return nil
}

// ListFolders returns all subdirectories in the sky as a flat list of
// relative paths (e.g. ["A", "A/B", "A/B/C"]). Empty for root-only skies
func (s *Service) ListFolders() []string {
	if s.SkyDir == "" {
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
	walk(s.SkyDir, "")
	return result
}

// MoveNote moves a note to a different folder within the sky
func (s *Service) MoveNote(id, targetFolder string) error {
	if s.Store == nil {
		return fmt.Errorf("no sky configured")
	}
	n, ok := s.Store.Get(id)
	if !ok {
		return fmt.Errorf("note not found: %s", id)
	}
	oldPath, err := s.notePath(n)
	if err != nil {
		return err
	}
	newPath, err := store.FileNameFor(s.SkyDir, targetFolder, n.Title)
	if err != nil {
		return err
	}
	if err := store.ValidateInsideDir(s.SkyDir, newPath); err != nil {
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
	rel, _ := filepath.Rel(s.SkyDir, newPath)
	n.File = rel
	return s.Store.Update(n)
}

// folderNameValid rejects names that are unsafe or illegal as a folder name
// Names must stay a single path segment and be usable on Windows too
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

// folderPathValid validates every segment of a relative folder path
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
// paths of every note that lives under it
func (s *Service) RenameFolder(folder, newName string) error {
	if s.Store == nil {
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

	oldAbs := filepath.Join(s.SkyDir, filepath.FromSlash(folder))
	if err := store.ValidateInsideDir(s.SkyDir, oldAbs); err != nil {
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

	relOld, _ := filepath.Rel(s.SkyDir, oldAbs)
	relNew, _ := filepath.Rel(s.SkyDir, newAbs)
	relOld = filepath.ToSlash(relOld)
	relNew = filepath.ToSlash(relNew)

	if err := os.Rename(oldAbs, newAbs); err != nil {
		return fmt.Errorf("rename folder: %w", err)
	}

	// Update registry entries whose file lives under the renamed folder
	prefix := relOld + "/"
	for _, n := range s.Store.All() {
		f := filepath.ToSlash(n.File)
		if f != relOld && !strings.HasPrefix(f, prefix) {
			continue
		}
		n.File = relNew + "/" + filepath.ToSlash(filepath.Base(n.File))
		if err := s.Store.Update(n); err != nil {
			return err
		}
	}
	return nil
}

// DeleteFolder removes a folder (and everything in it) from the sky and
// drops the registry entries of every note it contained
func (s *Service) DeleteFolder(folder string) error {
	if s.Store == nil {
		return fmt.Errorf("no sky configured")
	}
	folder = filepath.ToSlash(folder)
	if err := folderPathValid(folder); err != nil {
		return err
	}

	folderAbs := filepath.Join(s.SkyDir, filepath.FromSlash(folder))
	if err := store.ValidateInsideDir(s.SkyDir, folderAbs); err != nil {
		return err
	}
	info, err := os.Stat(folderAbs)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("folder not found: %s", folder)
	}

	rel, _ := filepath.Rel(s.SkyDir, folderAbs)
	rel = filepath.ToSlash(rel)
	prefix := rel + "/"

	if err := os.RemoveAll(folderAbs); err != nil {
		return fmt.Errorf("delete folder: %w", err)
	}

	// Drop every registry entry under the deleted folder
	for _, n := range s.Store.All() {
		f := filepath.ToSlash(n.File)
		if f != rel && !strings.HasPrefix(f, prefix) {
			continue
		}
		_ = s.Store.Delete(n.ID)
		if s.lastNoteID == n.ID {
			s.lastNoteID = ""
			s.lastNoteOpen = time.Time{}
		}
	}
	return nil
}

// KnownSkyView is the JSON-safe known sky entry for the frontend
type KnownSkyView struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// GetKnownSkies returns all remembered skies for the manage-skies UI
// Skies whose folder no longer exists on disk are filtered out, so the
// list never shows stale entries for deleted/moved folders
func (s *Service) GetKnownSkies() []KnownSkyView {
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

// SwitchSky changes the active sky to the given path and reloads everything
// Returns the new sky name on success
func (s *Service) SwitchSky(path string) (string, error) {
	if err := store.SwitchSky(path); err != nil {
		return "", err
	}
	// Close old stores
	s.Store = nil
	s.Adjacency = nil
	s.Activity = nil
	s.Workspace = nil
	// Open the new sky
	if err := s.OpenSkyAt(path); err != nil {
		return "", err
	}
	return s.GetSkyName(), nil
}

// RemoveKnownSky removes a sky from the known list. Does not delete files
func (s *Service) RemoveKnownSky(path string) error {
	return store.RemoveKnownSky(path)
}

// PreferencesView is the JSON-safe preferences representation for the frontend
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
	TabWidth                  int     `json:"tab_width"`
	AutosaveInterval          int     `json:"autosave_interval"`
	WordWrap                  bool    `json:"word_wrap"`
	LineNumbers               bool    `json:"line_numbers"`
	NarrowWidth               bool    `json:"narrow_width"`
	ShowOutline               bool    `json:"show_outline"`
}

type SkyPrefsView struct {
	Density        string `json:"density"`
	TwinkleSpeed   string `json:"twinkle_speed"`
	StarColor      string `json:"star_color"`
	NebulaEnabled  bool   `json:"nebula_enabled"`
	SpeciesWarm    string `json:"species_warm"`
	SpeciesCool    string `json:"species_cool"`
	SpeciesHot     string `json:"species_hot"`
	SpeciesNeutral string `json:"species_neutral"`
	Season         string `json:"season"`
}

// GetPreferences returns the user's customization preferences
func (s *Service) GetPreferences() PreferencesView {
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
			TabWidth:                  p.Editor.TabWidth,
			AutosaveInterval:          p.Editor.AutosaveInterval,
			WordWrap:                  p.Editor.WordWrap == nil || *p.Editor.WordWrap,
			LineNumbers:               p.Editor.LineNumbers != nil && *p.Editor.LineNumbers,
			NarrowWidth:               p.Editor.NarrowWidth == nil || *p.Editor.NarrowWidth,
			ShowOutline:               p.Editor.ShowOutline == nil || *p.Editor.ShowOutline,
		},
		Sky: SkyPrefsView{
			Density:        p.Sky.Density,
			TwinkleSpeed:   p.Sky.TwinkleSpeed,
			StarColor:      p.Sky.StarColor,
			NebulaEnabled:  p.Sky.NebulaEnabled != nil && *p.Sky.NebulaEnabled,
			SpeciesWarm:    p.Sky.SpeciesWarm,
			SpeciesCool:    p.Sky.SpeciesCool,
			SpeciesHot:     p.Sky.SpeciesHot,
			SpeciesNeutral: p.Sky.SpeciesNeutral,
			Season:         p.Sky.Season,
		},
	}
}

// SavePreferences persists the user's customization preferences
func (s *Service) SavePreferences(p PreferencesView) error {
	// Validate and sanitize inputs
	validPresets := map[string]bool{"midnight": true, "aurora": true, "ember": true, "ocean": true, "lavender": true, "nord": true, "gruvbox": true, "tokyo-night": true, "catppuccin-mocha": true, "paper": true, "catppuccin-latte": true}
	if !validPresets[p.Theme.Preset] {
		p.Theme.Preset = "midnight"
	}
	if !isValidHex(p.Theme.AccentHex) {
		p.Theme.AccentHex = "#5b9fd4"
	}
	// "kitty" was the original reference name for the default trail;
	// normalize it to "beam" so saved prefs keep working
	if p.Editor.CursorTrailMode == "kitty" {
		p.Editor.CursorTrailMode = "beam"
	}
	validTrails := map[string]bool{"beam": true, "sparkle": true, "ink": true, "off": true}
	if !validTrails[p.Editor.CursorTrailMode] {
		p.Editor.CursorTrailMode = "beam"
	}
	// Season override: empty = auto (wall-clock), otherwise one of the
	// four previews so the user can see any sky any day
	validSeasons := map[string]bool{"": true, "winter": true, "spring": true, "summer": true, "autumn": true}
	if !validSeasons[p.Sky.Season] {
		p.Sky.Season = ""
	}
	if p.Editor.CursorTrailColor != "accent" && !isValidHex(p.Editor.CursorTrailColor) {
		p.Editor.CursorTrailColor = "accent"
	}
	validIntensity := map[string]bool{"subtle": true, "normal": true, "vivid": true}
	if !validIntensity[p.Editor.CursorTrailIntensity] {
		p.Editor.CursorTrailIntensity = "normal"
	}
	// Decay invariant: fast must be <= slow, or the two-stage fade inverts
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
	// Sky validation: fall back to defaults when out of range
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
			TabWidth:                  p.Editor.TabWidth,
			AutosaveInterval:          p.Editor.AutosaveInterval,
			WordWrap:                  &p.Editor.WordWrap,
			LineNumbers:               &p.Editor.LineNumbers,
			NarrowWidth:               &p.Editor.NarrowWidth,
			ShowOutline:               &p.Editor.ShowOutline,
		},
		Sky: store.SkyPrefs{
			Density:        p.Sky.Density,
			TwinkleSpeed:   p.Sky.TwinkleSpeed,
			StarColor:      p.Sky.StarColor,
			NebulaEnabled:  &nebula,
			SpeciesWarm:    p.Sky.SpeciesWarm,
			SpeciesCool:    p.Sky.SpeciesCool,
			SpeciesHot:     p.Sky.SpeciesHot,
			SpeciesNeutral: p.Sky.SpeciesNeutral,
			Season:         p.Sky.Season,
		},
	})
}

// isValidHex checks that a string is a valid 6-digit hex color like "#aabbcc"
func isValidHex(str string) bool {
	if len(str) != 7 || str[0] != '#' {
		return false
	}
	for i := 1; i < 7; i++ {
		c := str[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// OpenVaultFolder opens the vault directory in the system file manager
func (s *Service) OpenVaultFolder() error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", s.SkyDir)
	case "darwin":
		cmd = exec.Command("open", s.SkyDir)
	default:
		cmd = exec.Command("xdg-open", s.SkyDir)
	}
	return cmd.Start()
}

// ExportSky zips the vault folder and returns the zip data as base64
func (s *Service) ExportSky() (string, error) {
	zipPath := filepath.Join(os.TempDir(), "glean-export.zip")
	f, err := os.Create(zipPath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()

	err = filepath.Walk(s.SkyDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(s.SkyDir, path)
		if err != nil {
			return err
		}
		if info.IsDir() {
			_, err = zw.Create(rel + "/")
			return err
		}
		wf, err := zw.Create(rel)
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()
		_, err = io.Copy(wf, src)
		return err
	})
	if err != nil {
		return "", err
	}
	zw.Close()
	f.Close()

	data, err := os.ReadFile(zipPath)
	if err != nil {
		return "", err
	}
	os.Remove(zipPath)
	return base64.StdEncoding.EncodeToString(data), nil
}

// ImportNotes extracts a base64-encoded zip into the vault folder
func (s *Service) ImportNotes(data string) error {
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return err
	}
	r, err := zip.NewReader(strings.NewReader(string(raw)), int64(len(raw)))
	if err != nil {
		return err
	}
	for _, f := range r.File {
		fp := filepath.Join(s.SkyDir, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fp, 0o755)
			continue
		}
		os.MkdirAll(filepath.Dir(fp), 0o755)
		out, err := os.Create(fp)
		if err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}
		io.Copy(out, in)
		in.Close()
		out.Close()
	}
	return nil
}

// DeleteSky removes the vault folder and all its contents
func (s *Service) DeleteSky() error {
	return os.RemoveAll(s.SkyDir)
}
