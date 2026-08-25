import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { colors, space, typography } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'
import { usePreferences } from '../lib/preferences-context'
import StarIcon from './StarIcon'
import Icon from './Icon'
import CursorTrail from './CursorTrail'
import ContextMenu from './ContextMenu'

const AUTOSAVE_DELAY = 1500
const LINE_HEIGHT = 22
let _animId = 0
/** Measure text width using an offscreen canvas. */
function measureText(text, font) {
  const ctx = measureText._ctx || (measureText._ctx = document.createElement('canvas').getContext('2d'))
  ctx.font = font
  return ctx.measureText(text).width
}
/** Get the (x, y) pixel position of a cursor offset inside a textarea-like element. */
function getCharPosition(ta, offset) {
  if (!ta) return { x: 0, y: 0, lh: 22, w: 8 }
  const cs = getComputedStyle(ta)
  const font = `${cs.fontSize} ${cs.fontFamily}`
  const padL = parseFloat(cs.paddingLeft) || 0
  const padT = parseFloat(cs.paddingTop) || 0
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6
  const textBefore = ta.value.slice(0, offset)
  const lines = textBefore.split('\n')
  const line = lines.length - 1
  const col = lines[line]
  const x = padL + measureText(lines[line], font)
  const y = padT + line * lh - ta.scrollTop
  // Approximate char width from the last typed char (or monospace advance).
  const w = measureText(lines[line].slice(-1) || '0', font) || 8
  return { x, y, lh, w }
}

export function parseHeadings(markdown) {
  const out = []
  let offset = 0
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+)/)
    if (m) out.push({ level: m[1].length, text: m[2], offset })
    offset += line.length + 1
  }
  return out
}

/** Insert text at cursor position in a textarea. */
function insertText(ta, text, start, end) {
  const before = ta.value.slice(0, start)
  const after = ta.value.slice(end)
  const newVal = before + text + after
  // Set cursor after inserted text
  const newPos = start + text.length
  return { value: newVal, start: newPos, end: newPos }
}

/** Wrap selection with prefix/suffix. */
function wrapSelection(ta, prefix, suffix) {
  const { selectionStart: start, selectionEnd: end, value } = ta
  const selected = value.slice(start, end)
  const wrapped = prefix + (selected || 'text') + suffix
  return insertText(ta, wrapped, start, end)
}

const MAX_HISTORY = 200
const ANIM_FADE_MS = 350
const ANIM_SPARKLE_MS = 450

/** Animation overlay item: a glow on the real char, or sparkle particles. */
function AnimItem({ a, accent }) {
  if (a.type === 'char') {
    // A soft glow/pop that plays ON the real character at its normal
    // position. No duplicate glyph, no mirroring.
    return (
      <span style={{
        position: 'absolute', left: a.x - 2, top: a.y - 2,
        width: a.w, height: a.lh,
        borderRadius: 4, pointerEvents: 'none', zIndex: 50,
        background: `radial-gradient(circle, ${accent}66 0%, transparent 70%)`,
        animation: `animCharPop ${ANIM_FADE_MS}ms ease-out forwards`
      }} />
    )
  }
  // sparkle particle (backspace)
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

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty,
  linked, onOpenNote, skyName, onCursorChange, editorMode, onEditorModeChange }) {
  const { prefs } = usePreferences()
  const [mode, setMode] = useState(editorMode || 'preview')
  const [typing, setTyping] = useState(false)
  const editorContainerRef = useRef(null)
  const typingTimer = useRef(null)
  const [currentHeading, setCurrentHeading] = useState(0)
  const debounceRef = useRef(null)
  const taRef = useRef(null)
  const previewRef = useRef(null)

  // --- Animated text overlay ---
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const [animItems, setAnimItems] = useState([])
  const animTimerRef = useRef(null)
  const lastBodyLenRef = useRef(body.length)

  // Sync lastBodyLen when note changes
  useEffect(() => { lastBodyLenRef.current = body.length }, [note?.id])

  /** Clean up expired animation items. */
  const sweepAnims = useCallback(() => {
    setAnimItems(prev => prev.filter(a => Date.now() - a.ts < (a.type === 'sparkle' ? ANIM_SPARKLE_MS : ANIM_FADE_MS)))
  }, [])

  /** Trigger an animation at the given offset (defaults to the cursor). */
  const triggerAnim = useCallback((action, offset) => {
    if (!animatedEnabled) return
    const ta = taRef.current
    if (!ta) return
    const at = offset != null ? offset : ta.selectionStart
    const pos = getCharPosition(ta, at)
    const id = ++_animId
    const ts = Date.now()
    if (action === 'type') {
      setAnimItems(prev => [...prev, { id, type: 'char', x: pos.x, y: pos.y, lh: pos.lh, w: pos.w, ts }])
    } else if (action === 'backspace') {
      const sparkles = Array.from({ length: 6 }, (_, i) => ({
        id: id * 100 + i,
        type: 'sparkle',
        x: pos.x, y: pos.y,
        dx: (Math.random() - 0.5) * 30,
        dy: (Math.random() - 0.5) * 20 - 8,
        ts
      }))
      setAnimItems(prev => [...prev, ...sparkles])
    }
    if (!animTimerRef.current) {
      animTimerRef.current = setInterval(sweepAnims, 60)
    }
  }, [animatedEnabled, sweepAnims])

  // Stop sweep timer when all items gone
  useEffect(() => {
    if (animItems.length === 0 && animTimerRef.current) {
      clearInterval(animTimerRef.current)
      animTimerRef.current = null
    }
  }, [animItems.length])

  // Cleanup timer on unmount
  useEffect(() => () => { if (animTimerRef.current) clearInterval(animTimerRef.current) }, [])

  // --- Undo / Redo history ---
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)
  const [historyInfo, setHistoryInfo] = useState({ canUndo: false, canRedo: false })

  // Initialise history when note changes
  useEffect(() => {
    historyRef.current = [body]
    historyIndexRef.current = 0
    isUndoRedoRef.current = false
    setHistoryInfo({ canUndo: false, canRedo: false })
  }, [note?.id])

  /** Push a new state onto the undo stack (call only for user-initiated edits). */
  const pushHistory = useCallback((newBody) => {
    if (isUndoRedoRef.current) return          // skip undo/redo restores
    const idx = historyIndexRef.current
    const stack = historyRef.current
    // Truncate any redo states ahead of the cursor
    const next = stack.slice(0, idx + 1)
    next.push(newBody)
    if (next.length > MAX_HISTORY) next.shift()
    historyRef.current = next
    historyIndexRef.current = next.length - 1
    setHistoryInfo({
      canUndo: next.length > 1,
      canRedo: false,
    })
  }, [])

  const undo = useCallback(() => {
    const idx = historyIndexRef.current
    if (idx <= 0) return
    isUndoRedoRef.current = true
    const prev = historyRef.current[idx - 1]
    historyIndexRef.current = idx - 1
    onBodyChange(prev)
    setHistoryInfo({
      canUndo: idx - 1 > 0,
      canRedo: true,
    })
    // Restore cursor to end of restored text
    setTimeout(() => {
      const ta = taRef.current
      if (ta) { ta.selectionStart = ta.selectionEnd = prev.length; ta.focus() }
      isUndoRedoRef.current = false
    }, 0)
  }, [onBodyChange])

  const redo = useCallback(() => {
    const idx = historyIndexRef.current
    const stack = historyRef.current
    if (idx >= stack.length - 1) return
    isUndoRedoRef.current = true
    const next = stack[idx + 1]
    historyIndexRef.current = idx + 1
    onBodyChange(next)
    setHistoryInfo({
      canUndo: true,
      canRedo: idx + 1 < stack.length - 1,
    })
    setTimeout(() => {
      const ta = taRef.current
      if (ta) { ta.selectionStart = ta.selectionEnd = next.length; ta.focus() }
      isUndoRedoRef.current = false
    }, 0)
  }, [onBodyChange])

  // Sync mode with parent
  useEffect(() => { setMode(editorMode || 'preview') }, [editorMode])

  function setModeAndNotify(m) {
    setMode(m)
    if (onEditorModeChange) onEditorModeChange(m)
  }

  // Always points at the current save closure so the mount-once
  // keydown and blur listeners never go stale across tab switches.
  const flushRef = useRef(null)
  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  const headings = useMemo(() => parseHeadings(body), [body])

  function handleChange(newBody) {
    pushHistory(newBody)
    onBodyChange(newBody)
    setDirty(true)
    setTyping(true)
    // Animated text: detect type vs backspace
    if (animatedEnabled) {
      const diff = newBody.length - lastBodyLenRef.current
      if (diff > 0) {
        const ta = taRef.current
        const insertStart = ta ? ta.selectionStart - diff : 0
        // Play the glow on the real character where it landed.
        triggerAnim('type', insertStart)
      } else if (diff < 0) {
        triggerAnim('backspace')
      }
    }
    lastBodyLenRef.current = newBody.length
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setTyping(false), 600)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flushRef.current()
    }, AUTOSAVE_DELAY)
  }

  function jumpTo(offset, index) {
    const ta = taRef.current
    if (!ta) return
    const before = body.slice(0, offset)
    const lineIndex = before.split('\n').length - 1
    ta.focus()
    ta.selectionStart = ta.selectionEnd = offset
    ta.scrollTop = Math.max(0, lineIndex * LINE_HEIGHT - 40)
    setCurrentHeading(index)
  }

  function onScroll() {
    const ta = taRef.current
    if (!ta) return
    const lineIndex = Math.floor(ta.scrollTop / LINE_HEIGHT)
    let current = 0
    for (let i = 0; i < headings.length; i++) {
      const hLine = body.slice(0, headings[i].offset).split('\n').length - 1
      if (hLine <= lineIndex) current = i
    }
    setCurrentHeading(current)
  }

  /** Update cursor position for the status bar. */
  const updateCursor = useCallback(() => {
    const ta = taRef.current
    if (!ta || !onCursorChange) return
    const pos = ta.selectionStart
    const textBefore = ta.value.slice(0, pos)
    const line = textBefore.split('\n').length
    const lastNewline = textBefore.lastIndexOf('\n')
    const col = pos - lastNewline
    onCursorChange({ line, col })
  }, [onCursorChange])

  /** Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+K, Tab. */
  function handleKeyDown(e) {
    // Ctrl+S save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      flushRef.current()
      return
    }

    // Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && mode === 'edit') {
      e.preventDefault()
      if (e.shiftKey) { redo() } else { undo() }
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && mode === 'edit') {
      e.preventDefault()
      redo()
      return
    }

    // Tab indent/outdent
    if (e.key === 'Tab' && mode === 'edit') {
      e.preventDefault()
      const ta = taRef.current
      if (!ta) return
      const { selectionStart: start, selectionEnd: end, value } = ta

      if (e.shiftKey) {
        // Outdent: remove up to 2 leading spaces from selected lines
        const before = value.slice(0, start)
        const lineStart = before.lastIndexOf('\n') + 1
        const selected = value.slice(lineStart, end)
        const outdented = selected.replace(/^ {1,2}/gm, '')
        const diff = selected.length - outdented.length
        const newVal = value.slice(0, lineStart) + outdented + value.slice(end)
        pushHistory(newVal)
        onBodyChange(newVal)
        setDirty(true)
        setTimeout(() => {
          ta.selectionStart = start - Math.min(2, start - lineStart)
          ta.selectionEnd = end - diff
        }, 0)
      } else {
        // Indent: add 2 spaces to selected lines
        const before = value.slice(0, start)
        const lineStart = before.lastIndexOf('\n') + 1
        const selected = value.slice(lineStart, end)
        const indented = '  ' + selected.replace(/\n/g, '\n  ')
        const diff = indented.length - selected.length
        const newVal = value.slice(0, lineStart) + indented + value.slice(end)
        pushHistory(newVal)
        onBodyChange(newVal)
        setDirty(true)
        setTimeout(() => {
          ta.selectionStart = start + 2
          ta.selectionEnd = end + diff
        }, 0)
      }
      return
    }

    // Ctrl+B/I/K shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B' ||
        e.key === 'i' || e.key === 'I' || e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      const ta = taRef.current
      if (!ta) return
      let result
      if (e.key === 'b' || e.key === 'B') {
        result = wrapSelection(ta, '**', '**')
      } else if (e.key === 'i' || e.key === 'I') {
        result = wrapSelection(ta, '*', '*')
      } else if (e.key === 'k' || e.key === 'K') {
        result = wrapSelection(ta, '[', '](url)')
      }
      if (result) {
        pushHistory(result.value)
        onBodyChange(result.value)
        setDirty(true)
        setTimeout(() => {
          ta.selectionStart = result.start
          ta.selectionEnd = result.end
          ta.focus()
        }, 0)
      }
    }
  }

  /** Commit an editor mutation produced by insertText/wrapSelection. */
  function commitEdit(result) {
    handleChange(result.value)
    const ta = taRef.current
    setTimeout(() => {
      ta.selectionStart = result.start
      ta.selectionEnd = result.end
      ta.focus()
    }, 0)
  }

  function applyWrap(prefix, suffix) {
    const ta = taRef.current
    if (!ta) return
    commitEdit(wrapSelection(ta, prefix, suffix))
  }

  function insertLink() {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e)
    const text = selected || 'text'
    const result = insertText(ta, `[${text}](url)`, s, e)
    handleChange(result.value)
    setTimeout(() => {
      ta.selectionStart = s + text.length + 3
      ta.selectionEnd = s + text.length + 6
      ta.focus()
    }, 0)
  }

  function insertTable() {
    const ta = taRef.current
    if (!ta) return
    const at = ta.selectionStart
    const table = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell | Cell |\n'
    commitEdit(insertText(ta, table, at, at))
  }

  function insertCode() {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e)
    if (selected) {
      commitEdit(insertText(ta, '```\n' + selected + '\n```', s, e))
    } else {
      const result = insertText(ta, '```\n\n```', s, s)
      handleChange(result.value)
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = s + 4
        ta.focus()
      }, 0)
    }
  }

  function insertQuote() {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const before = value.slice(0, s)
    const lineStart = before.lastIndexOf('\n') + 1
    const selected = value.slice(lineStart, e)
    const quoted = selected.split('\n').map(l => (l ? '> ' : '>') + l).join('\n')
    commitEdit(insertText(ta, quoted, lineStart, e))
  }

  function runNativeEdit(cmd) {
    const ta = taRef.current
    if (!ta) return
    ta.focus()
    document.execCommand(cmd)
  }

  async function doPaste() {
    const ta = taRef.current
    if (!ta) return
    ta.focus()
    if (document.execCommand('paste')) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) commitEdit(insertText(ta, text, ta.selectionStart, ta.selectionEnd))
    } catch { /* clipboard unavailable */ }
  }

  const editorMenuItems = [
    { id: 'cut', label: 'Cut', icon: 'scissors', shortcut: 'Ctrl+X', onSelect: () => runNativeEdit('cut') },
    { id: 'copy', label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C',
      onSelect: () => {
        const ta = taRef.current; if (!ta) return
        ta.focus()
        document.execCommand('copy')
      } },
    { id: 'paste', label: 'Paste', icon: 'paste', shortcut: 'Ctrl+V', onSelect: doPaste },
    { id: 'sep1', type: 'separator' },
    { id: 'bold', label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', onSelect: () => applyWrap('**', '**') },
    { id: 'italic', label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', onSelect: () => applyWrap('*', '*') },
    { id: 'link', label: 'Insert link', icon: 'link', shortcut: 'Ctrl+K', onSelect: insertLink },
    { id: 'table', label: 'Insert table', icon: 'table', onSelect: insertTable },
    { id: 'code', label: 'Code block', icon: 'code', onSelect: insertCode },
    { id: 'quote', label: 'Blockquote', icon: 'quote', onSelect: insertQuote },
    { id: 'sep2', type: 'separator' },
    { id: 'select-all', label: 'Select all', shortcut: 'Ctrl+A',
      onSelect: () => { const ta = taRef.current; if (!ta) return; ta.focus(); ta.select() } },
    { id: 'sep3', type: 'separator' },
    { id: 'undo', label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', onSelect: undo },
    { id: 'redo', label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Shift+Z', onSelect: redo },
  ]

  /** Sync textarea scroll with preview scroll in split mode. */
  function handleTextareaScroll() {
    onScroll()
    // Sync preview scroll proportionally
    const ta = taRef.current
    const pv = previewRef.current
    if (!ta || !pv) return
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1)
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight)
  }

  useEffect(() => {
    const onBlur = () => flushRef.current()
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('blur', onBlur) }
  }, [])

  const showOutline = mode === 'edit' && headings.length >= 3
  const showBreadcrumbs = mode !== 'split'

  // Breadcrumb path
  const breadcrumbParts = [skyName || 'Sky']
  if (note.folder) {
    breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
  }
  breadcrumbParts.push(note.title)

  const toolbarBtn = { background: 'none', border: 'none', color: colors.textMuted,
    padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1 }}>
      {animatedEnabled && (
        <style>{`
          @keyframes animCharPop {
            0% { opacity: 0; transform: translateY(-8px) scale(1.4); }
            35% { opacity: 0.9; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(0) scale(1.05); }
          }
          @keyframes animSparkle {
            0% { opacity: 1; transform: translate(0, 0) scale(1); }
            100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
          }
        `}</style>
      )}
      {/* Title bar with breadcrumbs, title, and mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2],
        padding: `${space[2]}px ${space[3]}px`,
        borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Breadcrumbs */}
          {showBreadcrumbs && (
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
          )}
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: colors.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title}
          </h2>
        </div>

        {/* Undo / Redo */}
        {(mode === 'edit' || mode === 'split') && (
          <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 6,
            overflow: 'hidden', flexShrink: 0 }}>
            <button type="button" onClick={undo} disabled={!historyInfo.canUndo}
              style={{ ...toolbarBtn, opacity: historyInfo.canUndo ? 1 : 0.3 }}>
              <Icon name="undo" size={14} />
            </button>
            <button type="button" onClick={redo} disabled={!historyInfo.canRedo}
              style={{ ...toolbarBtn, opacity: historyInfo.canRedo ? 1 : 0.3 }}>
              <Icon name="redo" size={14} />
            </button>
          </div>
        )}

        {/* Mode toggle: edit | split | preview */}
        <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 6,
          overflow: 'hidden', flexShrink: 0 }}>
          {[['edit', 'pencil'], ['split', 'columns'], ['preview', 'eye']].map(([m, icon]) => (
            <button key={m} type="button" onClick={() => setModeAndNotify(m)} data-tip={m}
              style={{ ...toolbarBtn,
                background: mode === m ? colors.bgElevated : 'none',
                color: mode === m ? colors.text : colors.textMuted }}>
              <Icon name={icon} size={14} />
            </button>
          ))}
        </div>
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

      {/* Editor area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Outline (edit mode only, not split) */}
        {showOutline && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`,
            overflow: 'auto', padding: space[2], flexShrink: 0,
            background: 'rgba(11, 15, 25, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6 }}>Outline</div>
            {headings.map((h, i) => (
              <button key={i} type="button" onClick={() => jumpTo(h.offset, i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none',
                  border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted,
                  fontSize: 12, padding: '3px 6px', cursor: 'pointer',
                  paddingLeft: 6 + (h.level - 1) * 10 }}>{h.text}</button>
            ))}
          </div>
        )}

        {/* Content area */}
        {mode === 'split' ? (
          /* Split view: textarea left, preview right */
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div ref={editorContainerRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {(mode === 'edit' || mode === 'split') && prefs.editor.cursor_trail_mode !== 'off' && (
                <CursorTrail key={note?.path} textareaRef={taRef} containerRef={editorContainerRef} />
              )}
              <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
              <textarea
                ref={taRef}
                value={body}
                spellCheck={prefs.editor.spell_check_enabled !== false}
                onChange={(e) => handleChange(e.target.value)}
                onScroll={handleTextareaScroll}
                onKeyDown={handleKeyDown}
                onSelect={updateCursor}
                onClick={updateCursor}                  onKeyUp={updateCursor}
                placeholder="Write, the night holds what you seek."
                style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
                  background: 'transparent', border: 'none', color: colors.text,
                  fontFamily: prefs.editor.font_family || 'monospace',
                  fontSize: prefs.editor.font_size || 14, lineHeight: prefs.editor.line_height || 1.6, padding: space[3],
                  transition: 'box-shadow 0.6s ease-out',
                  boxShadow: typing ? `inset 0 0 30px rgba(180, 140, 80, 0.06)` : 'none' }}
              />
              {/* Animated text overlay (split mode) */}
              {animatedEnabled && animItems.map(a => (
                <AnimItem key={a.id} a={a} accent={colors.accent} />
              ))}
              </ContextMenu>
            </div>
            <div style={{ width: 1, background: colors.border, flexShrink: 0 }} />
            <div ref={previewRef} style={{ flex: 1, minWidth: 0, overflow: 'auto',
              padding: space[3], color: colors.text, lineHeight: prefs.editor.line_height || 1.6 }}>
              {renderMarkdown(body)}
            </div>
          </div>
        ) : (
          /* Single pane: edit or preview */
          <div ref={mode === 'edit' ? editorContainerRef : undefined}
            style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: space[3],
              position: mode === 'edit' ? 'relative' : undefined,
              transition: 'box-shadow 0.6s ease-out',
              boxShadow: typing ? `inset 0 0 30px rgba(180, 140, 80, 0.06)` : 'none' }}>
            {mode === 'preview' ? (
              <div style={{ color: colors.text, lineHeight: 1.6 }}>{renderMarkdown(body)}</div>
            ) : (
              <>
              {(mode === 'edit') && prefs.editor.cursor_trail_mode !== 'off' && (
                <CursorTrail key={note?.path} textareaRef={taRef} containerRef={editorContainerRef} />
              )}
              <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
              <textarea
                ref={taRef}
                value={body}
                spellCheck={prefs.editor.spell_check_enabled !== false}
                onChange={(e) => handleChange(e.target.value)}
                onScroll={onScroll}
                onKeyDown={handleKeyDown}
                onSelect={updateCursor}
                onClick={updateCursor}
                onKeyUp={updateCursor}
                placeholder="Write, the night holds what you seek."
                style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
                  background: 'transparent', border: 'none', color: colors.text,
                  fontFamily: prefs.editor.font_family || 'monospace',
                  fontSize: prefs.editor.font_size || 14, lineHeight: prefs.editor.line_height || 1.6 }}
              />
              {/* Animated text overlay (single mode) */}
              {animatedEnabled && animItems.map(a => (
                <AnimItem key={a.id} a={a} accent={colors.accent} />
              ))}
              </ContextMenu>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
