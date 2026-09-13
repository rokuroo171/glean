import { useEffect, useRef } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
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
import { alerts } from '../lib/extensions/alerts'
import { mermaidView } from '../lib/extensions/mermaidView'
import { math } from '@milkdown/plugin-math'
import 'katex/dist/katex.min.css'

const editorStyles = `
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
    padding: 12px 24px;
    color: #c8d6e0;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    background: transparent !important;
    outline: none;
    box-sizing: border-box;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    margin: 0;
  }
  .milkdown .editor {
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    border-radius: 0 !important;
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
  .milkdown h1 { font-size: 2em; font-weight: 700; margin: 1em 0 0.4em; color: #e6edf3; }
  .milkdown h2 { font-size: 1.6em; font-weight: 700; margin: 0.9em 0 0.4em; color: #e6edf3; }
  .milkdown h3 { font-size: 1.35em; font-weight: 600; margin: 0.8em 0 0.4em; color: #e6edf3; }
  .milkdown h4 { font-size: 1.15em; font-weight: 600; margin: 0.7em 0 0.35em; color: #e6edf3; }
  .milkdown h5 { font-size: 1em; font-weight: 600; margin: 0.7em 0 0.35em; color: #e6edf3; }
  .milkdown h6 { font-size: 0.9em; font-weight: 600; margin: 0.7em 0 0.35em; color: #8b949e; }
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
    background: #8b949e;
  }
  .milkdown blockquote {
    border-left: 3px solid #3d4450;
    padding-left: 12px;
    color: #8b949e;
    margin: 0.65em 0;
  }
  .milkdown pre {
    position: relative;
    background: rgba(90, 106, 122, 0.1);
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
    color: rgba(139, 148, 158, 0.7);
    pointer-events: none;
  }
  .milkdown pre .token.comment { color: #8b949e; font-style: italic; }
  .milkdown pre .token.keyword { color: #ff7b72; }
  .milkdown pre .token.string { color: #a5d6ff; }
  .milkdown pre .token.function { color: #d2a8ff; }
  .milkdown pre .token.number,
  .milkdown pre .token.boolean { color: #79c0ff; }
  .milkdown pre .token.operator { color: #ff7b72; }
  .milkdown pre .token.punctuation { color: #c8d6e0; }
  .milkdown pre .token.class-name,
  .milkdown pre .token.builtin { color: #ffa657; }
  .milkdown pre .token.property { color: #79c0ff; }
  .milkdown pre .token.attr-name { color: #ffa657; }
  .milkdown pre .token.attr-value { color: #a5d6ff; }
  .milkdown pre .token.deleted { color: #ffa198; }
  .milkdown pre .token.inserted { color: #7ee787; }
  .milkdown pre .token.tag { color: #7ee787; }
  .milkdown pre .token.selector { color: #7ee787; }
  .milkdown pre .token.regex,
  .milkdown pre .token.important { color: #ffa657; }
  .milkdown pre .token.url { color: #a5d6ff; }
  .milkdown pre .token.entity { color: #ffa657; }
  .milkdown pre .token.constant,
  .milkdown pre .token.symbol { color: #79c0ff; }
  .milkdown pre .token.variable { color: #ffa657; }
  .milkdown pre .token.prolog,
  .milkdown pre .token.doctype,
  .milkdown pre .token.cdata { color: #8b949e; }
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
    background: rgba(11, 15, 25, 0.55);
    color: #8b949e;
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
    color: #c8d6e0;
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
    background: #0d1117;
    border: 1px solid rgba(180, 140, 80, 0.12);
    border-radius: 6px;
    text-align: center;
  }
  .milkdown .glean-mermaid svg {
    max-width: 100%;
    height: auto;
  }
  .milkdown .glean-mermaid.has-error {
    border: 1px solid rgba(219, 76, 64, 0.35);
    background: rgba(219, 76, 64, 0.08);
    color: #8b949e;
    font-size: 12px;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    text-align: left;
    padding: 10px 14px;
  }
  .milkdown code {
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.92em;
  }
  .milkdown :not(pre) > code {
    background: rgba(90, 106, 122, 0.18);
    border-radius: 4px;
    padding: 0.5px 4px;
  }
  .milkdown dl[data-type="footnote_definition"] {
    margin: 0.35em 0;
    padding-left: 0;
    border-left: 2px solid rgba(90, 106, 122, 0.35);
    padding-left: 10px;
  }
  .milkdown dl[data-type="footnote_definition"] dt {
    display: inline;
    font-family: ui-monospace, monospace;
    font-size: 0.8em;
    color: #8b949e;
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
    color: #58a6ff;
    font-size: 0.72em;
    padding: 0 1px;
  }
  .milkdown sup[data-type="footnote_reference"]:hover {
    text-decoration: underline;
  }
  .milkdown a { color: #58a6ff; text-decoration: none; cursor: pointer; }
  .milkdown a:hover { text-decoration: underline; }
  /* html comments collapse to nothing unless the node is selected */
  .milkdown span[data-comment] {
    font-size: 0;
    line-height: 0;
    font-family: ui-monospace, monospace;
    color: rgba(139, 148, 158, 0.7);
  }
  .milkdown span[data-comment].ProseMirror-selectednode {
    font-size: 0.75em;
    line-height: inherit;
    background: rgba(90, 106, 122, 0.18);
    border-radius: 3px;
    padding: 0 3px;
  }
  .milkdown span[data-html-open], .milkdown span[data-html-close] {
    display: inline-flex;
    align-items: center;
    font-family: ui-monospace, monospace;
    font-size: 0.75em;
    color: rgba(139, 148, 158, 0.85);
    background: rgba(90, 106, 122, 0.18);
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
    border-top: 1px solid rgba(90, 106, 122, 0.55);
    margin: 0.5em 0;
  }
  .milkdown table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.3em 0;
  }
  .milkdown th, .milkdown td {
    border: 1px solid #3d4450;
    padding: 6px 10px;
    text-align: left;
  }
  .milkdown th {
    background: rgba(91, 159, 212, 0.12);
    font-weight: 600;
  }
  .milkdown img { max-width: 100%; border-radius: 4px; }
  .milkdown .footnotes { font-size: 0.9em; color: #8b949e; }
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
    accent-color: #58a6ff;
    cursor: pointer;
  }
  .milkdown li[data-item-type="task"][data-checked="true"] > p {
    text-decoration: line-through;
    text-decoration-color: rgba(139, 148, 158, 0.6);
    color: #8b949e;
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
    color: rgba(139, 148, 158, 0.6);
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
      .use($prose(alerts))
      .use($prose(mermaidView))
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
      <style>{editorStyles}</style>
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