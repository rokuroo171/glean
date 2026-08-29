package main

import (
	"embed"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/glean/glean/internal/cli"
	"github.com/glean/glean/internal/store"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// vaultAssets serves images the user imported into .glean/assets.
// Wails calls the AssetServer Handler only when the embedded bundle
// misses (see assethandler.go), so frontend/Vite paths can never land
// here; only /@assets/ requests do.
type vaultAssets struct {
	// root returns the active vault path, or "" when no sky is open.
	root func() string
}

// ServeHTTP is the asset fallback for Wails: it resolves the path
// against the vaults .glean/assets dir and serves the file.
func (h vaultAssets) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	root := h.root()
	if root == "" {
		http.NotFound(w, r)
		return
	}
	rel, ok := vaultAssetRel(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}
	full := filepath.Join(root, filepath.FromSlash(rel))
	// Only under .glean/assets, and never outside the vault.
	allowed := filepath.Join(root, ".glean", "assets")
	dir := filepath.Dir(full)
	if dir != allowed && !strings.HasPrefix(dir, allowed+string(os.PathSeparator)) {
		http.NotFound(w, r)
		return
	}
	if err := store.ValidateInsideDir(root, full); err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	if ctype := mime.TypeByExtension(strings.ToLower(filepath.Ext(full))); ctype != "" {
		w.Header().Set("Content-Type", ctype)
	}
	http.ServeFile(w, r, full)
}

// vaultAssetRel extracts the vault-relative path from a /@assets/
// request and rejects anything that could escape via ..
func vaultAssetRel(urlPath string) (string, bool) {
	if !strings.HasPrefix(urlPath, "/@assets/") {
		return "", false
	}
	rel := path.Clean(strings.TrimPrefix(urlPath, "/@assets/"))
	if rel == "." || strings.HasPrefix(rel, "..") {
		return "", false
	}
	return rel, true
}

func logError(msg string) {
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
		Title:     "glean",
		Width:     1200,
		Height:    800,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// Fallback: serve user-imported vault images under /@assets/.
			Handler: vaultAssets{root: func() string {
				if app == nil {
					return ""
				}
				return app.skyDir
			}},
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
