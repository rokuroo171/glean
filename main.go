package main

import (
	"embed"
	"os"
	"path/filepath"

	"github.com/glean/glean/internal/cli"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func logError(msg string){
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	logPath := filepath.Join(home, "glean-error.log")
	f, ferr := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if ferr != nil {
		return
	}
	defer f.Close()
	f.WriteString(msg + "\n")
}

func main() {
	// CLI subcommands bypass the GUI entirely.
	if len(os.Args) > 1 {
		os.Exit(cli.Run(os.Args[1:]))
	}

	app, err := NewApp()
	if err != nil {
		msg := "glean: NewApp failed: " + err.Error()
		logError(msg)
		os.Stderr.WriteString(msg + "\n")
		os.Exit(1)
	}

	err = wails.Run(&options.App{
		Title:  "glean",
		Width:  1200,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		msg := "glean: wails.Run failed: " + err.Error()
		logError(msg)
		os.Stderr.WriteString(msg + "\n")
		os.Exit(1)
	}
}
