import { useEffect, useRef } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commandsCtx, parserCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { $prose } from '@milkdown/kit/utils'
import { syntaxReveal } from '../lib/extensions/syntaxReveal'

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
  .milkdown h1 { font-size: 1.7em; font-weight: 700; margin: 0.5em 0 0.3em; color: #e6edf3; }
  .milkdown h2 { font-size: 1.45em; font-weight: 700; margin: 0.5em 0 0.3em; color: #e6edf3; }
  .milkdown h3 { font-size: 1.25em; font-weight: 600; margin: 0.5em 0 0.3em; color: #e6edf3; }
  .milkdown h4 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.3em; color: #e6edf3; }
  .milkdown h5 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.3em; color: #e6edf3; }
  .milkdown h6 { font-size: 0.9em; font-weight: 600; margin: 0.5em 0 0.3em; color: #8b949e; }
  .milkdown p { margin: 0.3em 0; }
  .milkdown ul, .milkdown ol { padding-left: 24px; margin: 0.3em 0; }
  .milkdown li { margin: 0.15em 0; }
  .milkdown blockquote {
    border-left: 3px solid #3d4450;
    padding-left: 12px;
    color: #8b949e;
    margin: 0.3em 0;
  }
  .milkdown pre {
    background: rgba(90, 106, 122, 0.1);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.3em 0;
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
  .milkdown a { color: #58a6ff; text-decoration: none; }
  .milkdown a:hover { text-decoration: underline; }
  .milkdown hr {
    border: none;
    border-top: 1px solid rgba(90, 106, 122, 0.3);
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
  .milkdown .task-list-item { list-style: none; margin-left: -1.5em; }
  .milkdown .task-list-item input[type="checkbox"] { margin-right: 0.5em; accent-color: #58a6ff; }
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
        ctx.set(defaultValueCtx, markdownRef.current || '')
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
      const doc = parse(markdown || '')
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content))
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