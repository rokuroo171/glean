import { useEffect, useMemo, useRef, useState } from 'react'
import { colors } from '../lib/theme'
import { filterCommands } from '../lib/commands'
import StarIcon from './StarIcon'
import Icon from './Icon'

// One shell, two surfaces. mode 'commands' runs the registry Workspace
// builds; mode 'notes' is the files-only quick switcher. Ctrl+K opens the
// first, Ctrl+O the second.
export default function CommandCenter({ mode, commands = [], notes = [], onOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const items = useMemo(() => {
    if (mode === 'notes') return filterCommands(notes.map(n => ({ ...n, label: n.title })), query)
    return filterCommands(commands, query)
  }, [mode, commands, notes, query])

  useEffect(() => { setIndex(0) }, [query, mode])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, items])

  function choose(item) {
    if (mode === 'notes') onOpen(item.id)
    else item.run()
    onClose()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[index]) choose(items[index]) }
    else if (e.key === 'Escape') onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label={mode === 'notes' ? 'Quick note switcher' : 'Command palette'}
        style={{ position: 'fixed', top: 46, left: '50%', transform: 'translateX(-50%)',
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
            onKeyDown={onKeyDown} role="combobox" aria-expanded="true"
            aria-controls="command-center-list"
            placeholder={mode === 'notes' ? 'Switch to a note' : 'Run a command'}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: colors.text, fontSize: 13 }} />
          <span style={{ color: colors.textMuted, fontSize: 11 }}>esc</span>
        </div>
        <div ref={listRef} id="command-center-list" role="listbox"
          style={{ maxHeight: 320, overflow: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: colors.textMuted }}>
              {mode === 'notes' ? 'No notes matching ' : 'No command matching '}
              <span style={{ color: colors.text }}>{query.trim()}</span>
            </div>
          ) : items.map((item, i) => (
            <div key={item.id} role="option" aria-selected={i === index}
              data-selected={i === index} onClick={() => choose(item)}
              onMouseEnter={() => setIndex(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                cursor: 'pointer', background: i === index ? 'rgba(90,106,122,0.18)' : 'none' }}>
              {mode === 'notes' ? (
                <>
                  <StarIcon species={item.species} size="sm" />
                  <span style={{ color: colors.text, fontSize: 12, flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                  <span style={{ color: colors.textMuted, fontSize: 11 }}>{item.stage}</span>
                </>
              ) : (
                <>
                  <Icon name={item.icon} size={14} style={{ color: colors.accent }} />
                  <span style={{ color: colors.text, fontSize: 12, flex: 1 }}>{item.label}</span>
                  <span style={{ color: colors.textMuted, fontSize: 11 }}>{item.group}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${colors.border}`,
            color: colors.textMuted, fontSize: 11 }}>
            {mode === 'notes' ? 'Enter to open' : 'Enter to run'} · ↑↓ to move · Esc to close
          </div>
        )}
      </div>
    </div>
  )
}
