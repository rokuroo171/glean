import { useEffect, useRef, useState } from 'react'
import { colors, space } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'

const AUTOSAVE_DELAY = 1500

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty }) {
  const [mode, setMode] = useState('edit') // edit | preview
  const debounceRef = useRef(null)
  // Always points at the current save closure so the mount-once
  // keydown and blur listeners never go stale across tab switches.
  const flushRef = useRef(null)
  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  function handleChange(newBody) {
    onBodyChange(newBody)
    setDirty(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flushRef.current()
    }, AUTOSAVE_DELAY)
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: space[3] }}>
        {mode === 'preview' ? (
          <div style={{ color: colors.text, lineHeight: 1.6 }}>{renderMarkdown(body)}</div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Write, the night holds what you seek."
            style={{ width: '100%', height: '100%', resize: 'none', outline: 'none',
              background: 'transparent', border: 'none', color: '#d0e0d0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 14, lineHeight: 1.6 }}
          />
        )}
      </div>
    </div>
  )
}
