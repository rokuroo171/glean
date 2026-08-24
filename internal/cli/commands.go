package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/glean/glean/internal/activity"
	"github.com/glean/glean/internal/growth"
	"github.com/glean/glean/internal/note"
	"github.com/glean/glean/internal/store"
	"github.com/glean/glean/internal/world"
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

// printUsage prints the top-level help text to stdout.
func printUsage() {
	fmt.Fprintln(os.Stdout, "glean - a notes app with lots of customization")
	fmt.Fprintln(os.Stdout)
	fmt.Fprintln(os.Stdout, "Usage:")
	fmt.Fprintln(os.Stdout, "  glean                     launch the app")
	fmt.Fprintln(os.Stdout, "  glean quick \"text\"      create a note instantly from text")
	fmt.Fprintln(os.Stdout, "  glean list                list notes with their brightness stage")
	fmt.Fprintln(os.Stdout, "  glean export <id>         write a note's body to <Title>.md")
	fmt.Fprintln(os.Stdout, "  glean import <folder>     import every .md in a folder as notes")
	fmt.Fprintln(os.Stdout, "  glean -h, --help          show this help")
}

// Run dispatches a CLI subcommand. Returns exit code.
func Run(args []string) int {
	if len(args) == 0 || args[0] == "-h" || args[0] == "--help" || args[0] == "help" {
		printUsage()
		return 0
	}

	skyDir, err := resolveSkyDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	reg, err := store.OpenRegistry(skyDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}

	switch args[0] {
	case "quick":
		return runQuick(reg, skyDir, args[1:])
	case "list":
		return runList(reg)
	case "export":
		return runExport(reg, skyDir, args[1:])
	case "import":
		return runImport(reg, skyDir, args[1:])
	default:
		fmt.Fprintf(os.Stderr, "glean: unknown command %q\n", args[0])
		return 1
	}
}

// resolveSkyDir returns the configured sky, bootstrapping a default one
// when no pointer exists. Mirrors the app's transitional bootstrap.
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

func runQuick(reg *store.RegistryStore, skyDir string, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean quick \"text\"")
		return 1
	}
	text := strings.Join(args, " ")
	title := titleFromText(text)
	name, err := store.FileNameFor(skyDir, "", title)
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	if err := store.WriteNoteFile(name, text); err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	rel, _ := filepath.Rel(skyDir, name)
	n := note.Note{ID: store.NewID(), Title: title, File: rel, CreatedAt: time.Now()}
	p := world.NextSpiralPosition(reg.All(), n.ID)
	n.WorldX, n.WorldY, n.Positioned = p.X, p.Y, true
	if err := reg.Create(n); err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	recordActivity(skyDir, reg)
	fmt.Printf("created %s (%s)\n", n.ID, n.Title)
	return 0
}

func runList(reg *store.RegistryStore) int {
	for _, n := range reg.All() {
		stage := stageLabel(growth.BrightnessStage(n))
		fmt.Printf("[%s] %s\n", stage, n.Title)
	}
	return 0
}

func runExport(reg *store.RegistryStore, skyDir string, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: glean export <id>")
		return 1
	}
	id := args[0]
	n, ok := reg.Get(id)
	if !ok {
		fmt.Fprintf(os.Stderr, "glean: note not found: %s\n", id)
		return 1
	}
	path := filepath.Join(skyDir, n.File)
	body, err := store.ReadNoteFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	filename := sanitizeFilename(n.Title) + ".md"
	if err := os.WriteFile(filename, []byte(body), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "glean: %v\n", err)
		return 1
	}
	fmt.Printf("exported to %s\n", filename)
	return 0
}

func runImport(reg *store.RegistryStore, skyDir string, args []string) int {
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
		name, err := store.FileNameFor(skyDir, "", base)
		if err != nil {
			return err
		}
		if err := store.WriteNoteFile(name, string(body)); err != nil {
			return err
		}
		rel, _ := filepath.Rel(skyDir, name)
		n := note.Note{ID: store.NewID(), Title: base, File: rel, CreatedAt: time.Now()}
		p := world.NextSpiralPosition(reg.All(), n.ID)
		n.WorldX, n.WorldY, n.Positioned = p.X, p.Y, true
		if err := reg.Create(n); err != nil {
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
		recordActivity(skyDir, reg)
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

func recordActivity(skyDir string, reg *store.RegistryStore) {
	a, err := activity.Open(skyDir)
	if err != nil {
		return
	}
	_ = a.Record(time.Now(), reg.All())
}
