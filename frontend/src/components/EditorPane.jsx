import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'
import StarIcon from './StarIcon'

const AUTOSAVE_DELAY = 1500
const LINE_HEIGHT = 22

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

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty, linked, onOpenNote }) {
  const [mode, setMode] = useState('edit') // edit | preview
  const [currentHeading, setCurrentHeading] = useState(0)
  const debounceRef = useRef(null)
  const taRef = useRef(null)
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
    onBodyChange(newBody)
    setDirty(true)
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

  useEffect(() => {
    const onKey = (e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); flushRef.current() } }
    const onBlur = () => flushRef.current()
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('blur', onBlur) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], padding: `${space[2]}px ${space[3]}px`,
        borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: colors.text, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</h2>
        <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {['edit', 'preview'].map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ background: mode === m ? colors.bgElevated : 'none', border: 'none',
                color: mode === m ? colors.text : colors.textMuted, fontSize: 11,
                padding: '4px 12px', cursor: 'pointer' }}>{m}</button>
          ))}
        </div>
      </div>
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {mode === 'edit' && headings.length >= 3 && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`,
            overflow: 'auto', padding: space[2], flexShrink: 0 }}>
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
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: space[3] }}>
          {mode === 'preview' ? (
            <div style={{ color: colors.text, lineHeight: 1.6 }}>{renderMarkdown(body)}</div>
          ) : (
            <textarea
              ref={taRef}
              value={body}
              onChange={(e) => handleChange(e.target.value)}
              onScroll={onScroll}
              placeholder="Write, the night holds what you seek."
              style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
                background: 'transparent', border: 'none', color: '#d0e0d0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 14, lineHeight: 1.6 }}
            />
          )}
        </div>
      </div>
    </div>
  )
}