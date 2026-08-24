<p align="center">
  <img src="docs/gleanIcon.png" alt="glean" width="128" />
</p>

<h1 align="center">glean</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3" /></a>
</p>

<p align="center">
  A notes app where every note is a star. Position, brightness, and the lines
  between stars are never authored: they're inferred from what you actually
  open, revisit, and dwell on.
</p>

## Concept

There are no folders, no tags, no manual links. A note's brightness rises
with visit count. Constellation lines form between notes you tend to open
in the same session. Nothing here is something you set up; it's something
that accumulates.

## Features

- **Home** - a starting screen with a greeting, your recent notes, and your
  writing streak
- **Sky** - notes rendered as stars you can pan, zoom, and expand into a
  full-sky view
- **Customization pane** - theme presets, accent colors, editor settings
  (spelling squiggles, cursor trail with beam/sparkle/ink styles and
  physics knobs), layout density
- **Tabs** - notes open in tabs with a smooth close animation
- **Ctrl+K** - command center: search, new note, replay the onboarding
  tour, and more
- **Custom tooltips** - a portal-based tooltip layer replaces native
  browser tooltips app-wide
- **Sky overview** - writing streak, activity stats, milestones

## Install

Prebuilt installers are attached to every GitHub release:

- Windows: `gleanInstaller.exe` (custom C# installer + `gleanUninstaller.exe`)
- Linux: `glean-desktop` (single self-extracting file, installs to `~/.local/bin` then launches)
- macOS: `.app`/`.dmg`

Build from source:

```bash
git clone https://github.com/glean/glean.git
cd glean
wails build
```

This produces a native binary per platform: `.exe` on Windows, a plain
binary on Linux, `.app`/`.dmg` on macOS. The Windows installer and
uninstaller are separate C# programs under `installer/` - see
`build/bin/Installer&UninstallerCompileGuide.txt` for the exact compile
commands, or `CONTRIBUTING.md` for the full build workflow.

## Usage

Launching glean opens **Home**. From there you enter **Sky**, the main view,
where your notes render as stars you can pan and zoom around.

glean is click-first. Every action, new note, edit, wish, stats, has a
visible button. Stars shine through five brightness stages as visit count
rises:

| Stage | Visits |
|-------|--------|
| Faint Speck | 1 |
| Dim Star | 2-4 |
| Steady Star | 5-9 |
| Bright Star | 10-19 |
| Brilliant Star | 20+ |

Opening a note counts as a visit to it. A wish is a small brightness boost
you can give a star once a day, separate from the passive counting.

### CLI

The same binary doubles as a small command-line tool (primary on Linux and
macOS, where the app is placed on `PATH` by a package manager or a symlink).
Passing any argument skips the GUI and dispatches a subcommand:

```bash
glean quick "call the dentist"   # create a note from text instantly
glean list                       # list notes with their brightness stage
glean export <note-id>          # write one note's body to <title>.md
glean import <folder>           # import every .md in a folder as notes
glean -h, --help                 # show usage
```

`glean quick` is the capture flow for terminal people; `glean import` is a
convenient migration path from another markdown app.

## Storage

Each **sky** is a plain folder (default `~/Documents/glean/<sky-name>`).
Everything glean knows about a sky lives in a `.glean/` sidecar inside it,
so the folder stays portable, syncable, and inspectable:

- `notes.json` - note metadata
- note bodies as `.md` files
- `stats.json` - visits, streaks, activity
- `trails.json` - pair-visit counts, what constellation lines are drawn from
- `sky.json` - the sky's name

App-wide settings (preferences, known skies) live in the platform config
directory: `%APPDATA%\glean` on Windows, `~/.config/glean` elsewhere.

## Contributing

See `CONTRIBUTING.md` for the build workflow, architecture map, and code
style conventions.

## License

[GPL-3.0](LICENSE)