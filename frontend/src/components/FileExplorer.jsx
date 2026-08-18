import { useMemo, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

export default function FileExplorer({ notes, activeId, onOpenNote, onExpand, skyName }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha') // alpha | recent

  const q = query.trim().toLowerCase()

  const sorted = useMemo(() => {
    let list = [...notes]
    if (q) list = list.filter(n => n.title.toLowerCase().includes(q))
    if (sort === 'recent') {
      list.sort((a, b) => {
        const ta = a.last_visited || a.created_at || ''
        const tb = b.last_visited || b.created_at || ''
        return tb.localeCompare(ta)
      })
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return list
  }, [notes, q, sort])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: `${space[2]}px ${space[2]}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted, textTransform: 'uppercase',
            letterSpacing: '0.08em', fontSize: 11 }}>
            {skyName || 'Sky'}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button type="button" onClick={() => setSort(s => s === 'alpha' ? 'recent' : 'alpha')}
              title={sort === 'alpha' ? 'Sort by recent' : 'Sort alphabetically'}
              style={{ background: 'none', border: 'none', color: colors.textMuted,
                cursor: 'pointer', padding: 2, display: 'flex' }}>
              <Icon name={sort === 'alpha' ? 'star' : 'pencil'} size={12} />
            </button>
            <button type="button" onClick={onExpand} aria-label="open sky view" title="Open Sky"
              style={{ background: 'none', border: 'none', color: colors.textMuted,
                cursor: 'pointer', padding: 2, display: 'flex' }}>
              <Icon name="maximize" size={13} />
            </button>
          </div>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter files..."
          style={{ width: '100%', background: colors.bg, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 10px',
            fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* File list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `${space[1]}px 0` }}>
        {sorted.length === 0 ? (
          <div style={{ padding: `0 ${space[2]}px`, fontSize: 12, color: colors.textDim }}>
            {q ? 'No matching files.' : 'No notes yet.'}
          </div>
        ) : (
          sorted.map(note => {
            const active = note.id === activeId
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => onOpenNote(note.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '4px 12px',
                  background: active ? colors.bg : 'transparent',
                  border: 'none',
                  borderLeft: active ? `2px solid ${colors.accent}` : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 120ms ease-out',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = `${colors.bg}` }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <StarIcon species={note.species} size="sm" />
                <span style={{
                  color: active ? colors.text : colors.textMuted,
                  fontSize: 13,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: active ? 500 : 400,
                }}>
                  {note.title}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* Footer: file count */}
      <div style={{ padding: `${space[1]}px ${space[2]}px`, borderTop: `1px solid ${colors.border}`,
        fontSize: 11, color: colors.textDim }}>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </div>
    </div>
  )
}
