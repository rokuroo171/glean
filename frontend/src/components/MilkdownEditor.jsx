import { useEffect, useRef } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { usePreferences } from '../lib/preferences-context'
import { lineGutterState, setLineGutterState } from '../lib/extensions/lineGutterState'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commandsCtx, parserCtx, remarkStringifyOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm, remarkGFMPlugin } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { $prose } from '@milkdown/kit/utils'
import { serializerCtx } from '@milkdown/core'
import { NodeSelection } from 'prosemirror-state'
import { syntaxReveal } from '../lib/extensions/syntaxReveal'
import { taskCheckbox } from '../lib/extensions/taskCheckbox'
import { codeCopyButton } from '../lib/extensions/codeCopyButton'
import { codeHighlight } from '../lib/extensions/codeHighlight'
import { linkClick } from '../lib/extensions/linkClick'
import { rescueSourceBrs, htmlNodeOverride } from '../lib/extensions/hardBrRescue'
import { footnoteJump } from '../lib/extensions/footnoteJump'
import { footnoteRename } from '../lib/extensions/footnoteRename'
import { alerts } from '../lib/extensions/alerts'
import { mermaidView } from '../lib/extensions/mermaidView'
import { lineGutter } from '../lib/extensions/lineGutter'
import { autoPair } from '../lib/extensions/autoPair'
import { htmlPairs } from '../lib/extensions/htmlPairs'
import { starlineChip } from '../lib/extensions/starlineChip'
import { headingEdit } from '../lib/extensions/headingEdit'
import { wrapSelection } from '../lib/extensions/wrapSelection'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { remarkHighlight, highlightSchema } from '../lib/extensions/highlightMark'
import { math } from '@milkdown/plugin-math'
import 'katex/dist/katex.min.css'
import { colors, danger } from '../lib/theme'

const editorStyles = () => `
  [data-milkdown-root] {
    height: 100%;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .milkdown {
    flex: 1;
    min-height: 0;
    height: 100%;
    width: 100%;
    max-width: 100%;
    overflow-y: auto;
    position: relative;
    padding: 12px 24px;
    color: ${colors.text};
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    background: transparent !important;
    outline: none;
  }
  /* word wrap off: content keeps its natural width and the scroller
     provides horizontal scrolling; wrap on (default) lets it flow */
  .milkdown.glean-nowrap .editor,
  .milkdown.glean-nowrap .editor .ProseMirror {
    white-space: pre !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
    word-break: normal !important;
  }
  .glean-line-gutter {
    position: absolute;
    top: 0;
    left: 0;
    width: 34px;
    padding-right: 8px;
    text-align: right;
    pointer-events: none;
    user-select: none;
    z-index: 1;
    background: transparent;
  }
  .glean-line-gutter span {
    position: absolute;
    right: 8px;
    transform: translateY(0);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: ${colors.textDim};
  }
  .glean-has-gutter .editor {
    padding-left: 40px;
  }
  .milkdown .editor {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: pre-wrap !important;
  }
  .milkdown .editor .ProseMirror {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: pre-wrap !important;
  }
  .milkdown .editor:focus {
    outline: none;
  }
  .milkdown .block-handle,
  .milkdown [data-block-handle],
  .milkdown .drag-handle,
  .milkdown .ProseMirror .block-handle {
    display: none !important;
  }
  .milkdown .ProseMirror:focus {
    outline: none;
  }
  .milkdown .ProseMirror-selectednode {
    outline: none;
  }
  .milkdown h1 { font-size: 2em; font-weight: 700; margin: 1em 0 0.4em; color: ${colors.text}; }
  .milkdown h2 { font-size: 1.6em; font-weight: 700; margin: 0.9em 0 0.4em; color: ${colors.text}; }
  .milkdown h3 { font-size: 1.35em; font-weight: 600; margin: 0.8em 0 0.4em; color: ${colors.text}; }
  .milkdown h4 { font-size: 1.15em; font-weight: 600; margin: 0.7em 0 0.35em; color: ${colors.text}; }
  .milkdown h5 { font-size: 1em; font-weight: 600; margin: 0.7em 0 0.35em; color: ${colors.text}; }
  .milkdown h6 { font-size: 0.9em; font-weight: 600; margin: 0.7em 0 0.35em; color: ${colors.textMuted}; }
  .milkdown p { margin: 0.65em 0; }
  .milkdown ul, .milkdown ol { padding-left: 24px; margin: 0.4em 0; }
  .milkdown li { margin: 0.25em 0; }
  /* every nesting level gets the same smooth round dot */
  .milkdown ul { list-style: none; }
  .milkdown ul > li { position: relative; }
  .milkdown ul > li::before {
    content: '';
    position: absolute;
    left: -13px;
    top: 0.55em;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${colors.textMuted};
  }
  .milkdown blockquote {
    border-left: 3px solid ${colors.border};
    padding-left: 12px;
    color: ${colors.textMuted};
    margin: 0.65em 0;
  }
  .milkdown pre {
    position: relative;
    background: ${colors.textMuted}1a;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.3em 0;
    font-variant-ligatures: none;
  }
  .milkdown pre[data-language]::after {
    content: attr(data-language);
    position: absolute;
    top: 6px;
    right: 36px;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${colors.textDim};
    pointer-events: none;
  }
  /* Syntax colors come from the adaptive prism theme in lib/prism-theme,
     which maps tokens onto the active preset's CSS variables */
  .milkdown pre .glean-code-copy {
    position: absolute;
    top: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: ${colors.bg};
    color: ${colors.textMuted};
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .milkdown pre .glean-code-copy svg {
    display: block;
  }
  .milkdown pre:hover .glean-code-copy,
  .milkdown pre .glean-code-copy:focus-visible {
    opacity: 1;
  }
  .milkdown pre .glean-code-copy:hover {
    color: ${colors.text};
  }
  /* alert callouts: blockquote nodes tagged by the alerts plugin get the
     per-kind tint from data-kind; the raw [!NOTE] marker is hidden while
     the widget shows icon + category name */
  .milkdown blockquote.glean-alert {
    border-left-color: var(--alert-color, #5b9fd4);
    background: color-mix(in srgb, var(--alert-color, #5b9fd4) 7%, transparent);
    border-radius: 0 6px 6px 0;
    color: inherit;
    font-style: normal;
    padding: 8px 14px;
  }
  .milkdown blockquote.glean-alert[data-kind="note"] { --alert-color: #5b9fd4; }
  .milkdown blockquote.glean-alert[data-kind="tip"] { --alert-color: #56b87a; }
  .milkdown blockquote.glean-alert[data-kind="important"] { --alert-color: #8b7cf6; }
  .milkdown blockquote.glean-alert[data-kind="warning"] { --alert-color: #d99a3d; }
  .milkdown blockquote.glean-alert[data-kind="caution"] { --alert-color: #db4c40; }
  .milkdown .glean-alert-marker {
    /* opacity, not display:none: the caret must traverse the marker text */
    opacity: 0;
  }
  .milkdown .glean-alert-marker-active {
    opacity: 1;
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
    color: ${colors.textDim};
  }
  .milkdown .glean-alert-head {
    display: block;
    margin-bottom: 4px;
  }
  .milkdown .glean-alert-head > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .milkdown .glean-alert-head svg {
    display: block;
  }
  .milkdown .glean-mermaid {
    margin: 8px 0;
    padding: 10px;
    background: ${colors.bgElevated};
    border: 1px solid ${colors.border};
    border-radius: 6px;
    text-align: center;
  }
  .milkdown .glean-mermaid svg {
    max-width: 100%;
    height: auto;
  }
  .milkdown .glean-mermaid.has-error {
    border: 1px solid ${danger}59;
    background: ${danger}14;
    color: ${colors.textMuted};
    font-size: 12px;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    text-align: left;
    padding: 10px 14px;
  }
  .milkdown mark {
    background: ${colors.accentWarm}47;
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
  }
  .milkdown code {
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.92em;
  }
  .milkdown :not(pre) > code {
    background: ${colors.textMuted}2e;
    border-radius: 4px;
    padding: 0.5px 4px;
  }
  .milkdown dl[data-type="footnote_definition"] {
    margin: 0.35em 0;
    padding-left: 0;
    border-left: 2px solid ${colors.border};
    padding-left: 10px;
  }
  .milkdown dl[data-type="footnote_definition"] dt {
    display: inline;
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
    color: ${colors.textMuted};
    margin-right: 0.5em;
  }
  .milkdown dl[data-type="footnote_definition"] dd {
    display: inline;
    margin-left: 0;
  }
  .milkdown dl[data-type="footnote_definition"] dd p {
    display: inline;
    margin: 0;
  }
  .milkdown sup[data-type="footnote_reference"] {
    cursor: pointer;
    color: ${colors.accent};
    font-size: 0.72em;
    padding: 0 1px;
  }
  .milkdown sup[data-type="footnote_reference"]:hover {
    text-decoration: underline;
  }
  .milkdown a { color: ${colors.accent}; text-decoration: none; cursor: pointer; }
  .milkdown a:hover { text-decoration: underline; }
  /* html comments render as dim inline chips, their raw form is the
     render; font-size 0 hid them entirely, which made them undiscoverable
     and impossible to select or delete by sight */
  .milkdown span[data-comment] {
    font-size: 0.75em;
    line-height: inherit;
    font-family: ui-monospace, monospace;
    color: ${colors.textDim};
    background: ${colors.textMuted}2e;
    border-radius: 3px;
    padding: 0 3px;
    margin: 0 1px;
  }
  .milkdown span[data-comment].ProseMirror-selectednode {
    color: ${colors.text};
    background: ${colors.accent}2e;
    outline: 1px solid ${colors.accent};
  }
  .milkdown img.glean-img-selected::before {
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 0.75em;
    color: ${colors.textDim};
    margin-bottom: 2px;
    user-select: none;
    content: attr(data-glean-raw);
  }
  /* A caret inside a footnote definition wraps the dt label in its raw
     syntax; the label itself comes from data-label */
  .milkdown dl[data-type="footnote_definition"].glean-fn-def-active dt::before {
    content: '[^';
  }
  .milkdown dl[data-type="footnote_definition"].glean-fn-def-active dt::after {
    content: ']: ';
  }
  .glean-fn-rename {
    display: inline-flex;
    margin: 0 4px;
  }
  .glean-fn-rename input {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: ${colors.text};
    background: ${colors.bg};
    border: 1px solid ${colors.accent};
    border-radius: 4px;
    padding: 1px 6px;
    outline: none;
    width: 12ch;
  }
  .milkdown span[data-html-open], .milkdown span[data-html-close] {
    display: inline-flex;
    align-items: center;
    font-family: ui-monospace, monospace;
    font-size: 0.75em;
    color: ${colors.textMuted};
    background: ${colors.textMuted}2e;
    border-radius: 3px;
    padding: 0 3px;
    margin: 0 1px;
  }
  .milkdown span[data-html-open]::before { content: "<" attr(data-html-open) ">"; }
  .milkdown span[data-html-close]::before { content: "</" attr(data-html-close) ">"; }
  /* Real element styling for html pair content; the raw chips stay visible
     around it, and the pairs plugin finds them caret-independently. Mirrors
     the read view's styling for the same tags */
  .milkdown .glean-html-sub {
    vertical-align: sub;
    font-size: 0.75em;
  }
  .milkdown .glean-html-sup {
    vertical-align: super;
    font-size: 0.75em;
  }
  .milkdown .glean-html-strong { font-weight: 700; }
  .milkdown .glean-html-em { font-style: italic; }
  .milkdown .glean-html-ins, .milkdown .glean-html-u { text-decoration: underline; }
  .milkdown .glean-html-mark {
    background: ${colors.accentWarm}4d;
    color: inherit;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .milkdown .glean-html-kbd {
    display: inline-block;
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
    color: ${colors.text};
    background: ${colors.bgElevated};
    border: 1px solid ${colors.border};
    border-radius: 3px;
    box-shadow: 0 1px 0 ${colors.border};
  }
  /* Entering a sub/sup html pair (caret inside, or a chip selected) reveals
     the whole raw region as one unit; plain when the caret is elsewhere */
  .milkdown .glean-html-pair-selected {
    background: ${colors.accent}1a;
    outline: 1px solid ${colors.accent};
    border-radius: 3px;
  }
  .milkdown hr {
    border: none;
    border-top: 1px solid ${colors.borderStrong};
    margin: 0.5em 0;
  }
  /* Clicking a rule reveals its raw --- above it, matching the
     caret-revealed syntax marks elsewhere; hidden when deselected */
  .milkdown hr.glean-hr-selected::before {
    content: '---';
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 0.75em;
    color: ${colors.textDim};
    margin-bottom: 2px;
    user-select: none;
  }
  .milkdown table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.3em 0;
  }
  .milkdown th, .milkdown td {
    border: 1px solid ${colors.border};
    padding: 6px 10px;
    text-align: left;
  }
  .milkdown th {
    background: ${colors.accent}1f;
    font-weight: 600;
  }
  .milkdown img { max-width: 100%; border-radius: 4px; }
  .milkdown .footnotes { font-size: 0.9em; color: ${colors.textMuted}; }
  .milkdown li[data-item-type="task"] {
    list-style: none;
  }
  .milkdown .glean-taskbox {
    display: inline-flex;
    align-items: center;
    margin-right: 0.4em;
    vertical-align: text-bottom;
  }
  .milkdown .glean-taskbox [role="checkbox"] {
    cursor: pointer;
    border-radius: 6px;
    outline: none;
  }
  .milkdown .glean-taskbox [role="checkbox"]:focus-visible {
    box-shadow: 0 0 0 2px ${colors.accent}40;
  }
  .milkdown li[data-item-type="task"][data-checked="true"] > p {
    text-decoration: line-through;
    text-decoration-color: ${colors.textDim};
    color: ${colors.textMuted};
  }
  /* tight lists collapse paragraph gaps, loose lists keep the base margin */
  .milkdown ol[data-spread="false"] > li > p,
  .milkdown ul[data-spread="false"] > li > p {
    margin: 0.15em 0;
  }
  .milkdown strong { font-weight: 700; }
  .milkdown em { font-style: italic; }
  .milkdown del { text-decoration: line-through; opacity: 0.75; }
  .glean-syntax-mark {
    color: ${colors.textDim};
    font-weight: 400;
    font-style: normal;
    text-decoration: none;
    user-select: none;
  }
  .milkdown .glean-fence-open {
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.8em;
    margin-right: 2px;
  }
  .milkdown .glean-fence-lang {
    color: ${colors.accent};
    outline: none;
    min-width: 0.5em;
    min-height: 1em;
    display: inline-block;
    margin-left: 2px;
    margin-right: 6px;
    padding: 0 2px;
    border-bottom: 1px dashed ${colors.border};
  }
  .milkdown .glean-fence-lang:focus {
    border-bottom-color: ${colors.accent};
  }
  li.glean-list-reveal {
    list-style: none;
  }
  li.glean-list-reveal::marker {
    content: '';
  }
  .milkdown li.glean-list-reveal::before {
    content: none;
  }
  .milkdown button.glean-starline {
    font: inherit;
    color: ${colors.accent};
    background: ${colors.bgCard};
    border: 1px solid ${colors.borderStrong};
    border-radius: 6px;
    padding: 0 6px;
    margin: 0 1px;
    cursor: pointer;
    line-height: 1.5;
  }
  .milkdown button.glean-starline:hover {
    border-color: ${colors.accent};
  }
  .milkdown button.glean-starline.missing {
    color: ${colors.accentWarm};
    border-style: dashed;
  }
  .milkdown .glean-starline-raw {
    color: ${colors.textMuted};
  }
`

function EditorInner({ markdown, onMarkdownChange, onSelectionChange, editorInstanceRef, noteNames, onNoteLink }) {
  const markdownRef = useRef(markdown)
  markdownRef.current = markdown
  const lastEmittedRef = useRef(null)
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  // the editor builds once per note; props reach its plugins through these
  // refs so a renamed or created note re-renders chips without a rebuild
  const starlineRefs = useRef(null)
  if (!starlineRefs.current) {
    starlineRefs.current = { noteNamesRef: { current: noteNames }, onNoteLinkRef: { current: onNoteLink } }
  }
  starlineRefs.current.noteNamesRef.current = noteNames
  starlineRefs.current.onNoteLinkRef.current = onNoteLink

  // Editor-wide prefs: the gutter plugin reads the shared mutable state on
  // every repaint, so toggles never rebuild the editor
  const { prefs } = usePreferences()
  const editor = prefs.editor
  useEffect(() => {
    setLineGutterState({ enabled: editor.line_numbers === true, wrap: editor.word_wrap !== false })
    lineGutterState.api?.refresh()
  }, [editor.line_numbers, editor.word_wrap])

  const { get, loading } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, rescueSourceBrs(markdownRef.current || ''))
        // emit the dash bullet the author typed instead of remark's asterisk
        // default, so saves stop rewriting every list in the file
        ctx.update(remarkStringifyOptionsCtx, (opts) => ({ ...opts, bullet: '-' }))
        // strict GFM strikethrough: single tildes stay literal like Typora and
        // Obsidian, so H~2~O renders as typed and saves stop rewriting it to
        // the nonstandard H~~2~~O
        ctx.set(remarkGFMPlugin.options.key, { singleTilde: false })
        ctx.get(listenerCtx).markdownUpdated((_, md) => {
          lastEmittedRef.current = md
          onMarkdownChange(md)
        })
        ctx.get(listenerCtx).selectionUpdated((ctx, selection) => {
          if (onSelectionChangeRef.current) onSelectionChangeRef.current(ctx, selection)
        })
      })
      // headingEdit before commonmark: its Backspace-at-start demote must win
      // over the stock keymap's joinBackward, which would merge the heading into
      // the block above instead of stepping its level down
      .use($prose(headingEdit))
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use($prose(syntaxReveal))
      .use($prose(taskCheckbox))
      .use($prose(codeCopyButton))
      .use($prose(codeHighlight))
      .use($prose(linkClick))
      .use(htmlNodeOverride)
      .use($prose(footnoteJump))
      .use($prose(footnoteRename))
      .use($prose(alerts))
      .use($prose(mermaidView))
      .use(remarkHighlight)
      .use(highlightSchema)
      .use($prose(() => lineGutter({ state: lineGutterState })))
      .use($prose(autoPair))
      .use($prose(htmlPairs))
      .use($prose(() => starlineChip(starlineRefs.current)))
      .use($prose(wrapSelection))
      .use(trailing)
      .use(math)
  }, [])

  useEffect(() => {
    if (!get || loading) return
    const ed = get()
    if (!ed) return
    editorInstanceRef.current = { get }
  }, [get, loading, editorInstanceRef])

  // Push external markdown (async body load, note switch) into the editor
  // Skips when the editor itself emitted the value, so typing never fights
  // the parent state
  useEffect(() => {
    if (loading || !get) return
    const editor = get()
    if (!editor) return
    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx))
      // e2e entry points, dev builds only
      if (import.meta.env.DEV) {
        window.__gleanView = view
        window.__gleanParse = editor.action((ctx) => ctx.get(parserCtx))
        window.__gleanSerialize = (doc) => editor.action((ctx) => ctx.get(serializerCtx)(doc))
        window.__gleanNodeSelection = NodeSelection
      }
    } catch (_) {}
    if (markdown === lastEmittedRef.current) return
    lastEmittedRef.current = markdown
    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx))
      const parse = editor.action((ctx) => ctx.get(parserCtx))
      const doc = parse(rescueSourceBrs(markdown || ''))
      // addToHistory false keeps note loading out of the undo stack, so
      // Ctrl+Z after an open reverts the last edit, not the whole note
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
        .setMeta('addToHistory', false))
    } catch (e) {
      console.warn('Milkdown sync failed:', e)
    }
  }, [markdown, get, loading])

  return <Milkdown />
}

export default function MilkdownEditor({ markdown, onMarkdownChange, onSelectionChange, editorInstanceRef, noteNames, onNoteLink }) {
  return (
    <MilkdownProvider>
      <style>{editorStyles()}</style>
      <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <EditorInner
          markdown={markdown}
          onMarkdownChange={onMarkdownChange}
          onSelectionChange={onSelectionChange}
          editorInstanceRef={editorInstanceRef}
          noteNames={noteNames}
          onNoteLink={onNoteLink}
        />
      </div>
    </MilkdownProvider>
  )
}

export function useMilkdownCommands(editorInstanceRef) {
  const getEditor = () => editorInstanceRef.current?.get?.() || null

  const dispatchCommand = (commandKey, ...args) => {
    const editor = getEditor()
    if (!editor) return
    try {
      editor.action((ctx) => ctx.get(commandsCtx).call(commandKey, ...args))
    } catch (e) {
      console.warn('Milkdown command failed:', commandKey, e)
    }
  }

  const getView = () => {
    const editor = getEditor()
    if (!editor) return null
    try {
      return editor.action((ctx) => ctx.get(editorViewCtx))
    } catch {
      return null
    }
  }

  const getMarkdown = () => {
    const view = getView()
    if (!view) return ''
    return view.state.doc.textContent
  }

  return { dispatchCommand, getView, getMarkdown }
}