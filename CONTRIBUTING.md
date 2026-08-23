# Contributing to glean

Thanks for helping out. This file maps the project so you can find your way
around, build, and ship without breaking the pieces that are easy to break.

## Quick start

Prerequisites: Go 1.21+, Node 18+, the [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation).

```bash
# 1. The backend (Go) + frontend (React), one binary
wails build          # output: build/bin/glean(.exe)

# 2. Frontend-only hot reload (mock mode)
cd frontend
npm install
npm run dev          # browser preview; app runs on mock data when the
                     # wails runtime is absent, so most UI work needs no Go
```

`wails build` regenerates the bindings under `frontend/wailsjs/`. If the
build complains about a non-empty `frontend/wailsjs/go`, delete that dir
first (a stale vite dev server can lock it).

## Architecture

```
main.go          entry point; wires the App and window size/title
app.go           wails-bound API: notes, skies, preferences, stats
setup.go         first-run setup, sky adoption (OpenSky), default paths
workspace.go     note CRUD, visits, streaks, trails
internal/store/  all persistence (JSON) and config paths
installer/       C# Installer.cs + Uninstaller.cs (Windows only)
frontend/src/
  App.jsx        root: tabs, provider wiring, command center
  components/    every view: Home, Sky, EditorPane, FileExplorer,
                 CustomizationPane, OnboardingTour, ...
  lib/           theme.js (color tokens), apply-theme.js (presets),
                 preferences-context.jsx (prefs store contract)
  hooks/         useReducedMotion, etc.
  wailsjs/       generated bindings, do not hand-edit
```

### Data model

- A **sky** is a plain folder. Everything about it lives in a `.glean/`
  sidecar: `notes.json`, `.md` bodies, `stats.json`, `trails.json`,
  `sky.json`.
- App-wide state (preferences, known skies list) lives in the platform
  config dir (`%APPDATA%\glean` on Windows).
- The frontend never touches disk; all persistence goes through the Go
  API in `app.go` / `setup.go`.

## Preferences pipeline

Adding a customization switch touches all of these, in order:

1. `internal/store/preferences.go` - add the field to the `*Prefs` struct
   with its default in `DefaultPreferences()` and the nil-fallback in
   `LoadPreferences`.
2. `app.go` - mirror the field in the `*PrefsView` struct, map it in
   `GetPreferences` and `SavePreferences`, and sanitize it in
   `SavePreferences` validation.
3. `frontend/src/lib/preferences-context.jsx` - add it to `defaultPrefs`
   so the frontend has the same fallback.
4. `frontend/src/components/CustomizationPane.jsx` - the UI control.
5. Consume it where it matters (e.g. `EditorPane.jsx`).

Use `*bool` with nil = default-true for on/off switches so old
`preferences.json` files get the default instead of `false`.

## Tooltips

There are no native browser tooltips. Any element can carry
`data-tip="label"` and the portal-based `TooltipLayer` (mounted once in
`App.jsx`) renders a styled tooltip that escapes overflow clipping. When
converting a `title=` attribute, keep the `aria-label` for accessibility.

## Icons

Use the project's `Icon` component (`src/components/Icon.jsx`), backed by
an inline `paths` lookup. Do not add `lucide-react` or any new dependency
without a maintainer approving it first.

## The Windows installer / uninstaller

The old NSIS setup is gone. Installer and uninstaller are hand-written C#
(`installer/Installer.cs`, `installer/Uninstaller.cs`) compiled with the
.NET Framework C# compiler, so they run without a runtime install.

- Exact compile commands: `build/bin/Installer&UninstallerCompileGuide.txt`.
- The compiled binaries land in `build/bin/gleanInstaller.exe` and
  `build/bin/gleanUninstaller.exe` (the installer embeds the app binary).
- The installer writes `DisplayVersion` to the registry and shows the
  version on its UI - keep the string in sync with the app.

## Versioning

The version appears in four places - keep them in sync (they all say the
current release):

- `frontend/src/App.jsx` (status bar)
- `frontend/src/components/ManageSky.jsx` (footer)
- `installer/Installer.cs` (UI text + `DisplayVersion` registry value)
- the git tag (vX.Y.Z) that drives the release

We follow semver: minor for features, patch for fixes.

## Code style

Plain and boring is the goal:

- Comments explain why, not what. No decorative section dividers
  (`====`, `----`), no box-drawing, nothing that looks like a banner.
  A one-line comment above a function is plenty.
- No em/en dashes in comments or strings; a hyphen does the job.
- Match surrounding style; inline styles are the norm in this codebase.
- No `console.log` leftovers in committed code.

## Testing

- `go build ./...` must pass.
- `cd frontend && npm run build` must pass.
- The repo uses `go test` for pure functions if applicable.
- For visual features, run `wails build` and check the binary; the
  frontend dev server mocks the Go backend, so most UI can be tested in a
  browser first.

## Releases

CI builds on every push to main (Windows, Linux AppImage, macOS) and
produces the release assets.

- Tag and push: `git tag vX.Y.Z && git push origin main --tags`.
- The release body auto-lists commits since the last tag, so write commit
  messages that read as notes.

## License

MIT (see `LICENSE`). Forking or vendoring from other projects? Keep the
license comment and credits in the file you copied.