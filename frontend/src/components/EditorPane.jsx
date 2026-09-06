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

/** Sparkle particle shown where a character was removed (backspace). */
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
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})\s*(.*)/)
    if (fenceMatch) {
      const char = fenceMatch[1].trim()[0]
      if (!inFence) {
        inFence = true
        fenceChar = char
      } else if (char === fenceChar && fenceMatch[1].trim()[0] === fenceChar) {
        inFence = false
      }
      offset += line.length + 1
      continue
    }
    if (inFence) {
      offset += line.length + 1
      continue
    }
    // ATX headings: # through ######
    const atx = line.match(/^(#{1,6})\s+(.+)/)
    if (atx) {
      out.push({ level: atx[1].length, text: atx[2].replace(/\s+#+\s*$/, ''), offset })
      offset += line.length + 1
      continue
    }
    // Setext headings: text followed by === (h1) or --- (h2)
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
    if (!id && onNewNote) onNewNote(title) // broken link: create the note
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

  // --- Animated text: sparkle particles on backspace. The insert
  // animation itself is handled by the CM6 animField decorations.
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const [animItems, setAnimItems] = useState([])
  const animTimerRef = useRef(null)
  const lastSparkleRef = useRef(0)

  const editorFont = prefs.editor.font_family || 'monospace'
  const editorFontSize = prefs.editor.font_size || 14
  const editorLineHeight = prefs.editor.line_height || 1.6

  /** Clean up expired animation items. */
  const sweepAnims = useCallback(() => {
    const now = Date.now()
    setAnimItems(prev => {
      const next = prev.filter(a => now - a.ts < ANIM_SPARKLE_MS)
      return next.length === prev.length ? prev : next
    })
  }, [])

  /** Sparkle burst where a character was removed (backspace). */
  const triggerSparkles = useCallback((pos) => {
    if (!animatedEnabled) return
    const now = Date.now()
    if (now - lastSparkleRef.current < 80) return
    lastSparkleRef.current = now
    const view = viewRef.current
    const container = editorContainerRef.current
    if (!view || !container) return
    const coords = view.coordsAtPos(pos)
    if (!coords) return
    const rect = container.getBoundingClientRect()
    const id = ++_animId
    const sparkles = Array.from({ length: 4 }, (_, i) => ({
      id: id * 100 + i,
      type: 'sparkle',
      x: coords.left - rect.left,
      y: coords.top - rect.top,
      dx: (Math.random() - 0.5) * 30,
      dy: (Math.random() - 0.5) * 20 - 8,
      ts: now
    }))
    setAnimItems(prev => [...prev, ...sparkles])
    if (!animTimerRef.current) animTimerRef.current = setInterval(sweepAnims, 60)
  }, [animatedEnabled, sweepAnims])

  // Stop sweep timer when nothing left
  useEffect(() => {
    if (animItems.length === 0 && animTimerRef.current) {
      clearInterval(animTimerRef.current)
      animTimerRef.current = null
    }
  }, [animItems.length])

  // Cleanup timer on unmount
  useEffect(() => () => { if (animTimerRef.current) clearInterval(animTimerRef.current) }, [])

  // --- Wikilink autocomplete ---
  const [linkPopup, setLinkPopup] = useState(null) // { query, index, pos: {top, left} }

  const headings = useMemo(() => parseHeadings(body), [body])

  // --- Autosave debounce ---
  const debounceRef = useRef(null)

  const flushRef = useRef(null)
  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  /** Detect whether the cursor sits inside a [[ wikilink and show/update
   *  the autocomplete popup accordingly. */
  function updateLinkPopup(view, cursor) {
    const text = view.state.doc.toString()
    if (!noteNames || Object.keys(noteNames).length === 0) {
      setLinkPopup(null)
      return
    }
    const before = text.slice(0, cursor)
    const openBracket = before.lastIndexOf('[[')
    if (openBracket < 0) { setLinkPopup(null); return }
    const afterOpen = before.slice(openBracket + 2)
    if (afterOpen.includes(']]')) { setLinkPopup(null); return }
    if (afterOpen.includes('\n')) { setLinkPopup(null); return }
    const query = afterOpen.toLowerCase()
    const matches = Object.keys(noteNames)
      .filter(t => t.toLowerCase().includes(query) && t.toLowerCase() !== text.slice(openBracket + 2, cursor).toLowerCase())
      .slice(0, 8)
    if (matches.length === 0) { setLinkPopup(null); return }
    // Position from the CM6 caret, viewport-relative for the fixed popup.
    const coords = view.coordsAtPos(cursor)
    if (!coords) { setLinkPopup(null); return }
    setLinkPopup({ query, index: 0, pos: { top: coords.bottom + 4, left: coords.left } })
  }

  /** Insert the selected wikilink at the cursor, closing the popup. */
  function insertWikilink(title) {
    const view = viewRef.current
    if (!view) return
    const cursor = view.state.selection.main.head
    const text = view.state.doc.toString()
    const openBracket = text.lastIndexOf('[[')
    if (openBracket < 0) return
    const link = `[[${title}]]`
    view.dispatch({
      changes: { from: openBracket, to: cursor, insert: link },
      selection: { anchor: openBracket + link.length },
    })
    setLinkPopup(null)
    view.focus()
  }

  // --- Mount / remount the CM6 view for the note ---
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
          debounceRef.current = setTimeout(() => {
            flushRef.current()
          }, (prefs.editor.autosave_interval || 3) * 1000)
        },
        onCursorChange: ({ line, col }) => {
          if (onCursorChange) onCursorChange({ line, col })
          const v = viewRef.current
          if (v) updateLinkPopup(v, v.state.selection.main.head)
        },
        onDelete: (pos) => triggerSparkles(pos),
        save: () => flushRef.current(),
        openFind: () => { setShowFind(true); setShowReplace(false) },
        openReplace: () => { setShowFind(true); setShowReplace(true) },
        openImage: () => fileInputRef.current?.click(),
        onPasteImage: (file) => insertImageForFile(file),
        onDropImage: (file, pos) => insertImageForFile(file, pos),
        onHistoryChange: () => {
          const v = viewRef.current
          if (v) setHist({ canUndo: undoDepth(v.state) > 0, canRedo: redoDepth(v.state) > 0 })
        },
      },
    })
    viewRef.current = view
    setViewState(view)
    setHist({ canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 })
    return () => {
      view.destroy()
      viewRef.current = null
      setViewState(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id])

  // External body change (reload from disk): sync the doc when it differs
  // from what the editor holds.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== body) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: body },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

  // Update link popup on selection changes (click, arrows).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const onSelection = () => {
      const v = viewRef.current
      if (v) updateLinkPopup(v, v.state.selection.main.head)
    }
    view.dom.addEventListener('mouseup', onSelection)
    view.dom.addEventListener('keyup', onSelection)
    return () => {
      view.dom.removeEventListener('mouseup', onSelection)
      view.dom.removeEventListener('keyup', onSelection)
    }
  }, [note?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Scroll the outline to the heading under the viewport top. */
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const onScroll = () => {
      const v = viewRef.current
      if (!v || headings.length === 0) return
      const top = v.scrollDOM.scrollTop
      const block = v.lineBlockAtHeight(Math.max(0, top))
      const pos = block ? block.from : 0
      let current = 0
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].offset <= pos) current = i
      }
      setCurrentHeading(current)
    }
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })
    return () => view.scrollDOM.removeEventListener('scroll', onScroll)
  }, [note?.id, headings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function jumpTo(offset, index) {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      selection: { anchor: offset },
      effects: EditorView.scrollIntoView(offset, { y: 'start' }),
    })
    setCurrentHeading(index)
    view.focus()
  }

  // --- Image import ---
  async function insertImageForFile(file, dropPos) {
    const view = viewRef.current
    if (!view || !window.go?.main?.App?.ImportImage || !file) return false
    const dataURI = await new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result || '')
      r.onerror = () => resolve('')
      r.readAsDataURL(file)
    })
    if (!dataURI) return false
    let rel
    try {
      rel = await window.go.main.App.ImportImage(file.name, dataURI)
    } catch (err) {
      if (window.console) console.error('ImportImage failed:', err)
      return false
    }
    const alt = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/["\[\]]/g, '').trim() || 'image'
    const folderDepth = (note.folder || '').split('/').filter(Boolean).length
    const prefix = folderDepth > 0 ? '../'.repeat(folderDepth) : ''
    const src = prefix + rel.replace(/^\/\.glean\//, '.glean/')
    const escaped = src.replace(/[()\s]/g, c => c === ' ' ? '%20' : ('\\' + c))
    const md = `![${alt}](${escaped})`
    const cursor = dropPos != null ? dropPos : view.state.selection.main.head
    view.dispatch({
      changes: { from: cursor, to: cursor, insert: md },
      selection: { anchor: cursor + md.length },
    })
    view.focus()
    return true
  }

  // --- Toolbar actions ---
  function dispatchWrap(prefix, suffix) {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to) || 'text'
    const insert = prefix + selected + suffix
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
    })
    view.focus()
  }

  function insertCodeFence() {
    const view = viewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const insert = '\n```\n\n```\n'
    view.dispatch({
      changes: { from, to: from, insert },
      selection: { anchor: from + 5 },
    })
    view.focus()
  }

  function insertQuote() {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const before = view.state.sliceDoc(0, from)
    const lineStart = before.lastIndexOf('\n') + 1
    const selected = view.state.sliceDoc(lineStart, to)
    const quoted = selected.split('\n').map(l => (l ? '> ' : '>') + l).join('\n')
    view.dispatch({
      changes: { from: lineStart, to, insert: quoted },
      selection: { anchor: lineStart + quoted.length },
    })
    view.focus()
  }

  function insertBulletList() {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const before = view.state.sliceDoc(0, from)
    const lineStart = before.lastIndexOf('\n') + 1
    const selected = view.state.sliceDoc(lineStart, to)
    const listed = selected.split('\n').map(l => '- ' + l).join('\n')
    view.dispatch({
      changes: { from: lineStart, to, insert: listed },
      selection: { anchor: lineStart + listed.length },
    })
    view.focus()
  }

  function insertImageFromPicker() {
    const f = fileInputRef.current?.files?.[0]
    if (f) insertImageForFile(f)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function doUndo() { const v = viewRef.current; if (v) { undo(v); v.focus() } }
  function doRedo() { const v = viewRef.current; if (v) { redo(v); v.focus() } }

  const showOutline = headings.length >= 3
  const breadcrumbParts = [skyName || 'Sky']
  if (note.folder) {
    breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
  }
  breadcrumbParts.push(note.title)

  const toolbarBtn = { background: 'none', border: 'none', color: colors.textMuted,
    padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }

  const editorMenuItems = [
    { id: 'undo', label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', onSelect: doUndo },
    { id: 'redo', label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Shift+Z', onSelect: doRedo },
    { id: 'sep1', type: 'separator' },
    { id: 'bold', label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', onSelect: () => dispatchWrap('**', '**') },
    { id: 'italic', label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', onSelect: () => dispatchWrap('*', '*') },
    { id: 'insert', label: 'Insert', icon: 'plus', submenu: [
      { id: 'ins-link', label: 'Link', icon: 'link', shortcut: 'Ctrl+K', onSelect: () => dispatchWrap('[', '](url)') },
      { id: 'ins-table', label: 'Table', icon: 'table', onSelect: () => {
        const v = viewRef.current; if (!v) return
        const at = v.state.selection.main.head
        const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell | Cell |\n'
        v.dispatch({ changes: { from: at, to: at, insert: table } })
        v.focus()
      } },
      { id: 'ins-image', label: 'Image', icon: 'image', shortcut: 'Ctrl+Shift+I',
        onSelect: () => fileInputRef.current?.click() },
    ] },
    { id: 'code', label: 'Code block', icon: 'code', onSelect: insertCodeFence },
    { id: 'quote', label: 'Blockquote', icon: 'quote', onSelect: insertQuote },
    { id: 'sep2', type: 'separator' },
    { id: 'find', label: 'Find & Replace', icon: 'search', shortcut: 'Ctrl+F',
      onSelect: () => { setShowFind(true); setShowReplace(true) } },
    { id: 'sep3', type: 'separator' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, flex: 1, position: 'relative' }}>
      {animatedEnabled && (
        <style>{`
          @keyframes animSparkle {
            0% { opacity: 1; transform: translate(0, 0) scale(1); }
            100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
          }
        `}</style>
      )}
      {/* Title bar with breadcrumbs, title, and editor actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2],
        padding: `${space[2]}px ${space[3]}px`,
        borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2,
            fontSize: 11, color: colors.textDim, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {breadcrumbParts.map((part, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: colors.textDim }}>/</span>}
                <span style={{ color: i === breadcrumbParts.length - 1 ? colors.textMuted : colors.textDim }}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: colors.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title}
          </h2>
        </div>

        {/* Undo / Redo / Insert image */}
        <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 6,
          overflow: 'hidden', flexShrink: 0 }}>
          <button type="button" onClick={doUndo} disabled={!hist.canUndo}
            style={{ ...toolbarBtn, opacity: hist.canUndo ? 1 : 0.3 }}>
            <Icon name="undo" size={14} />
          </button>
          <button type="button" onClick={doRedo} disabled={!hist.canRedo}
            style={{ ...toolbarBtn, opacity: hist.canRedo ? 1 : 0.3 }}>
            <Icon name="redo" size={14} />
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} data-tip="Insert image (Ctrl+Shift+I)"
            style={{ ...toolbarBtn, color: colors.textMuted }}>
            <Icon name="image" size={14} />
          </button>
        </div>

        {/* Formatting toolbar */}
        <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 6,
          overflow: 'hidden', flexShrink: 0 }}>
          <button type="button" data-tip="Bold (Ctrl+B)" onClick={() => dispatchWrap('**', '**')} style={toolbarBtn}>
            <Icon name="bold" size={14} />
          </button>
          <button type="button" data-tip="Italic (Ctrl+I)" onClick={() => dispatchWrap('*', '*')} style={toolbarBtn}>
            <Icon name="italic" size={14} />
          </button>
          <button type="button" data-tip="Strikethrough" onClick={() => dispatchWrap('~~', '~~')} style={toolbarBtn}>
            <Icon name="strikethrough" size={14} />
          </button>
          <button type="button" data-tip="Inline code" onClick={() => dispatchWrap('`', '`')} style={toolbarBtn}>
            <Icon name="code" size={14} />
          </button>
          <button type="button" data-tip="Blockquote" onClick={insertQuote} style={toolbarBtn}>
            <Icon name="quote" size={14} />
          </button>
          <button type="button" data-tip="Bullet list" onClick={insertBulletList} style={toolbarBtn}>
            <Icon name="list" size={14} />
          </button>
          <button type="button" data-tip="Code fence" onClick={insertCodeFence} style={toolbarBtn}>
            <Icon name="braces" size={14} />
          </button>
        </div>

        {/* Hidden image picker for Insert image */}
        <input ref={fileInputRef} type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={insertImageFromPicker} />
      </div>

      {/* Trail chips */}
      {linked && linked.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          borderBottom: `1px solid ${colors.border}`, fontSize: 12, color: colors.textMuted,
          flexShrink: 0, overflowX: 'auto' }}>
          <span style={{ ...typography.sectionLabel, color: colors.textMuted, marginRight: 2 }}>Trail</span>
          {linked.map(n => (
            <button key={n.id} type="button" onClick={() => onOpenNote(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: colors.bgElevated,
                border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px',
                cursor: 'pointer', fontSize: 11, color: colors.text, whiteSpace: 'nowrap' }}>
              <StarIcon species={n.species} size="sm" />
              <span>{n.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Find & replace bar */}
      {showFind && (
        <FindReplace viewRef={viewRef} showReplace={showReplace}
          onClose={() => { setShowFind(false); setShowReplace(false) }} />
      )}

      {/* Editor area */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {/* Outline */}
        {showOutline && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`,
            overflow: 'auto', padding: space[2], flexShrink: 0,
            background: 'rgba(11, 15, 25, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6 }}>Outline</div>
            {headings.map((h, i) => (
              <button key={i} type="button" onClick={() => jumpTo(h.offset, i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background:
                  i === currentHeading ? 'rgba(180, 140, 80, 0.12)' : 'none',
                  border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted,
                  fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11,
                  fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400,
                  padding: '3px 6px', cursor: 'pointer',
                  paddingLeft: 6 + (h.level - 1) * 10,
                  textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.text}</button>
            ))}
          </div>
        )}

        {/* The live preview editor. CM6 mounts into the inner ref div;
            it scrolls itself, and the ContextMenu wraps it so right-click
            opens the editor menu. */}
        <div ref={editorContainerRef}
          style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {viewState && prefs.editor.cursor_trail_enabled !== false && prefs.editor.cursor_trail_mode !== 'off' && (
            <CursorTrail key={note?.id} view={viewState} containerRef={editorContainerRef} />
          )}
          <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
            <div ref={editorMountRef} style={{ flex: 1, minHeight: 0 }} />
          </ContextMenu>
          {linkPopup && (() => {
            const matches = Object.keys(noteNames)
              .filter(t => t.toLowerCase().includes(linkPopup.query))
              .slice(0, 8)
            if (matches.length === 0) return null
            return (
              <div
                onMouseDown={(e) => e.preventDefault()}
                style={{ position: 'fixed', left: linkPopup.pos.left, top: linkPopup.pos.top,
                  zIndex: 50, minWidth: 180, maxHeight: 200, overflowY: 'auto',
                  background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`,
                  borderRadius: 8, boxShadow: colors.shadow, padding: 4 }}>
                {matches.map((title, i) => (
                  <button key={title} type="button"
                    onClick={() => insertWikilink(title)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: i === linkPopup.index ? 'rgba(180, 140, 80, 0.14)' : 'transparent',
                      color: colors.text, fontSize: 12.5, textAlign: 'left', fontFamily: 'inherit' }}>
                    <StarIcon species={noteNames[title] ? 'neutral' : 'warm'} size="sm" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {title}
                    </span>
                  </button>
                ))}
              </div>
            )
          })()}
          {animatedEnabled && animItems.map(a => (
            <AnimItem key={a.id} a={a} accent={colors.accent} />
          ))}
        </div>
      </div>
    </div>
  )
}