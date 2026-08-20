# Contributing to glean

Thanks for looking at the source. Here's how to get a working copy on your
machine and how to send changes back.

## Prerequisites

- [Go](https://go.dev/dl/) 1.22 or later
- [Node.js](https://nodejs.org/) 20+
- [Wails v2](https://wails.io/docs/gettingstarted/installation) CLI

Linux contributors also need the webkit2gtk and GTK dev packages:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev
```

Windows and macOS ship everything Wails needs out of the box.

## Getting started

```bash
git clone https://github.com/glean/glean.git
cd glean
wails dev
```

`wails dev` installs frontend dependencies, builds the React app, and starts
the Go backend with hot reload. The window that opens is the live app. Changes
to Go or frontend files rebuild automatically.

## Building for production

```bash
wails build
```

This produces a single binary in `build/bin/`. On Windows that's `glean.exe`,
on Linux a bare binary (or the AppImage if you run the AppImage build step),
and on macOS a `.app` bundle.

## Project layout

```
glean/
  main.go, app.go, app_lifecycle.go
    Go backend entry point and lifecycle hooks.
  workspace.go, setup.go
    File-based note storage and first-run wizard.
  internal/
    Backend modules (sky renderer, wizard helpers, sanitiser).
  frontend/
    React app. src/ holds components and styles.
  packaging/
    App icon, NSIS installer script, Linux .desktop file.
  build/
    Build artifacts and Windows resources (icon, manifest).
  installer/
    A second Wails project that builds the setup wizard
    as a standalone app (builds to build/bin/gleanInstaller.exe).
```

## How storage works

glean writes plain Markdown files into `~/.config/glean/sky/`. Each note is
a `.md` file. Metadata (brightness, adjacency, activity) lives in JSON files
alongside them. Nothing is compressed or encrypted. If you want to back up
your notes, copy that folder.

## Commit messages

The repo uses conventional commits. The format is:

```
type(scope): short description
```

Types you'll see in the log:

| Type | When to use |
|------|-------------|
| `feat` | New feature or user-facing behavior |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build, CI, dependency, or tooling change |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no logic change |

Scopes are lowercase and match the area of the codebase: `ui`, `ci`,
`store`, `workspace`, `wizard`, `sky`, `editor`, `konva`, `featin`,
and so on. Keep the description under 72 characters, imperative mood,
no period at the end.

Examples from the existing log:

```
feat(sky): full-screen sky mode over the workspace
fix(ci): update webkit2gtk package and macOS artifact path
chore: regenerate wails bindings for workspace methods
```

## Submitting a change

1. Fork the repo and create a branch off `main`.
2. Make your changes. Run `wails dev` to test locally.
3. If you touched Go code, run `go vet ./...` to catch obvious issues.
4. Commit with a conventional commit message.
5. Push and open a pull request against `main`.

Keep PRs focused. One logical change per PR is easier to review than a
branch that mixes a refactor with a new feature.

## What counts as "done"

A change is done when:

- It builds without errors on your platform.
- It doesn't break existing behavior (unless that behavior was the bug).
- The commit message explains *why* the change exists, not just what changed.

If your change adds a new note format, a new sky behavior, or touches the
file storage layer, mention that in the PR description. Reviewers will want
to understand the blast radius.

## Code style

- Go: follow `gofmt`. No need for a linter; the formatter handles it.
- TypeScript/React: the frontend uses Prettier with the config in
  `frontend/package.json`. Run `npm run format` before committing if you
  aren't sure.
- Keep imports sorted. Go groups stdlib, then external, then internal.
  Frontend groups React, then third-party, then local.

## Reporting bugs

Open an issue with:

- What you expected to happen.
- What actually happened.
- Your OS and glean version (or commit hash if you're building from source).

If the bug involves note data, attach the relevant `.md` file from
`~/.config/glean/sky/` (or paste its contents). The devs can't reproduce
what they can't see.

## License

By contributing, you agree that your contributions will be licensed under
the [GNU General Public License v3.0](../LICENSE).
