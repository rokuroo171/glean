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
app.go           wails-only surface: window sizing, native folder picker
bindings.go      pass-through bindings to the core service
setup.go         first-run setup and sky adoption bindings
workspace.go     tab state bindings
internal/
  core/          platform-neutral sky service: notes, links, stats,
                 folders, preferences, import/export. The desktop app
                 and future mobile builds share this package
  store/         all persistence (JSON) and config paths
  note/          note model and collection
  wikilink/      [[Title]] and [text](Target.md) link extraction
  adjacency/     link graph, what constellation edges are drawn from
  world/         note placement in the sky
  growth/        star stage (brightness) from visits
  activity/      visits, streaks, stats
  ambient/       time/season palette: aurora, meteor showers, sky tint
  cli/           subcommands (quick, list, export, import)
installer/       C# Installer.cs + Uninstaller.cs (Windows only)
frontend/src/
  App.jsx        root: tabs, provider wiring, command center
  components/    every view: Home, Constellation, EditorPane,
                 FileExplorer, CustomizationPane, OnboardingTour, ...
  components/    CM6Editor.jsx: the React bridge to the CodeMirror 6
                 editor; EditorPane wraps it with toolbar, outline,
                 find, and autosave
  lib/cm6/       the editor itself: editor.js (spine: createEditor,
                 loadMarkdown, emitMarkdown, compartments), blocks.js
                 (block styling), reveal.js (caret-gated syntax reveal),
                 keymaps.js (pairs, headings, format toggles),
                 widgets.js (checkboxes, alerts, fence chips, math,
                 mermaid), starline.js, links.js, highlight.js,
                 images.js, footnotes.js, tables.js, html.js
  lib/           theme.js (color tokens), apply-theme.js (presets),
                 markdown.jsx (react-markdown pipeline for the read
                 view: alerts, KaTeX, mermaid, prism),
                 preferences-context.jsx (prefs store contract)
  hooks/         useReducedMotion, etc.
  wailsjs/       generated bindings, do not hand-edit
```

## The editor model

The editor is a CodeMirror 6 text buffer. The buffer is the note's
markdown, the same string the file on disk holds; there is no schema, no
serializer, and no raw mode. Everything non-plain-text the user sees is
decoration over the buffer, recomputed as a pure function of document and
selection.

- The buffer is the file while editing. Opening a note and closing it
  without edits must leave the file byte-identical: load paths never
  normalize line endings, trailing whitespace, list markers, or setext
  headings.
- There is no source/raw toggle. Raw markdown is what the buffer already
  is; rendering hides syntax only away from the caret and reveals it as
  dimmed real characters near it.
- Recovery from a bad edit is external: edit the note's .md in any text
  editor and the app rescans the sky folder on window focus.
- One writer. Note body strings change only through editor transactions
  (CM6 dispatch). A feature that rewrites the buffer from outside is a
  design violation, not a shortcut.

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

- The compiled binaries land in `build/bin/gleanInstaller.exe` and
  `build/bin/gleanUninstaller.exe` (the installer embeds the app binary).
- The installer writes `DisplayVersion` to the registry and shows the
  version on its UI - keep the string in sync with the app.
- Compile both with the .NET Framework C# compiler (same invocation the
  CI uses). From the repo root on Windows:

  ```cmd
  set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
  %CSC% /target:winexe /win32icon:packaging\icon.ico /out:build\bin\gleanUninstaller.exe installer\Uninstaller.cs
  %CSC% /target:winexe /win32icon:packaging\icon.ico /resource:build\bin\glean.exe,glean.exe /resource:build\bin\gleanUninstaller.exe,gleanUninstaller.exe /out:build\bin\gleanInstaller.exe installer\Installer.cs
  ```

  (The CI build step adds the WPF references the installer UI needs;
  include them if you get type-not-found errors.)

## Versioning

The version appears in four places - keep them in sync (they all say the
current release):

- `frontend/src/App.jsx` (status bar)
- `frontend/src/components/ManageSky.jsx` (footer)
- `installer/Installer.cs` (UI text + `DisplayVersion` registry value)
- the git tag (vX.Y.Z) that drives the release

We follow semver: minor for features, patch for fixes.

## Testing

- `go build ./...` must pass.
- `cd frontend && npm run build` must pass.
- `go test ./...` covers the store, wikilink, and other pure packages;
  `npx vitest run` covers markdown parsing.
- For visual features, run `wails build` and check the binary; the
  frontend dev server mocks the Go backend, so most UI can be tested in a
  browser first.

## Releases

CI builds on every push to main (Windows, Linux `glean-desktop`, macOS)
and produces the release assets.

- Tag and push: `git tag vX.Y.Z && git push origin main --tags`.
- The release body auto-lists commits since the last tag, so write commit
  messages that read as notes.

## License

GPLv3 (see `LICENSE`). Forking or vendoring from other projects? Keep the
license comment and credits in the file you copied.