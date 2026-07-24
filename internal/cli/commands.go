package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
)

// stageLabel returns a human-readable stage name for CLI output.
func stageLabel(s growth.Stage) string {
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

const titleMaxLen = 60

// Run dispatches a CLI subcommand. Returns exit code.
func Run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean quick|list|export|import ...")
		return 1
	}

	s, err := store.Open()
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}

	switch args[0] {
	case "quick":
		return runQuick(s, args[1:])
	case "list":
		return runList(s)
	case "export":
		return runExport(s, args[1:])
	case "import":
		return runImport(s, args[1:])
	default:
		fmt.Fprintf(os.Stderr, "glean: unknown command %q\n", args[0])
		return 1
	}
}

func runQuick(s *store.Store, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean quick \"text\"")
		return 1
	}
	text := strings.Join(args, " ")
	title := titleFromText(text)
	n := note.Note{
		ID:          uuid.NewString(),
		Title:       title,
		Body:        text,
		CreatedAt:   time.Now(),
		LastVisited: time.Time{},
		VisitCount:  0,
	}
	if err := s.Create(n); err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	recordActivity(s)
	fmt.Printf("created %s (%s)\n", n.ID, n.Title)
	return 0
}

func runList(s *store.Store) int {
	for _, n := range s.Notes() {
		stage := stageLabel(growth.BrightnessStage(n))
		fmt.Printf("[%s] %s\n", stage, n.Title)
	}
	return 0
}

func runExport(s *store.Store, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean export <id>")
		return 1
	}
	id := args[0]
	n, ok := s.Get(id)
	if !ok {
		fmt.Fprintf(os.Stderr, "glean: note not found: %s\n", id)
		return 1
	}
	filename := sanitizeFilename(n.Title) + ".md"
	if err := os.WriteFile(filename, []byte(n.Body), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	fmt.Printf("exported to %s\n", filename)
	return 0
}

func runImport(s *store.Store, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean import <folder>")
		return 1
	}
	root := args[0]
	count := 0
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(strings.ToLower(info.Name()), ".md") {
			return nil
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		base := strings.TrimSuffix(info.Name(), filepath.Ext(info.Name()))
		n := note.Note{
			ID:          uuid.NewString(),
			Title:       base,
			Body:        string(body),
			CreatedAt:   time.Now(),
			LastVisited: time.Time{},
			VisitCount:  0,
		}
		if err := s.Create(n); err != nil {
			return err
		}
		count++
		return nil
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	if count > 0 {
		recordActivity(s)
	}
	fmt.Printf("imported %d notes\n", count)
	return 0
}

func titleFromText(text string) string {
	line, _, _ := strings.Cut(text, "\n")
	line = strings.TrimSpace(line)
	if line == "" {
		return "Untitled"
	}
	if utf8.RuneCountInString(line) <= titleMaxLen {
		return line
	}
	runes := []rune(line)
	return string(runes[:titleMaxLen]) + "…"
}

func sanitizeFilename(title string) string {
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	)
	name := replacer.Replace(strings.TrimSpace(title))
	if name == "" {
		return "untitled"
	}
	return name
}

func recordActivity(s *store.Store) {
	a, err := activity.Open()
	if err != nil {
		return
	}
	_ = a.Record(time.Now(), s.Notes())
}
