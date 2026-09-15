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
    display: none;
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
  /* html comments collapse to nothing unless the node is selected */
  .milkdown span[data-comment] {
    font-size: 0;
    line-height: 0;
    font-family: ui-monospace, monospace;
    color: ${colors.textDim};
  }
  .milkdown span[data-comment].ProseMirror-selectednode {
    font-size: 0.75em;
    line-height: inherit;
    font-family: ui-monospace, monospace;
    color: ${colors.textMuted};
    background: ${colors.textMuted}2e;
    border-radius: 3px;
    padding: 0 3px;
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
  .milkdown span[data-html-open]::before { content: attr(data-html-open); }
  .milkdown span[data-html-close]::before { content: attr(data-html-close); }
  .milkdown span[data-html-open="sub"] + span[data-html-close="sub"],
  .milkdown span[data-html-open="sup"] + span[data-html-close="sup"] { display: inline; }
  .milkdown span[data-html-open="sub"] ~ sub,
  .milkdown span[data-html-open="sup"] ~ sup { display: none; }
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
    margin-right: 0.5em;
    vertical-align: text-bottom;
  }
  .milkdown .glean-taskbox input[type="checkbox"] {
    width: 13px;
    height: 13px;
    accent-color: ${colors.accent};
    cursor: pointer;
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
  li.glean-list-reveal {
    list-style: none;
  }
  li.glean-list-reveal::marker {
    content: '';
  }
  .milkdown li.glean-list-reveal::before {
    content: none;
  }
`

function EditorInner({ markdown, onMarkdownChange, onSelectionChange, editorInstanceRef }) {
  const markdownRef = useRef(markdown)
  markdownRef.current = markdown
  const lastEmittedRef = useRef(null)
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange

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

export default function MilkdownEditor({ markdown, onMarkdownChange, onSelectionChange, editorInstanceRef }) {
  return (
    <MilkdownProvider>
      <style>{editorStyles()}</style>
      <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <EditorInner
          markdown={markdown}
          onMarkdownChange={onMarkdownChange}
          onSelectionChange={onSelectionChange}
          editorInstanceRef={editorInstanceRef}
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