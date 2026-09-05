import { useState, useEffect, useRef, useCallback } from 'react'
import { colors } from '../lib/theme'
import Icon from './Icon'

export default function FindReplace({ body, taRef, showReplace, onClose }) {
  const [query, setQuery] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [matchIdx, setMatchIdx] = useState(-1)
  const [matches, setMatches] = useState([])
  const inputRef = useRef(null)

  // Find all matches
  useEffect(() => {
    if (!query) { setMatches([]); setMatchIdx(-1); return }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const found = []
    let m
    while ((m = regex.exec(body)) !== null) {
      found.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
      if (found.length > 5000) break
    }
    setMatches(found)
    setMatchIdx(found.length > 0 ? 0 : -1)
  }, [query, body])

  // Select and scroll to current match
  useEffect(() => {
    if (matchIdx < 0 || matchIdx >= matches.length) return
    const ta = taRef?.current
    if (!ta) return
    const m = matches[matchIdx]
    ta.focus()
    ta.setSelectionRange(m.start, m.end)
    // Scroll match into view
    const linesBefore = body.slice(0, m.start).split('\n').length - 1
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22
    const targetTop = linesBefore * lineHeight - ta.clientHeight / 3
    ta.scrollTop = Math.max(0, targetTop)
  }, [matchIdx, matches, body, taRef])

  const next = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx(i => (i + 1) % matches.length)
  }, [matches.length])

  const prev = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx(i => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

  const replaceOne = useCallback(() => {
    if (matchIdx < 0 || matchIdx >= matches.length) return
    const ta = taRef?.current
    if (!ta) return
    const m = matches[matchIdx]
    const before = body.slice(0, m.start)
    const after = body.slice(m.end)
    const newBody = before + replaceWith + after
    // Trigger onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set
    nativeInputValueSetter.call(ta, newBody)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }, [matchIdx, matches, body, replaceWith, taRef])

  const replaceAll = useCallback(() => {
    if (matches.length === 0 || !query) return
    const ta = taRef?.current
    if (!ta) return
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const newBody = body.replace(regex, replaceWith)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set
    nativeInputValueSetter.call(ta, newBody)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }, [query, replaceWith, body, matches.length, taRef])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Keyboard: Escape closes, Enter navigates
  const handleKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prev() : next() }
    e.stopPropagation()
  }

  const inputStyle = {
    background: 'transparent', border: 'none', outline: 'none',
    color: colors.text, fontSize: 13, fontFamily: 'inherit',
    width: showReplace ? 180 : 220, padding: '4px 0',
  }

  const btnStyle = {
    background: 'none', border: 'none', color: colors.textMuted,
    cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
  }

  const activeBtn = {
    ...btnStyle, color: colors.accent,
  }

  return (
    <div onKeyDown={handleKey}
      style={{ display: 'flex', flexDirection: 'column', gap: 4,
        padding: '6px 12px', borderBottom: '1px solid ' + colors.border,
        background: colors.bgCard, flexShrink: 0 }}>
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="search" size={14} color={colors.textMuted} />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Find..." style={inputStyle} />
        <span style={{ fontSize: 11, color: colors.textDim, minWidth: 50, textAlign: 'right' }}>
          {query ? (matches.length > 0 ? `${matchIdx + 1}/${matches.length}` : 'No results') : ''}
        </span>
        <button type="button" onClick={prev} style={btnStyle} title="Previous (Shift+Enter)">
          <Icon name="chevron-up" size={14} />
        </button>
        <button type="button" onClick={next} style={btnStyle} title="Next (Enter)">
          <Icon name="chevron-down" size={14} />
        </button>
        <div style={{ width: 1, height: 16, background: colors.border, margin: '0 2px' }} />
        <button type="button" onClick={onClose} style={btnStyle} title="Close (Escape)">
          <Icon name="x" size={14} />
        </button>
      </div>
      {/* Replace row */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="replace" size={14} color={colors.textMuted} />
          <input value={replaceWith} onChange={e => setReplaceWith(e.target.value)}
            placeholder="Replace..." style={inputStyle} />
          <button type="button" onClick={replaceOne} style={btnStyle}
            disabled={matchIdx < 0} title="Replace">
            <Icon name="replace" size={13} />
          </button>
          <button type="button" onClick={replaceAll} style={btnStyle}
            disabled={matches.length === 0} title="Replace all">
            <Icon name="replace" size={13} />
            <span style={{ fontSize: 10, marginLeft: 1 }}>All</span>
          </button>
        </div>
      )}
    </div>
  )
}
