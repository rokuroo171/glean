import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import { createGleanView } from '../lib/editor'
import { EditorView } from '@codemirror/view'
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands'
import StarIcon from './StarIcon'
import Icon from './Icon'
import CursorTrail from './CursorTrail'
import ContextMenu from './ContextMenu'
import FindReplace from './FindReplace'

const ANIM_SPARKLE_MS = 450
let _animId = 0

function AnimItem({ a, accent }) {
  return (
    <span style={{
      position: 'absolute', left: a.x, top: a.y,
      width: 4, height: 4, borderRadius: 2,
      background: accent || 'currentColor',
      pointerEvents: 'none', zIndex: 50, opacity: 0,
      animation: `animSparkle ${ANIM_SPARKLE_MS}ms ease-out forwards`,
      '--dx': `${a.dx}px`, '--dy': `${a.dy}px`
    }} />
  )
}

export function parseHeadings(markdown) {
  const out = []
  const lines = markdown.split('\n')
  let offset = 0
  let inFence = false
  let fenceChar = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(/^(\s*`{3,}|~{3,})\s*(.*)/)
    if (fenceMatch) {
      const char = fenceMatch[1].trim()[0]
      if (!inFence) { inFence = true; fenceChar = char }
      else if (char === fenceChar) { inFence = false }
      offset += line.length + 1
      continue
    }
    if (inFence) { offset += line.length + 1; continue }
    const atx = line.match(/^(#{1,6})\s+(.+)/)
    if (atx) {
      out.push({ level: atx[1].length, text: atx[2].replace(/\s+#+\s*$/, ''), offset })
      offset += line.length + 1
      continue
    }
    if (i + 1 < lines.length) {
      const next = lines[i + 1]
      const setextMatch = next.match(/^(=+|-+)\s*$/)
      if (setextMatch && line.trim().length > 0) {
        const underline = setextMatch[1][0]
        if (underline === '=' && line.trim().length > 0) {
          out.push({ level: 1, text: line.trim(), offset })
        } else if (underline === '-' && line.trim().length > 0 && !line.match(/^#{1,6}\s/)) {
          out.push({ level: 2, text: line.trim(), offset })
        }
      }
    }
    offset += line.length + 1
  }
  return out
}

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty,
  linked, onOpenNote, onNewNote, skyName, onCursorChange, noteNames }) {
  function handleNoteLink(title, id) {
    if (id && onOpenNote) { onOpenNote(id); return }
    if (!id && onNewNote) onNewNote(title)
  }
  const { prefs } = usePreferences()
  const editorContainerRef = useRef(null)
  const editorMountRef = useRef(null)
  const viewRef = useRef(null)
  const fileInputRef = useRef(null)
  const [currentHeading, setCurrentHeading] = useState(0)
  const [showFind, setShowFind] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })
  const [viewState, setViewState] = useState(null)
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const [animItems, setAnimItems] = useState([])
  const animTimerRef = useRef(null)
  const lastSparkleRef = useRef(0)
  const editorFont = prefs.editor.font_family || 'monospace'
  const editorFontSize = prefs.editor.font_size || 14
  const editorLineHeight = prefs.editor.line_height || 1.6
  const [linkPopup, setLinkPopup] = useState(null)
  const headings = useMemo(() => parseHeadings(body), [body])
  const debounceRef = useRef(null)
  const flushRef = useRef(null)
  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  function updateLinkPopup(view, cursor) {
    const text = view.state.doc.toString()
    if (!noteNames || Object.keys(noteNames).length === 0) { setLinkPopup(null); return }
    const before = text.slice(0, cursor)
    const openBracket = before.lastIndexOf('[[')
    if (openBracket < 0) { setLinkPopup(null); return }
    const afterOpen = before.slice(openBracket + 2)
    if (afterOpen.includes(']]') || afterOpen.includes('\n')) { setLinkPopup(null); return }
    const query = afterOpen.toLowerCase()
    const matches = Object.keys(noteNames)
      .filter(t => t.toLowerCase().includes(query) && t.toLowerCase() !== text.slice(openBracket + 2, cursor).toLowerCase())
      .slice(0, 8)
    if (matches.length === 0) { setLinkPopup(null); return }
    const coords = view.coordsAtPos(cursor)
    if (!coords) { setLinkPopup(null); return }
    setLinkPopup({ query, index: 0, pos: { top: coords.bottom + 4, left: coords.left } })
  }

  function insertWikilink(title) {
    const view = viewRef.current
    if (!view) return
    const cursor = view.state.selection.main.head
    const text = view.state.doc.toString()
    const openBracket = text.lastIndexOf('[[')
    if (openBracket < 0) return
    const link = `[[${title}]]`
    view.dispatch({ changes: { from: openBracket, to: cursor, insert: link }, selection: { anchor: openBracket + link.length } })
    setLinkPopup(null)
    view.focus()
  }

  useEffect(() => {
    const container = editorMountRef.current
    if (!container) return
    const view = createGleanView({
      parent: container,
      doc: body,
      prefs,
      callbacks: {
        onBodyChange: (newBody) => {
          onBodyChange(newBody)
          setDirty(true)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => flushRef.current(), (prefs.editor.autosave_interval || 3) * 1000)
        },
        onCursorChange: ({ line, col }) => {
          if (onCursorChange) onCursorChange({ line, col })
          const v = viewRef.current
          if (v) updateLinkPopup(v, v.state.selection.main.head)
        },
        save: () => flushRef.current(),
        openFind: () => { setShowFind(true); setShowReplace(false) },
        openReplace: () => { setShowFind(true); setShowReplace(true) },
        openImage: () => fileInputRef.current?.click(),
        onPasteImage: () => {},
        onDropImage: () => {},
        onHistoryChange: () => {
          const v = viewRef.current
          if (v) setHist({ canUndo: undoDepth(v.state) > 0, canRedo: redoDepth(v.state) > 0 })
        },
      },
    })
    viewRef.current = view
    setViewState(view)
    setHist({ canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 })
    return () => { view.destroy(); viewRef.current = null; setViewState(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== body) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: body } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  function jumpTo(offset, index) {
    setCurrentHeading(index)
    const view = viewRef.current
    if (!view) return
    const pos = Math.min(offset, view.state.doc.length)
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
    view.focus()
  }

  const showOutline = headings.length >= 3

  const toolbarBtn = { background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  function dispatchWrap(before, after) {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: before + view.state.sliceDoc(from, to) + after } })
    view.focus()
  }

  function insertQuote() {
    const view = viewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    view.dispatch({ changes: { from: line.from, insert: '> ' } })
    view.focus()
  }

  function insertBulletList() {
    const view = viewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    view.dispatch({ changes: { from: line.from, insert: '- ' } })
    view.focus()
  }

  function insertCodeFence() {
    const view = viewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    view.dispatch({ changes: { from, insert: '```\n\n```' }, selection: { anchor: from + 4 } })
    view.focus()
  }

  const editorMenuItems = [
    { label: 'Bold', action: () => dispatchWrap('**', '**') },
    { label: 'Italic', action: () => dispatchWrap('*', '*') },
    { label: 'Strikethrough', action: () => dispatchWrap('~~', '~~') },
    { label: 'Inline code', action: () => dispatchWrap('`', '`') },
    { label: 'Blockquote', action: insertQuote },
    { label: 'Bullet list', action: insertBulletList },
    { label: 'Code fence', action: insertCodeFence },
  ]

  const breadcrumbParts = []
  if (note) {
    if (note.folder) breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
    breadcrumbParts.push(note.title)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, background: colors.bgElevated }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.textMuted, overflow: 'hidden', flex: 1 }}>
          {breadcrumbParts.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {i > 0 && <span style={{ color: colors.textDim }}>/</span>}
              <span style={{ color: i === breadcrumbParts.length - 1 ? colors.text : colors.textMuted }}>{part}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canUndo ? 1 : 0.3 }} onClick={() => { if (viewRef.current) { undo(viewRef.current); viewRef.current.focus() } }} title="Undo (Ctrl+Z)">
            <Icon name="undo" size={14} />
          </button>
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canRedo ? 1 : 0.3 }} onClick={() => { if (viewRef.current) { redo(viewRef.current); viewRef.current.focus() } }} title="Redo (Ctrl+Shift+Z)">
            <Icon name="redo" size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: colors.border, margin: '0 4px' }} />
          <button type="button" data-tip="Bold (Ctrl+B)" onClick={() => dispatchWrap('**', '**')} style={toolbarBtn}><Icon name="bold" size={14} /></button>
          <button type="button" data-tip="Italic (Ctrl+I)" onClick={() => dispatchWrap('*', '*')} style={toolbarBtn}><Icon name="italic" size={14} /></button>
          <button type="button" data-tip="Strikethrough" onClick={() => dispatchWrap('~~', '~~')} style={toolbarBtn}><Icon name="strikethrough" size={14} /></button>
          <button type="button" data-tip="Inline code" onClick={() => dispatchWrap('`', '`')} style={toolbarBtn}><Icon name="code" size={14} /></button>
          <button type="button" data-tip="Blockquote" onClick={insertQuote} style={toolbarBtn}><Icon name="quote" size={14} /></button>
          <button type="button" data-tip="Bullet list" onClick={insertBulletList} style={toolbarBtn}><Icon name="list" size={14} /></button>
          <button type="button" data-tip="Code fence" onClick={insertCodeFence} style={toolbarBtn}><Icon name="braces" size={14} /></button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
      {linked && linked.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderBottom: `1px solid ${colors.border}`, fontSize: 12, color: colors.textMuted, flexShrink: 0, overflowX: 'auto' }}>
          <span style={{ ...typography.sectionLabel, color: colors.textMuted, marginRight: 2 }}>Trail</span>
          {linked.map(n => (
            <button key={n.id} type="button" onClick={() => onOpenNote(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: colors.bgElevated, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: colors.text, whiteSpace: 'nowrap' }}>
              <StarIcon species={n.species} size="sm" /><span>{n.title}</span>
            </button>
          ))}
        </div>
      )}
      {showFind && <FindReplace viewRef={viewRef} showReplace={showReplace} onClose={() => { setShowFind(false); setShowReplace(false) }} />}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {showOutline && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`, overflow: 'auto', padding: space[2], flexShrink: 0, background: 'rgba(11, 15, 25, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6 }}>Outline</div>
            {headings.map((h, i) => (
              <button key={i} type="button" onClick={() => jumpTo(h.offset, i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: i === currentHeading ? 'rgba(180, 140, 80, 0.12)' : 'none', border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted, fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11, fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400, padding: '3px 6px', cursor: 'pointer', paddingLeft: 6 + (h.level - 1) * 10, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.text}</button>
            ))}
          </div>
        )}
        <div ref={editorContainerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {viewState && prefs.editor.cursor_trail_enabled !== false && prefs.editor.cursor_trail_mode !== 'off' && (
            <CursorTrail key={note?.id} view={viewState} containerRef={editorContainerRef} />
          )}
          <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
            <div ref={editorMountRef} style={{ flex: 1, minHeight: 0 }} />
          </ContextMenu>
          {linkPopup && (() => {
            const matches = Object.keys(noteNames).filter(t => t.toLowerCase().includes(linkPopup.query)).slice(0, 8)
            if (matches.length === 0) return null
            return (
              <div onMouseDown={(e) => e.preventDefault()}
                style={{ position: 'fixed', left: linkPopup.pos.left, top: linkPopup.pos.top, zIndex: 50, minWidth: 180, maxHeight: 200, overflowY: 'auto', background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`, borderRadius: 8, boxShadow: colors.shadow, padding: 4 }}>
                {matches.map((title, i) => (
                  <button key={title} type="button" onClick={() => insertWikilink(title)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', background: i === linkPopup.index ? 'rgba(180, 140, 80, 0.14)' : 'transparent', color: colors.text, fontSize: 12.5, textAlign: 'left', fontFamily: 'inherit' }}>
                    <StarIcon species={noteNames[title] ? 'neutral' : 'warm'} size="sm" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                  </button>
                ))}
              </div>
            )
          })()}
          {animatedEnabled && animItems.map(a => <AnimItem key={a.id} a={a} accent={colors.accent} />)}
        </div>
      </div>
    </div>
  )
}
