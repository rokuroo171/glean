# glean

A notes app where every note is a star. Position, brightness, and the lines
between stars are never authored: they're inferred from what you actually
open, revisit, and dwell on.

## Concept

There are no folders, no tags, no manual links. A note's brightness rises
with visit count. Constellation lines form between notes you tend to open
in the same session. Nothing here is something you set up; it's something
that accumulates.

## Install

Build from source:

```bash
git clone https://github.com/glean/glean.git
cd glean
wails build
```

Produces a native binary per platform: `.exe` on Windows, a binary or
`.AppImage` on Linux, `.app`/`.dmg` on macOS.

## Usage

Launching glean opens **Home**, a starting screen with a greeting, your
recent notes, and your writing streak. From there you enter **Sky**, the
main view, where your notes render as stars you can pan and zoom around.

glean is click-first. Every action, new note, edit, wish, stats, has a
visible button. Stars pass through five brightness stages as visit count rises:

| Stage | Visits |
|-------|--------|
| Faint Speck | 1 |
| Dim Star | 2-4 |
| Steady Star | 5-9 |
| Bright Star | 10-19 |
| Brilliant Star | 20+ |

Opening a note counts as a visit. There's also a manual wish, a small
brightness boost you can trigger once a day, separate from the passive
counting.

### CLI

```bash
to be implemented...
```

## Storage

Three separate JSON files under `~/.config/glean/`:

- `glean.json`, note content
- `activity.json`, streaks and milestones
- `adjacency.json`, the pair-visit counts constellation lines are drawn from

## Stack

- [Go](https://go.dev/), core logic
- [Wails v2](https://wails.io/), binds the Go backend to the frontend and
  compiles to one native binary
- [React](https://react.dev/), frontend
- [react-konva](https://konvajs.org/), renders the sky canvas

## License

MIT