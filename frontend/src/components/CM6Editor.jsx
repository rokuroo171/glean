import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { createEditor, loadMarkdown, histState, emitMarkdown, editorTheme, styleCompartment, wrapCompartment, gutterCompartment } from '../lib/cm6/editor'
import { lineNumbers } from '@codemirror/view'
import { starlineTheme } from '../lib/cm6/starline'
import { usePreferences } from '../lib/preferences-context'
import { colors } from '../lib/theme'

// Bridge-compatible with the read view's props so consumers need no
// editor-specific branching: { markdown, onMarkdownChange,
// onSelectionChange, editorInstanceRef, noteNames, onNoteLink }
export default function CM6Editor({
  markdown,
  onMarkdownChange,
  onSelectionChange,
  editorInstanceRef,
  noteNames,
  onNoteLink,
}) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const emitRef = useRef(onMarkdownChange)
  const selRef = useRef(onSelectionChange)
  const namesRef = useRef(noteNames)
  const linkRef = useRef(onNoteLink)
  const loadingRef = useRef(false)
  emitRef.current = onMarkdownChange
  selRef.current = onSelectionChange

  const { prefs } = usePreferences()
  const e = prefs.editor || {}
  namesRef.current = noteNames
  linkRef.current = onNoteLink

  useEffect(() => {
    const view = createEditor({
      parent: hostRef.current,
      markdown: markdown || '',
      wrap: e.word_wrap !== false,
      style: { fontFamily: e.font_family, fontSize: e.font_size, lineHeight: e.line_height, line_numbers: e.line_numbers === true },
      onMarkdownChange: (md) => {
        if (!loadingRef.current) emitRef.current(md)
      },
      onSelectionChange: (_view, sel) => selRef.current(null, sel),
      starline: noteNames || onNoteLink ? {
        getNoteNames: () => namesRef.current,
        onNoteLink: (title, id) => linkRef.current && linkRef.current(title, id),
      } : null,
    })
    viewRef.current = view
    // e2e entry point, dev builds only
    if (import.meta.env.DEV) window.__gleanView = view
    if (editorInstanceRef) {
      editorInstanceRef.current = {
        get view() { return viewRef.current },
        undo: () => viewRef.current && undo(viewRef.current),
        redo: () => viewRef.current && redo(viewRef.current),
        histState: () => viewRef.current ? histState(viewRef.current) : { canUndo: false, canRedo: false },
      }
    }
    return () => {
      view.destroy()
      viewRef.current = null
      if (editorInstanceRef) editorInstanceRef.current = null
    }
    // editor mounts once per note; markdown flows in through the load effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // note body changes that come from outside the editor (note switch, external
  // reload, keep-mine) go through loadMarkdown, outside undo history
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = emitMarkdown(view)
    if ((markdown || '') !== current) loadMarkdown(view, markdown || '')
  }, [markdown])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        styleCompartment.reconfigure(editorTheme(e.font_family, e.font_size, e.line_height)),
        wrapCompartment.reconfigure(e.word_wrap !== false ? EditorView.lineWrapping : []),
        gutterCompartment.reconfigure(e.line_numbers === true ? lineNumbers() : []),
      ],
    })
    if (view.dom) view.dom.spellcheck = e.spell_check_enabled !== false
  }, [e.font_family, e.font_size, e.line_height, e.word_wrap, e.spell_check_enabled, e.line_numbers])

  return (
    <div
      ref={hostRef}
      data-cm6-root
      style={{ height: '100%', width: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    />
  )
}
