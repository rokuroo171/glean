import { useEffect, useMemo, useRef, useState } from 'react'
import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

const actions = [
  { id: 'customize', label: 'Open Customization', icon: 'palette', section: 'Actions' },
  { id: 'settings', label: 'Open Settings', icon: 'settings', section: 'Actions' },
  { id: 'stats', label: 'Sky Overview', icon: 'bar-chart', section: 'Actions' },
  { id: 'new-note', label: 'New Note', icon: 'plus', section: 'Actions' },
  { id: 'full-sky', label: 'Full Sky View', icon: 'sparkles', section: 'Actions' },
]

export default function CommandCenter({ notes, onOpen, onCreate, onClose, onAction }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)

  const q = query.trim().toLowerCase()

  const matchedNotes = useMemo(() => {
    if (!q) return notes.slice(0, 8)
    return notes.filter(n => n.title.toLowerCase().includes(q))
  }, [notes, q])

  const matchedActions = useMemo(() => {
    if (!q) return actions
    return actions.filter(a => a.label.toLowerCase().includes(q))
  }, [q])

  const results = useMemo(() => {
    const items = []
    if (matchedActions.length > 0) {
      for (const a of matchedActions) items.push({ type: 'action', ...a })
    }
    if (matchedNotes.length > 0) {
      for (const n of matchedNotes) items.push({ type: 'note', ...n })
    }
    return items
  }, [matchedActions, matchedNotes])

  useEffect(() => { setIndex(0) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  function choose(item) {
    if (item.type === 'action') {
      if (onAction) onAction(item.id)
    } else {
      onOpen(item.id)
    }
    onClose()
  }

  function submit() {
    if (results.length > 0) {
      choose(results[Math.min(index, results.length - 1)])
    } else if (q) {
      onCreate(query.trim())
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ position: 'fixed', top: 46, left: '50%', transform: 'translateX(-50%)',
        width: 420, maxWidth: '90vw', background: colors.bgElevated,
        border: `1px solid ${colors.borderStrong}`, borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderBottom: `1px solid ${colors.border}` }}>
          <svg width={13} height={13} viewBox="0 0 12 12" fill="none">
            <circle cx={5} cy={5} r={3.5} stroke={colors.textMuted} strokeWidth={1.2} />
            <path d="M8 8l3 3" stroke={colors.textMuted} strokeWidth={1.2} />
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or run a command"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); submit() }
              else if (e.key === 'Escape') onClose()
            }}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: colors.text, fontSize: 13 }} />
          <span style={{ color: colors.textMuted, fontSize: 11 }}>esc</span>
        </div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: colors.textMuted }}>
              {q
                ? <>No match for <span style={{ color: colors.text }}>{query.trim()}</span>. Press Enter to create a note.</>
                : 'No notes or commands available'}
            </div>
          ) : (
            <>
              {matchedActions.length > 0 && (
                <div style={{ padding: '6px 12px', fontSize: 10, color: colors.textDim,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Commands
                </div>
              )}
              {results.map((item, i) => {
                if (item.type === 'action') {
                  return (
                    <div key={`a-${item.id}`} onClick={() => choose(item)}
                      onMouseEnter={() => setIndex(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        cursor: 'pointer', background: i === index ? 'rgba(90,106,122,0.18)' : 'none' }}>
                      <Icon name={item.icon} size={14} style={{ color: colors.accent }} />
                      <span style={{ color: colors.text, fontSize: 12, flex: 1 }}>{item.label}</span>
                    </div>
                  )
                }
                return (
                  <div key={item.id} onClick={() => choose(item)}
                    onMouseEnter={() => setIndex(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      cursor: 'pointer', background: i === index ? 'rgba(90,106,122,0.18)' : 'none' }}>
                    <StarIcon species={item.species} size="sm" />
                    <span style={{ color: colors.text, fontSize: 12, flex: 1, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ color: colors.textMuted, fontSize: 11 }}>{item.stage}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
        {results.length > 0 && (
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${colors.border}`,
            color: colors.textMuted, fontSize: 11 }}>
            ↑↓ to move · Enter to select · Esc to close
          </div>
        )}
      </div>
    </div>
  )
}
