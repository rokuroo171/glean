import { useState, useRef, useEffect } from 'react'
import { colors } from '../lib/theme'

/* Inline input matching the note creation style in FileExplorer */

export default function NewFolderPrompt({ onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
      padding: '3px 12px' }}>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      </svg>
      <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown} onBlur={onCancel}
        placeholder="Folder name"
        style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.accent}`,
          borderRadius: 3, padding: '2px 6px', fontSize: 12, color: colors.text,
          outline: 'none', minWidth: 0 }} />
    </div>
  )
}
