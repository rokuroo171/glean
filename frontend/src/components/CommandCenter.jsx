import { useEffect, useMemo, useRef, useState } from 'react'
import { colors } from '../lib/theme'
import StarIcon from './StarIcon'

export default function CommandCenter({ notes, onOpen, onCreate, onClose }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(n => n.title.toLowerCase().includes(q))
  }, [notes, query])

  useEffect(() => { setIndex(0) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  function choose(n) { onOpen(n.id); onClose() }

  function submit() {
    if (results.length > 0) {
      choose(results[Math.min(index, results.length - 1)])
    } else if (query.trim()) {
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
            placeholder="Search the sky"
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
              {query.trim()
                ? <>No star named <span style={{ color: colors.text }}>{query.trim()}</span>. Press Enter to create it.</>
                : 'No notes in this sky yet'}
            </div>
          ) : results.map((n, i) => (
            <div key={n.id} onClick={() => choose(n)} onMouseEnter={() => setIndex(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                cursor: 'pointer', background: i === index ? 'rgba(90,106,122,0.18)' : 'none' }}>
              <StarIcon species={n.species} size="sm" />
              <span style={{ color: colors.text, fontSize: 12, flex: 1, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
              <span style={{ color: colors.textMuted, fontSize: 11 }}>{n.stage}</span>
            </div>
          ))}
        </div>
        {results.length > 0 && (
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${colors.border}`,
            color: colors.textMuted, fontSize: 11 }}>
            ↑↓ to move · Enter to open · Esc to close
          </div>
        )}
      </div>
    </div>
  )
}
