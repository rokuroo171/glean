import { useState, useEffect, useRef, useCallback } from 'react'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { colors } from '../lib/theme'
import Icon from './Icon'

export default function FindReplace({ viewRef, showReplace, onClose }) {
  const [query, setQuery] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [matchIdx, setMatchIdx] = useState(-1)
  const [matches, setMatches] = useState([])
  const inputRef = useRef(null)

  const view = () => viewRef?.current
  const body = () => view()?.state.doc.toString() || ''

  // Find all matches
  useEffect(() => {
    if (!query) { setMatches([]); setMatchIdx(-1); return }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const found = []
    const text = body()
    let m
    while ((m = regex.exec(text)) !== null) {
      found.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
      if (found.length > 5000) break
    }
    setMatches(found)
    setMatchIdx(found.length > 0 ? 0 : -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, viewRef?.current?.state?.doc])

  // Select and scroll to current match
  useEffect(() => {
    if (matchIdx < 0 || matchIdx >= matches.length) return
    const v = view()
    if (!v) return
    const m = matches[matchIdx]
    v.dispatch({
      selection: EditorSelection.single(m.start, m.end),
      effects: EditorView.scrollIntoView(m.start, { y: 'center' }),
    })
    v.focus()
  }, [matchIdx, matches, viewRef])

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
    const v = view()
    if (!v) return
    const m = matches[matchIdx]
    v.dispatch({
      changes: { from: m.start, to: m.end, insert: replaceWith },
      selection: EditorSelection.cursor(m.start + replaceWith.length),
    })
    v.focus()
  }, [matchIdx, matches, replaceWith, viewRef])

  const replaceAll = useCallback(() => {
    if (matches.length === 0 || !query) return
    const v = view()
    if (!v) return
    const changes = matches
      .map(m => ({ from: m.start, to: m.end, insert: replaceWith }))
      .reverse()
    v.dispatch({ changes })
    v.focus()
  }, [query, replaceWith, matches, viewRef])

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