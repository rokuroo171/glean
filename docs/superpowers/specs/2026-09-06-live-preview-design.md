# glean live preview design

Date: 2026-09-06
Status: approved, awaiting implementation
Scope: v2.0.0 editor rewrite, CodeMirror 6 based live preview

Supersedes: the editor section of the 1.0 design, which rejected live preview for 1.0. The 1.0 rejection stands for 1.0; v2.0.0 is where it lands.

## Context

glean is a Wails v2 desktop app: Go backend bound straight to a React frontend. The editor is a raw textarea with three modes, edit, split, and preview. Split mode and the preview pane have carried bugs since they shipped: keyboard shortcuts fail, scroll sync drifts, the animated typing overlay mispositions. The custom undo/redo stack has needed repeated patches and still misbehaves. The 1.0 design deferred live preview on purpose. v2.0.0 is the release that fixes the editor by replacing it.

## Goal

One editor. Markdown renders as rich content while you type, Obsidian live preview style. Click a rendered element and the cursor lands in its source. Split mode and the separate preview pane are deleted. Undo and redo work, forever, because CodeMirror 6 owns the history.

## Engine choice

CodeMirror 6. MIT licensed. Obsidian's own live preview runs on it, so the foundation is proven for exactly this job. We write our own implementation: markdown parsing, decoration building, and glean's personality effects as CM6 extensions. No copied Obsidian code, no copied look.

New dependencies, all MIT:

- @codemirror/state
- @codemirror/view
- @codemirror/commands
- @codemirror/language
- @codemirror/lang-markdown
- @codemirror/search
- @lezer/highlight

## What is deleted

- The split mode branch in EditorPane: the two-pane layout, proportional scroll sync in both directions, the preview pane refs and handlers
- The preview mode branch and the react-markdown render path in the editor
- react-markdown and remark-gfm, once nothing else imports them
- The custom undo/redo stack: pushHistory, flushHistory, pushImmediate, isUndoRedoRef, and the related debounce. CM6 history replaces all of it
- The custom line number gutter and its scroll sync. CM6 lineNumbers extension replaces it, same toggle
- The mode toggle UI (edit | split | preview). One editor, no modes

editorMode state in Workspace and the mode prop on EditorPane go with it. StatusBar's showCursor prop drops its mode check.

## What stays, reworked

- Cursor trail: the canvas overlay stays. Cursor position now reads from CM6 view coords instead of textarea offset math
- Animated typing: reworked as transient CM6 decorations. Inserted ranges get a fade or shimmer via decoration updates; the sparkle canvas stays, positioned from CM6 coords
- Find and replace: CM6 search addon, restyled to match glean tokens, same Ctrl+F and Ctrl+H bindings and the same context menu entry
- Smart backspace and tab width: CM6 keymaps
- Link popup, breadcrumbs, outline: unchanged, re-anchored to CM6
- onBodyChange, autosave debounce, activity tracking, save state in the status bar: unchanged wiring

## Architecture

EditorPane keeps its React shell: title bar, breadcrumbs, outline, find bar, status wiring. The textarea is replaced by a CM6 EditorView mounted in a ref div.

The editor view lives in one module, frontend/src/lib/editor.js, exported as a factory:

- buildEditorState(doc, prefs, callbacks): EditorState with the markdown language, history, keymaps, search, line numbers per prefs, and the glean extensions
- createEditorView(parent, state): mounts the view, wires the update listener
- The glean extensions live in frontend/src/lib/extensions/: livePreview.js, animatedTyping.js, sparkles.js, cursorTrail.js, keymaps.js

Live preview rendering, the core piece:

- A decoration builder runs on every doc change, debounced to the animation frame
- Inline marks: bold, italic, strikethrough, code, links render as styled marks
- Block elements: headings, lists, blockquotes, code fences, task checkboxes render as styled block decorations or widgets
- Task checkboxes render as clickable widgets that toggle the markdown source
- Tables, images, and math render as styled placeholders in v2.0.0, full rendering later
- Clicking inside a rendered range places the cursor in the source text underneath, CM6 handles the mapping

Note switching:

- The EditorView stays mounted per note session. Switching notes dispatches a doc change instead of remounting, so undo history and cursor survive tab switches
- Opening a fresh note creates a new session and destroys the old view

## Scope guard

v2.0.0 ships rich rendering for headings, bold, italic, strikethrough, code, links, lists, blockquotes, code fences, and task checkboxes. Tables, embeds, and math show styled placeholders first. Full fidelity for everything is a multi-release effort and is not in v2.0.0.

## Version

Bump to 2.0.0 in frontend/src/App.jsx and frontend/src/components/ManageSky.jsx. Those are the two user-visible version strings. wails.json carries no version field.

## Testing

- Vitest unit tests for the live preview decoration builder: heading detection, inline marks, task checkbox toggling, click to source mapping
- Vitest tests for the glean keymaps: smart backspace, tab width
- History behavior is CM6's, tested by CM6 itself, no custom tests needed
- wails build after every change, per project rule. Frontend build alone is not enough, wails build runs it

## Out of scope

- Tables, embeds, math full rendering
- Multi-cursor
- Drag and drop reordering
- Vim mode
- Backlinks panel (separate roadmap item, own spec)
- glean stats CLI output (separate roadmap item, own spec)

## Open before implementation

- Whether task checkbox widgets need custom styling beyond the existing theme tokens
- Whether the sparkle canvas stays a single fixed layer or moves inside the editor scroller
- Exact CM6 minor versions pinned at install time