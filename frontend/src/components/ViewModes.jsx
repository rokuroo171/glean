import { useEffect, useRef } from 'react'
import { colors } from '../lib/theme'

// Source hatch: raw markdown in a plain textarea over the same body state
// the editor uses. Not a mode, not a view: a hidden power hatch, off the
// chrome entirely. Ctrl+Shift+E toggles it, Escape returns to the editor.
// Edits flow through the same onBodyChange the editor emits, so the
// Milkdown doc re-parses on return through the existing sync path.
export function SourceView({ value, onChange, onExit }) {
  const taRef = useRef(null)

  useEffect(() => {
    taRef.current?.focus()
  }, [])

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .glean-source-area {
          flex: 1;
          width: 100%;
          resize: none;
          border: none;
          outline: none;
          background: transparent;
          color: ${colors.text};
          caret-color: ${colors.accent};
          font-family: 'Fira Code', ui-monospace, monospace;
          font-size: 13.5px;
          line-height: 1.65;
          padding: 20px 24px 40px;
          tab-size: 2;
        }
        .glean-source-area::selection { background: ${colors.accent}33; }
        .glean-source-area::-webkit-scrollbar { width: 8px; }
        .glean-source-area::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; }
      `}</style>
      <textarea
        ref={taRef}
        className="glean-source-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onExit) {
            e.preventDefault()
            onExit()
          }
        }}
        spellCheck={false}
        aria-label="Source markdown"
      />
    </div>
  )
}
