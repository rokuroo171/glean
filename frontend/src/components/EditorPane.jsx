import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { colors, space, typography } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'
import { usePreferences } from '../lib/preferences-context'
import StarIcon from './StarIcon'
import Icon from './Icon'
import CursorTrail from './CursorTrail'
import ContextMenu from './ContextMenu'
import { caretPosition, overlayCaretDelta } from '../lib/caret-position'

const AUTOSAVE_DELAY = 1500
const LINE_HEIGHT = 22
let _animId = 0
/** Get the (x, y) pixel position of a caret inside the textarea container.
 *  Uses the native selection rect so sparkles land exactly on the glyph
 *  that was removed, on long notes too. */
function getCharPosition(ta) {
  if (!ta) return { x: 0, y: 0, lh: 22, w: 8 }
  const container = ta.closest('[data-editor-root]') || ta.offsetParent
  const p = caretPosition(ta, container)
  if (!p) return { x: 0, y: 0, lh: 22, w: 8 }
  // carets are viewport-relative; sparkles are absolutely positioned in the
  // scrollable content, so add the host scroll back when it scrolls.
  let x = p.x
  let y = p.y
  if (container && container.scrollHeight > container.clientHeight + 1) {
    x += container.scrollLeft || 0
    y += container.scrollTop || 0
  }
  return { x, y, lh: p.lh, w: p.w }
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
/** Capitalize first letter (drop -> Drop) for keyframe names. */
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Drop' }

/** Rolling list of freshly inserted ranges.
 *  Each keystroke gets its OWN range with a stable id and its own start
 *  time. Merging ranges into one and re-stamping the timestamp made the
 *  span's key change on every repeat, so React remounted it and the
 *  animation restarted from opacity 0 each repeat - during a held key
 *  nothing ever became visible until release. With per-keystroke ranges
 *  the characters stream in one by one, each animating in place. */
let _rangeId = 1
function pushFreshRange(prev, start, len) {
  const now = Date.now()
  const next = prev
    .filter(r => now - r.ts < ANIM_FADE_MS)
    .map(r => (r.start >= start ? { ...r, start: r.start + len, end: r.end + len } : r))
  next.push({ id: ++_rangeId, start, end: start + len, ts: now })
  next.sort((a, b) => a.start - b.start)
  return next.slice(-14)
}

/** Adjust fresh ranges after a deletion of `len` chars at `at`. */
function cutFreshRanges(prev, at, len) {
  const delStart = at
  const delEnd = at - len
  const now = Date.now()
  return prev
    .filter(r => now - r.ts < ANIM_FADE_MS)
    .map(r => {
      if (r.end <= delStart) return r
      if (r.start >= delEnd) return { ...r, start: r.start + len, end: r.end + len }
      return { ...r, end: delStart }
    })
    .filter(r => r.end > r.start)
}

/** Split the body into stable text and animated segments so plain text
 *  lays out EXACTLY like the textarea (same wrap, tabs, emoji), and only
 *  freshly typed chunks carry the animation. Per-char inline-block spans
 *  are atomic and cannot wrap like the textarea, which drifted at depth. */
function renderSegments(body, ranges, typingStyle) {
  const segs = []
  let last = 0
  const list = ranges.filter(r => r.end <= body.length)
  for (const r of list) {
    if (r.start < last) continue
    if (r.start > last) segs.push({ text: body.slice(last, r.start), key: null, fresh: false })
    segs.push({ text: body.slice(r.start, r.end), key: r.id, fresh: true })
    last = r.end
  }
  if (last < body.length) segs.push({ text: body.slice(last), key: null, fresh: false })
  return segs.map(s => s.fresh
    ? <span key={s.key} style={{ display: 'inline-block',
        animation: `char${cap(typingStyle)} ${ANIM_FADE_MS}ms ease-out` }}>{s.text}</span>
    : s.text)
}

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

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty,
  linked, onOpenNote, onNewNote, skyName, onCursorChange, editorMode, onEditorModeChange, noteNames }) {

  function handleNoteLink(title, id) {
    if (id && onOpenNote) { onOpenNote(id); return }
    if (!id && onNewNote) onNewNote(title) // broken link: create the note
  }
  const { prefs } = usePreferences()
  const [mode, setMode] = useState(editorMode || 'preview')
  const [typing, setTyping] = useState(false)
  const editorContainerRef = useRef(null)
  const typingTimer = useRef(null)
  const [currentHeading, setCurrentHeading] = useState(0)
  const debounceRef = useRef(null)
  const skipScrollRef = useRef(false)
  const taRef = useRef(null)
  const previewRef = useRef(null)
  const fileInputRef = useRef(null)

  // --- Wikilink autocomplete ---
  const [linkPopup, setLinkPopup] = useState(null) // { query, index, pos: {top, left} }
  const linkPopupRef = useRef(null)

  // --- Animated text (Issue #2): the visible text IS the animated layer ---
  // The textarea text is transparent; a text layer on top renders the real
  // characters. A freshly typed character animates in place (drop from top).
  // No duplicate glyph, no mirror - the real character is the animation.
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const typingStyle = prefs.editor.animated_text_style || 'drop'
  const [animItems, setAnimItems] = useState([])    // backspace sparkle particles
  const [freshRanges, setFreshRanges] = useState([]) // [{start,end,ts}] rolling insert ranges
  const [selActive, setSelActive] = useState(false) // native selection in progress
  const [overlayGeo, setOverlayGeo] = useState(null) // textarea's exact box + padding
  const deltaRef = useRef({ dx: 0, dy: 0 }) // measured overlay-to-textarea offset
  const animTimerRef = useRef(null)
  const lastBodyLenRef = useRef(body.length)
  const overlayInnerRef = useRef(null)

  const editorFont = prefs.editor.font_family || 'monospace'
  const editorFontSize = prefs.editor.font_size || 14
  const editorLineHeight = prefs.editor.line_height || 1.6

  // Sync lastBodyLen when note changes
  useEffect(() => { lastBodyLenRef.current = body.length }, [note?.id])

  /** Clean up expired animation items. Identity-bails when nothing
   *  expired so the 60ms sweep never forces overlay re-renders while
   *  the user types (that churn is what makes typing feel laggy). */
  const sweepAnims = useCallback(() => {
    const now = Date.now()
    setAnimItems(prev => {
      const next = prev.filter(a => now - a.ts < ANIM_SPARKLE_MS)
      return next.length === prev.length ? prev : next
    })
    setFreshRanges(prev => {
      const next = prev.filter(r => now - r.ts < ANIM_FADE_MS)
      return next.length === prev.length ? prev : next
    })
  }, [])

  /** Sparkle burst where a character was removed (backspace). */
  const triggerSparkles = useCallback(() => {
    if (!animatedEnabled) return
    const ta = taRef.current
    if (!ta) return
    const pos = getCharPosition(ta)
    const id = ++_animId
    const ts = Date.now()
    const sparkles = Array.from({ length: 6 }, (_, i) => ({
      id: id * 100 + i,
      type: 'sparkle',
      x: pos.x, y: pos.y,
      dx: (Math.random() - 0.5) * 30,
      dy: (Math.random() - 0.5) * 20 - 8,
      ts
    }))
    setAnimItems(prev => [...prev, ...sparkles])
    if (!animTimerRef.current) animTimerRef.current = setInterval(sweepAnims, 60)
  }, [animatedEnabled, sweepAnims])

  // Stop sweep timer when nothing left
  useEffect(() => {
    if (animItems.length === 0 && freshRanges.length === 0 && animTimerRef.current) {
      clearInterval(animTimerRef.current)
      animTimerRef.current = null
    }
  }, [animItems.length, freshRanges.length])

  // Cleanup timer on unmount
  useEffect(() => () => { if (animTimerRef.current) clearInterval(animTimerRef.current) }, [])

  // Sync overlay scroll when the feature toggles on or the note changes.
  // The overlay is shifted by the MEASURED structural delta (a div lays
  // out text slightly differently than a textarea) plus the textarea's
  // internal scroll, so the visible glyphs sit exactly on the layout the
  // caret is measured against.
  useEffect(() => {
    const ta = taRef.current
    if (animatedEnabled && ta && overlayInnerRef.current) {
      overlayInnerRef.current.style.transform =
        `translate(${deltaRef.current.dx}px, ${deltaRef.current.dy - ta.scrollTop}px)`
    }
  }, [animatedEnabled, note?.id, overlayGeo])

  // The overlay must lay out EXACTLY like the textarea or lines wrap
  // differently and everything below drifts. Size it to the textarea's
  // own box (offsetLeft/offsetTop/clientWidth/clientHeight) and clone the
  // textarea's computed padding - never a hardcoded value. The textarea's
  // scrollbar steals width, so only clientWidth matches its wrap width.
  useEffect(() => {
    if (!animatedEnabled) { setOverlayGeo(null); return }
    const ta = taRef.current
    const container = editorContainerRef.current
    if (!ta || !container) { setOverlayGeo(null); return }
    const update = () => {
      const cs = getComputedStyle(ta)
      setOverlayGeo({
        left: ta.offsetLeft, top: ta.offsetTop,
        width: ta.clientWidth, height: ta.clientHeight,
        padT: cs.paddingTop, padR: cs.paddingRight,
        padB: cs.paddingBottom, padL: cs.paddingLeft,
      })
      deltaRef.current = overlayCaretDelta(ta, container)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    ro.observe(ta)
    // Fonts can finish loading after mount; re-measure once settled.
    const tid = setTimeout(update, 400)
    return () => { ro.disconnect(); clearTimeout(tid) }
  }, [mode, animatedEnabled, note?.id, editorFont, editorFontSize, editorLineHeight])



  /** Keep the visible text layer scrolled in lockstep with the textarea,
   *  plus the measured overlay offset so the glyphs sit on the textarea's
   *  exact layout. */
  const syncOverlayScroll = () => {
    const ta = taRef.current
    if (ta && overlayInnerRef.current) {
      overlayInnerRef.current.style.transform =
        `translate(${deltaRef.current.dx}px, ${deltaRef.current.dy - ta.scrollTop}px)`
    }
  }

  /** Track whether the user is dragging a selection (show native text then). */
  const handleSelect = () => {
    const ta = taRef.current
    if (!ta) return
    const active = ta.selectionStart !== ta.selectionEnd
    setSelActive(active)
    if (onCursorChange) {
      const pos = ta.selectionStart
      const textBefore = ta.value.slice(0, pos)
      const line = textBefore.split('\n').length
      const lastNewline = textBefore.lastIndexOf('\n')
      onCursorChange({ line, col: pos - lastNewline })
    }
  }

  // --- Undo / Redo history ---
  const historyRef = useRef([]) // [{body, cursor}]
  const historyIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)
  const [historyInfo, setHistoryInfo] = useState({ canUndo: false, canRedo: false })

  // Debounced history: rapid typing coalesces into one entry instead
  // of filling 200 entries in seconds.
  const historyTimerRef = useRef(null)
  const pendingRef = useRef({ body: '', cursor: 0 })

  /** Push a snapshot onto the undo stack immediately. */
  function pushImmediate(newBody, cursor) {
    const idx = historyIndexRef.current
    const stack = historyRef.current
    const next = stack.slice(0, idx + 1)
    next.push({ body: newBody, cursor: cursor || 0 })
    if (next.length > MAX_HISTORY) next.shift()
    historyRef.current = next
    historyIndexRef.current = next.length - 1
    setHistoryInfo({
      canUndo: next.length > 1,
      canRedo: false,
    })
  }

  /** Debounced push: waits 300ms after the last keystroke before
   *  committing, so rapid typing produces one entry not many. */
  const pushHistory = useCallback((newBody, cursor) => {
    if (isUndoRedoRef.current) return
    pendingRef.current = { body: newBody, cursor: cursor || 0 }
    if (historyTimerRef.current) return // already waiting
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null
      if (isUndoRedoRef.current) return
      pushImmediate(pendingRef.current.body, pendingRef.current.cursor)
    }, 300)
  }, [])

  /** Force-flush any pending debounced entry (called on blur/save). */
  const flushHistory = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
      if (!isUndoRedoRef.current) {
        pushImmediate(pendingRef.current.body, pendingRef.current.cursor)
      }
    }
  }, [])

  // Initialise history when note changes. Re-runs when body updates
  // too, because the first body value may be stale (component mounts
  // before the body is fetched from disk). The guard ensures we only
  // re-init for the current note and only when no user edits exist yet.
  const initNoteRef = useRef(null)
  useEffect(() => {
    if (note?.id !== initNoteRef.current) {
      // New note: always initialize
      initNoteRef.current = note?.id
      historyRef.current = [{ body, cursor: 0 }]
      historyIndexRef.current = 0
      isUndoRedoRef.current = false
      setHistoryInfo({ canUndo: false, canRedo: false })
    } else if (historyRef.current.length <= 1 && historyRef.current[0]?.body !== body) {
      // Same note, body arrived but user hasn't typed yet: re-init
      historyRef.current = [{ body, cursor: 0 }]
      historyIndexRef.current = 0
      isUndoRedoRef.current = false
      setHistoryInfo({ canUndo: false, canRedo: false })
    }
  }, [note?.id, body])

  const undo = useCallback(() => {
    flushHistory() // commit any pending entry first
    const idx = historyIndexRef.current
    if (idx <= 0) return
    isUndoRedoRef.current = true
    const prev = historyRef.current[idx - 1]
    historyIndexRef.current = idx - 1
    onBodyChange(prev.body)
    setHistoryInfo({
      canUndo: idx - 1 > 0,
      canRedo: true,
    })
    setTimeout(() => {
      const ta = taRef.current
      if (ta) { ta.selectionStart = ta.selectionEnd = prev.cursor; ta.focus() }
      isUndoRedoRef.current = false
    }, 0)
  }, [onBodyChange, flushHistory])

  const redo = useCallback(() => {
    flushHistory()
    const idx = historyIndexRef.current
    const stack = historyRef.current
    if (idx >= stack.length - 1) return
    isUndoRedoRef.current = true
    const next = stack[idx + 1]
    historyIndexRef.current = idx + 1
    onBodyChange(next.body)
    setHistoryInfo({
      canUndo: true,
      canRedo: idx + 1 < stack.length - 1,
    })
    setTimeout(() => {
      const ta = taRef.current
      if (ta) { ta.selectionStart = ta.selectionEnd = next.cursor; ta.focus() }
      isUndoRedoRef.current = false
    }, 0)
  }, [onBodyChange, flushHistory])

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
    flushHistory()
    setDirty(false)
    onSaveNow()
  }

  const headings = useMemo(() => parseHeadings(body), [body])

  /** Toggle a task checkbox from the rendered preview: body already rewritten. */
  function handleToggleTask(newBody) {
    handleChange(newBody)
  }

  function handleChange(newBody) {
    const ta = taRef.current
    const cursor = ta ? ta.selectionStart : 0
    pushHistory(newBody, cursor)
    onBodyChange(newBody)
    setDirty(true)
    setTyping(true)
    // Animated text: mark inserted chars so they animate in place.
    if (animatedEnabled) {
      const diff = newBody.length - lastBodyLenRef.current
      const ta = taRef.current
      if (diff > 0) {
        const insertStart = ta ? ta.selectionStart - diff : 0
        setFreshRanges(prev => pushFreshRange(prev, insertStart, diff))
        if (!animTimerRef.current) animTimerRef.current = setInterval(sweepAnims, 60)
      } else if (diff < 0) {
        setFreshRanges(prev => cutFreshRanges(prev, ta ? ta.selectionStart : 0, diff))
        triggerSparkles()
      }
    }
    lastBodyLenRef.current = newBody.length
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setTyping(false), 600)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flushRef.current()
    }, AUTOSAVE_DELAY)
    // Wikilink autocomplete: detect [[query near cursor
    updateLinkPopup(newBody, cursor)
  }

  /** Detect whether the cursor sits inside a [[ wikilink and show/
   *  update the autocomplete popup accordingly. */
  function updateLinkPopup(text, cursor) {
    if (!noteNames || Object.keys(noteNames).length === 0) {
      setLinkPopup(null)
      return
    }
    // Walk backwards from cursor to find [[
    const before = text.slice(0, cursor)
    const openBracket = before.lastIndexOf('[[')
    if (openBracket < 0) { setLinkPopup(null); return }
    // Check there's no ]] between [[ and cursor
    const afterOpen = before.slice(openBracket + 2)
    if (afterOpen.includes(']]')) { setLinkPopup(null); return }
    // Check we're still on the same line (no newline between [[ and cursor)
    if (afterOpen.includes('\n')) { setLinkPopup(null); return }
    const query = afterOpen.toLowerCase()
    const matches = Object.keys(noteNames)
      .filter(t => t.toLowerCase().includes(query) && t.toLowerCase() !== (body.slice(openBracket + 2, cursor).toLowerCase()))
      .slice(0, 8)
    if (matches.length === 0) { setLinkPopup(null); return }
    // Position: approximate from cursor offset in textarea
    const ta = taRef.current
    if (!ta) { setLinkPopup(null); return }
    // Use a hidden span to measure character position
    const rect = ta.getBoundingClientRect()
    const lines = before.split('\n')
    const lineIdx = lines.length - 1
    const colIdx = lines[lineIdx].length
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || LINE_HEIGHT
    const charWidth = 7.5 // approximate for monospace at editorFontSize
    const top = rect.top + (lineIdx * lineHeight) - ta.scrollTop + lineHeight + 4
    const left = rect.left + (colIdx * charWidth) - ta.scrollLeft + 8
    setLinkPopup({ query, index: 0, pos: { top, left } })
  }

  /** Insert the selected wikilink at the cursor, closing the popup. */
  function insertWikilink(title) {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: cursor, value } = ta
    const before = value.slice(0, cursor)
    const openBracket = before.lastIndexOf('[[')
    if (openBracket < 0) return
    // Replace from [[ to cursor with [[Title]]
    const after = value.slice(cursor)
    const link = `[[${title}]]`
    const newVal = value.slice(0, openBracket) + link + after
    const newPos = openBracket + link.length
    handleChange(newVal)
    setLinkPopup(null)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = newPos
      ta.focus()
    }, 0)
  }

  function jumpTo(offset, index) {
    const ta = taRef.current
    if (!ta) return
    const before = body.slice(0, offset)
    const lineIndex = before.split('\n').length - 1
    ta.focus()
    ta.selectionStart = ta.selectionEnd = offset
    skipScrollRef.current = true
    ta.scrollTop = Math.max(0, lineIndex * LINE_HEIGHT - 40)
    setCurrentHeading(index)
    setTimeout(() => { skipScrollRef.current = false }, 100)
  }

  function onScroll() {
    syncOverlayScroll()
    if (skipScrollRef.current) return
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
    // Wikilink autocomplete keyboard navigation
    if (linkPopup && mode === 'edit') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setLinkPopup(prev => prev ? { ...prev, index: Math.min(prev.index + 1, (Object.keys(noteNames).filter(t => t.toLowerCase().includes(prev.query)).slice(0, 8).length - 1)) } : prev)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setLinkPopup(prev => prev ? { ...prev, index: Math.max(prev.index - 1, 0) } : prev)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const matches = Object.keys(noteNames).filter(t => t.toLowerCase().includes(linkPopup.query)).slice(0, 8)
        if (matches[linkPopup.index]) insertWikilink(matches[linkPopup.index])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setLinkPopup(null)
        return
      }
    }

    // Enter in table: insert new row with same column count
    if (e.key === 'Enter' && mode === 'edit' && !linkPopup) {
      const ta = taRef.current
      if (ta) {
        const { selectionStart: pos, value } = ta
        const ls = value.lastIndexOf('\n', pos - 1) + 1
        const le = value.indexOf('\n', pos)
        const line = value.slice(ls, le === -1 ? value.length : le)
        const isSep = /^\s*\|[\s\-:|]+\|\s*$/.test(line)
        if (line.includes('|') && !isSep) {
          const pipes = []
          for (let i = 0; i < line.length; i++) if (line[i] === '|') pipes.push(i)
          if (pipes.length >= 2) {
            e.preventDefault()
            const cols = pipes.length - 1
            const insertAt = le === -1 ? value.length : le
            const newRow = '\n| ' + Array(cols).fill('Cell').join(' | ') + ' |'
            const nv = value.slice(0, insertAt) + newRow + value.slice(insertAt)
            const newPos = insertAt + 3
            pushHistory(nv, newPos)
            onBodyChange(nv)
            setDirty(true)
            setTimeout(() => { ta.selectionStart = ta.selectionEnd = newPos }, 0)
            return
          }
        }
      }
    }

    // Ctrl+S save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      flushRef.current()
      return
    }

    // Ctrl+Shift+I insert image
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault()
      fileInputRef.current?.click()
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

    // Tab: table cell navigation or indent/outdent
    if (e.key === 'Tab' && mode === 'edit') {
      e.preventDefault()
      const ta = taRef.current
      if (!ta) return
      const { selectionStart: start, selectionEnd: end, value } = ta

      // Try table cell navigation first
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd = value.indexOf('\n', start)
      const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd)
      const isSep = /^\s*\|[\s\-:|]+\|\s*$/.test(line)

      if (line.includes('|') && !isSep && start === end) {
        // Cursor not in a selection: table navigation
        const pipes = []
        for (let i = 0; i < line.length; i++) if (line[i] === '|') pipes.push(i)
        if (pipes.length >= 2) {
          const cp = start - lineStart
          if (e.shiftKey) {
            // Previous cell
            let pp = -1
            for (let i = pipes.length - 1; i >= 0; i--) {
              if (pipes[i] < cp - 1) { pp = pipes[i]; break }
            }
            if (pp >= 0) {
              const after = line.slice(pp + 1)
              const sp = after.match(/^\s+/)
              ta.selectionStart = ta.selectionEnd = lineStart + pp + 1 + (sp ? sp[0].length : 0)
              return
            }
            // First cell -> previous row last cell
            const prevEnd = lineStart - 1
            const prevStart = value.lastIndexOf('\n', prevEnd - 1) + 1
            const prev = value.slice(prevStart, prevEnd)
            if (prev.includes('|') && !/^\s*\|[\s\-:|]+\|\s*$/.test(prev)) {
              const pp2 = []
              for (let i = 0; i < prev.length; i++) if (prev[i] === '|') pp2.push(i)
              if (pp2.length >= 2) {
                const lk = pp2[pp2.length - 2]
                const after2 = prev.slice(lk + 1)
                const sp2 = after2.match(/^\s+/)
                ta.selectionStart = ta.selectionEnd = prevStart + lk + 1 + (sp2 ? sp2[0].length : 0)
                return
              }
            }
          } else {
            // Next cell
            let np = -1
            for (let i = 0; i < pipes.length; i++) {
              if (pipes[i] > cp) { np = pipes[i]; break }
            }
            if (np >= 0) {
              const after = line.slice(np + 1)
              const sp = after.match(/^\s+/)
              ta.selectionStart = ta.selectionEnd = lineStart + np + 1 + (sp ? sp[0].length : 0)
              return
            }
            // Last cell -> next row first cell or new row
            const nxStart = (lineEnd === -1 ? value.length : lineEnd) + 1
            const nxEnd = value.indexOf('\n', nxStart)
            const nx = value.slice(nxStart, nxEnd === -1 ? value.length : nxEnd)
            if (nx.includes('|') && !/^\s*\|[\s\-:|]+\|\s*$/.test(nx)) {
              const np2 = []
              for (let i = 0; i < nx.length; i++) if (nx[i] === '|') np2.push(i)
              if (np2.length >= 2) {
                const af = nx.slice(np2[0] + 1)
                const sp2 = af.match(/^\s+/)
                ta.selectionStart = ta.selectionEnd = nxStart + np2[0] + 1 + (sp2 ? sp2[0].length : 0)
                return
              }
            }
            // Insert new row with same column count
            const cols = pipes.length - 1
            const insertAt = lineEnd === -1 ? value.length : lineEnd
            const newRow = '\n| ' + Array(cols).fill('Cell').join(' | ') + ' |'
            const nv = value.slice(0, insertAt) + newRow + value.slice(insertAt)
            const newPos = insertAt + 3
            pushHistory(nv, newPos)
            onBodyChange(nv)
            setDirty(true)
            setTimeout(() => { ta.selectionStart = ta.selectionEnd = newPos }, 0)
            return
          }
        }
      }

      // Not in table (or selection): indent/outdent
      if (e.shiftKey) {
        const before = value.slice(0, start)
        const ls = before.lastIndexOf('\n') + 1
        const selected = value.slice(ls, end)
        const outdented = selected.replace(/^ {1,2}/gm, '')
        const diff = selected.length - outdented.length
        const newVal = value.slice(0, ls) + outdented + value.slice(end)
        pushHistory(newVal, start - Math.min(2, start - ls))
        onBodyChange(newVal)
        setDirty(true)
        setTimeout(() => {
          ta.selectionStart = start - Math.min(2, start - ls)
          ta.selectionEnd = end - diff
        }, 0)
      } else {
        const before = value.slice(0, start)
        const ls = before.lastIndexOf('\n') + 1
        const selected = value.slice(ls, end)
        const indented = '  ' + selected.replace(/\n/g, '\n  ')
        const diff = indented.length - selected.length
        const newVal = value.slice(0, ls) + indented + value.slice(end)
        pushHistory(newVal, start + 2)
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
        pushHistory(result.value, result.start)
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

  /** Shared: import a File into the vault, insert `![alt](...)` at the
   *  caret (or where the drop landed). The md stays portable: the src
   *  is vault-relative (`.glean/assets/...`), never an absolute path
   *  or base64 blob. Returns true when the image landed. */
  async function insertImageForFile(file, dropPos) {
    const ta = taRef.current
    if (!ta || !window.go?.main?.App?.ImportImage || !file) return false
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
    // Relative to this note's folder: src is `.glean/assets/...` when
    // the note is at vault root, or `../.glean/assets/...` relative to
    // a note inside a subfolder.
    const folderDepth = (note.folder || '').split('/').filter(Boolean).length
    const prefix = folderDepth > 0 ? '../'.repeat(folderDepth) : ''
    const src = prefix + rel.replace(/^\/\.glean\//, '.glean/')
    const escaped = src.replace(/[()\s]/g, c => c === ' ' ? '%20' : ('\\' + c))
    const md = `![${alt}](${escaped})`
    const s = dropPos != null ? dropPos : ta.selectionStart
    const e = dropPos != null ? dropPos : ta.selectionEnd
    const value = ta.value
    handleChange(value.slice(0, s) + md + value.slice(e))
    setDirty(true)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = s + md.length
      ta.focus()
    }, 0)
    return true
  }

  /** Handle a dropped file / pasted blob list: import the first image. */
  async function insertDroppedFiles(files, dropPos) {
    const img = Array.from(files || []).find(f => f && f.type && f.type.startsWith('image/'))
    if (img) await insertImageForFile(img, dropPos)
  }

  /** Paste handler: if the clipboard holds an image, import it; else
   *  let the native text paste run. */
  async function handleTextareaPaste(e) {
    const items = (e.clipboardData && e.clipboardData.items) || []
    const img = Array.from(items).find(it => it.kind === 'file' && it.type && it.type.startsWith('image/'))
    if (img) {
      e.preventDefault()
      const file = img.getAsFile()
      if (file) await insertImageForFile(file)
      return
    }
    // No image: fall through to the browser's default text paste.
  }

  /** Drop handler: import the first image file at the drop location. */
  function handleTextareaDrop(e) {
    const files = e.dataTransfer && e.dataTransfer.files
    if (!files || files.length === 0) return
    e.preventDefault()
    const ta = taRef.current
    if (!ta) return
    // Place the caret at the drop point so the image lands there.
    const rect = ta.getBoundingClientRect()
    let start = ta.selectionStart
    try {
      if (document.caretPositionFromPoint) {
        const cp = document.caretPositionFromPoint(e.clientX, e.clientY)
        if (cp && cp.offsetNode === ta) start = cp.offset
      } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY)
        if (range) start = range.startOffset
      }
    } catch { /* keep caret */ }
    insertDroppedFiles(files, start)
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
    { id: 'insert', label: 'Insert', icon: 'plus', submenu: [
      { id: 'ins-link', label: 'Link', icon: 'link', shortcut: 'Ctrl+K', onSelect: insertLink },
      { id: 'ins-table', label: 'Table', icon: 'table', onSelect: insertTable },
      { id: 'ins-image', label: 'Image', icon: 'image', shortcut: 'Ctrl+Shift+I',
        onSelect: () => fileInputRef.current?.click() },
    ] },
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
    syncOverlayScroll()
    // Sync preview scroll proportionally
    const ta = taRef.current
    const pv = previewRef.current
    if (!ta || !pv) return
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1)
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight)
  }

  /** Reverse sync: scrolling the preview proportionally scrolls the
   *  editor so both panes stay aligned. */
  function handlePreviewScroll() {
    const ta = taRef.current
    const pv = previewRef.current
    if (!ta || !pv) return
    const ratio = pv.scrollTop / (pv.scrollHeight - pv.clientHeight || 1)
    ta.scrollTop = ratio * (ta.scrollHeight - ta.clientHeight)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, flex: 1, position: 'relative' }}>
      {animatedEnabled && (
        <style>{`
          @keyframes charDrop {
            0% { opacity: 0; transform: translateY(-10px); }
            60% { opacity: 1; transform: translateY(0); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes charFade {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes charPop {
            0% { opacity: 0; transform: scale(0.4); }
            60% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
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

        {/* Undo / Redo / Insert image */}
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
            <button type="button" onClick={() => fileInputRef.current?.click()} data-tip="Insert image (Ctrl+Shift+I)"
              style={{ ...toolbarBtn, color: colors.textMuted }}>
              <Icon name="image" size={14} />
            </button>
          </div>
        )}

        {/* Hidden image picker for Insert image */}
        <input ref={fileInputRef} type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            if (f) insertImageForFile(f)
            e.target.value = ''
          }} />

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

      {/* Editor area. minWidth: 0 is critical: without it a flex row
          child refuses to shrink below its content, so an unbroken wall
          of text in the preview stretches the row and the editor column
          gets pushed off-screen (and the UI follows). */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {/* Outline (edit mode only, not split) */}
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

        {/* Content area */}
        {mode === 'split' ? (
          /* Split view: textarea left, preview right */
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div ref={editorContainerRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {(mode === 'edit' || mode === 'split') && prefs.editor.cursor_trail_enabled !== false && prefs.editor.cursor_trail_mode !== 'off' && (
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
                onSelect={handleSelect}
                onClick={updateCursor}
                onKeyUp={updateCursor}
                onBlur={() => setSelActive(false)}
                onPaste={handleTextareaPaste}
                onDrop={handleTextareaDrop}
                placeholder="Write, the night holds what you seek."
                style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
                  background: 'transparent', border: 'none',
                  color: animatedEnabled && !selActive && body.length > 0 ? 'transparent' : colors.text,
                  caretColor: colors.text,
                  fontFamily: editorFont, fontSize: editorFontSize, lineHeight: editorLineHeight, padding: space[3],
                  overflowWrap: 'break-word',
                  transition: 'box-shadow 0.6s ease-out',
                  boxShadow: typing ? `inset 0 0 30px rgba(180, 140, 80, 0.06)` : 'none' }}
              />
              {linkPopup && (() => {
                const matches = Object.keys(noteNames)
                  .filter(t => t.toLowerCase().includes(linkPopup.query))
                  .slice(0, 8)
                if (matches.length === 0) return null
                return (
                  <div ref={linkPopupRef}
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
              {animatedEnabled && overlayGeo && (
                <div aria-hidden="true"
                  style={{ position: 'absolute', left: overlayGeo.left, top: overlayGeo.top,
                    width: overlayGeo.width, height: overlayGeo.height, boxSizing: 'border-box',
                    overflow: 'hidden', pointerEvents: 'none',
                    padding: `${overlayGeo.padT} ${overlayGeo.padR} ${overlayGeo.padB} ${overlayGeo.padL}`,
                    color: colors.text, fontFamily: editorFont, fontSize: editorFontSize,
                    lineHeight: editorLineHeight, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
                    display: selActive ? 'none' : 'block' }}>
                  <div ref={overlayInnerRef} style={{ transform: 'translateY(0px)', willChange: 'transform' }}>
                    {renderSegments(body, freshRanges, typingStyle)}
                  </div>
                </div>
              )}
              {animatedEnabled && animItems.map(a => (
                <AnimItem key={a.id} a={a} accent={colors.accent} />
              ))}
              </ContextMenu>
            </div>
            <div style={{ width: 1, background: colors.border, flexShrink: 0 }} />
            <div ref={previewRef} onScroll={handlePreviewScroll}
              style={{ flex: 1, minWidth: 0, overflow: 'auto',
              overflowWrap: 'anywhere',
              padding: space[3], color: colors.text, lineHeight: prefs.editor.line_height || 1.6 }}>
              {renderMarkdown(body, { onToggle: handleToggleTask, noteNames, onNoteLink: handleNoteLink })}
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
              <div style={{ color: colors.text, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{renderMarkdown(body, { onToggle: handleToggleTask, noteNames, onNoteLink: handleNoteLink })}</div>
            ) : (
              <>
              {(mode === 'edit') && prefs.editor.cursor_trail_enabled !== false && prefs.editor.cursor_trail_mode !== 'off' && (
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
                onSelect={handleSelect}
                onClick={updateCursor}
                onKeyUp={updateCursor}
                onBlur={() => setSelActive(false)}
                onPaste={handleTextareaPaste}
                onDrop={handleTextareaDrop}
                placeholder="Write, the night holds what you seek."
                style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
                  background: 'transparent', border: 'none', padding: 0,
                  color: animatedEnabled && !selActive && body.length > 0 ? 'transparent' : colors.text,
                  caretColor: colors.text,
                  fontFamily: editorFont, fontSize: editorFontSize, lineHeight: editorLineHeight,
                  overflowWrap: 'break-word' }}
              />
              {linkPopup && (() => {
                const matches = Object.keys(noteNames)
                  .filter(t => t.toLowerCase().includes(linkPopup.query))
                  .slice(0, 8)
                if (matches.length === 0) return null
                return (
                  <div ref={linkPopupRef}
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
              {animatedEnabled && overlayGeo && (
                <div aria-hidden="true"
                  style={{ position: 'absolute', left: overlayGeo.left, top: overlayGeo.top,
                    width: overlayGeo.width, height: overlayGeo.height, boxSizing: 'border-box',
                    overflow: 'hidden', pointerEvents: 'none',
                    padding: `${overlayGeo.padT} ${overlayGeo.padR} ${overlayGeo.padB} ${overlayGeo.padL}`,
                    color: colors.text, fontFamily: editorFont, fontSize: editorFontSize,
                    lineHeight: editorLineHeight, whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
                    display: selActive ? 'none' : 'block' }}>
                  <div ref={overlayInnerRef} style={{ transform: 'translateY(0px)', willChange: 'transform' }}>
                    {renderSegments(body, freshRanges, typingStyle)}
                  </div>
                </div>
              )}
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
