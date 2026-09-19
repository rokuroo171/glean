import { useState, useEffect, useRef, useCallback } from 'react'
import { colors } from '../lib/theme'
import { findMatches, selectMatch, replaceMatch, replaceAllMatches } from '../lib/findInDoc'
import Icon from './Icon'

// Find bar over the live ProseMirror view, reached through getView. The
// view is re-read on every call because the editor instance can be
// re-created (note switch remount) without the bar remounting
export default function FindReplace({ getView, body, showReplace, onClose, onToggleReplace }) {
  const [query, setQuery] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const [matches, setMatches] = useState([])
  const [caseSensitive, setCaseSensitive] = useState(false)
  const inputRef = useRef(null)
  const replaceInputRef = useRef(null)

  const view = () => getView?.()

  useEffect(() => {
    const doc = view()?.state.doc
    setMatches(query && doc ? findMatches(doc, query, caseSensitive) : [])
    if (!query) setMatchIdx(0)
    // body is the serialized markdown; its changes track edits made through
    // the replace actions so the match list stays current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive, body])

  const current = matches.length > 0 ? matches[Math.min(matchIdx, matches.length - 1)] : null

  useEffect(() => {
    const v = view()
    const sel = v?.state.selection
    // no focus: typing in the find input must not yank the caret into the
    // editor, the highlight and scroll happen from the background
    if (v && current && !(sel.from === current.from && sel.to === current.to)) {
      selectMatch(v, current, { focus: false })
    }
  }, [matchIdx, matches])

  const next = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx((i) => (i + 1) % matches.length)
  }, [matches.length])

  const prev = useCallback(() => {
    if (matches.length === 0) return
    setMatchIdx((i) => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

  const replaceOne = useCallback(() => {
    replaceMatch(view(), current, replaceWith)
  }, [current, replaceWith])

  const replaceAll = useCallback(() => {
    replaceAllMatches(view(), matches, replaceWith)
  }, [matches, replaceWith])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.shiftKey ? prev() : next()
    } else if (e.key === 'f' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (onToggleReplace) onToggleReplace()
      else replaceInputRef.current?.focus()
    }
  }

  const inputStyle = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: colors.text,
    fontSize: 13,
    fontFamily: 'inherit',
    width: showReplace ? 180 : 220,
    padding: '4px 0',
  }

  const btnStyle = {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  }

  const activeBtn = { ...btnStyle, color: colors.accent }

  return (
    <div
      onKeyDown={handleKey}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 12px',
        borderBottom: '1px solid ' + colors.border,
        background: colors.bgCard,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="search" size={14} color={colors.textMuted} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find..."
          style={inputStyle}
        />
        <span style={{ fontSize: 11, color: colors.textDim, minWidth: 50, textAlign: 'right' }}>
          {query ? (matches.length > 0 ? `${Math.min(matchIdx, matches.length - 1) + 1}/${matches.length}` : 'No results') : ''}
        </span>
        <button
          type="button"
          onClick={() => setCaseSensitive((v) => !v)}
          style={caseSensitive ? activeBtn : { ...btnStyle, fontSize: 11, fontWeight: 600 }}
          title="Match case"
        >
          Aa
        </button>
        <button type="button" onClick={prev} style={btnStyle} title="Previous (Shift+Enter)">
          <Icon name="chevron-up" size={14} />
        </button>
        <button type="button" onClick={next} style={btnStyle} title="Next (Enter)">
          <Icon name="chevron-down" size={14} />
        </button>
        <button type="button" onClick={onToggleReplace} style={showReplace ? activeBtn : btnStyle} title="Toggle replace (Ctrl+H)">
          <Icon name="replace" size={14} />
        </button>
        <div style={{ width: 1, height: 16, background: colors.border, margin: '0 2px' }} />
        <button type="button" onClick={onClose} style={btnStyle} title="Close (Escape)">
          <Icon name="x" size={14} />
        </button>
      </div>
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="replace" size={14} color={colors.textMuted} />
          <input
            ref={replaceInputRef}
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="Replace..."
            style={inputStyle}
          />
          <button type="button" onClick={replaceOne} style={btnStyle} disabled={!current} title="Replace">
            <Icon name="replace" size={13} />
          </button>
          <button type="button" onClick={replaceAll} style={btnStyle} disabled={matches.length === 0} title="Replace all">
            <Icon name="replace" size={13} />
            <span style={{ fontSize: 10, marginLeft: 1 }}>All</span>
          </button>
        </div>
      )}
    </div>
  )
}
