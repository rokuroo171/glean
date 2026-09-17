import { useEffect, useRef } from 'react'
import { colors } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'

// Two non-WYSIWYG view states that share the editor slot in EditorPane:
// - Source: raw markdown in a plain textarea. Edits flow through the same
//   onBodyChange the WYSIWYG editor emits, so the Milkdown doc re-parses on
//   return and the lossless round-trip is owned by the existing serializer
//   path (same contract as external body pushes).
// - Reading: the same renderMarkdown the Constellation note overlay uses,
//   so what you read here is byte-identical to what the sky shows.
// Mode lives in module scope (not React state): a single source of truth
// persists across note switches without new preference plumbing, and the
// EditorPane toolbar reads it through onModeChange notifications.
export const VIEW_MODES = ['wysiwyg', 'source', 'reading']
let currentMode = 'wysiwyg'
const listeners = new Set()

export function getViewMode() {
  return currentMode
}

export function setViewMode(mode) {
  if (!VIEW_MODES.includes(mode) || mode === currentMode) return
  currentMode = mode
  listeners.forEach((fn) => fn(mode))
}

export function subscribeViewMode(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const hostStyle = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

export function SourceView({ value, onChange }) {
  const taRef = useRef(null)
  // Focus once on entering source mode so typing is immediate; the browser
  // restores the caret to 0 which is fine for a full-note edit surface
  useEffect(() => {
    taRef.current?.focus()
  }, [])
  return (
    <div style={hostStyle}>
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
        spellCheck={false}
        aria-label="Source markdown"
      />
    </div>
  )
}

export function ReadingView({ body, noteNames, onToggle, onNoteLink }) {
  return (
    <div style={{ ...hostStyle, overflowY: 'auto' }}>
      <style>{`
        .glean-reading {
          max-width: 720px;
          margin: 0 auto;
          padding: 20px 24px 48px;
          color: ${colors.text};
          font-size: 14.5px;
          line-height: 1.7;
        }
        .glean-reading h1, .glean-reading h2, .glean-reading h3 { color: ${colors.text}; }
        .glean-reading code {
          font-family: 'Fira Code', ui-monospace, monospace;
          background: ${colors.bgElevated};
          border: 1px solid ${colors.border};
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 12.5px;
        }
        .glean-reading pre {
          background: ${colors.bgElevated};
          border: 1px solid ${colors.border};
          border-radius: 8px;
          padding: 12px 14px;
          overflow-x: auto;
        }
        .glean-reading pre code { border: none; background: none; padding: 0; }
        .glean-reading blockquote {
          border-left: 3px solid ${colors.accent}66;
          margin-left: 0;
          padding-left: 14px;
          color: ${colors.textMuted};
        }
        .glean-reading a { color: ${colors.accent}; }
        .glean-reading hr { border: none; border-top: 1px solid ${colors.border}; margin: 20px 0; }
        .glean-reading img { max-width: 100%; border-radius: 8px; }
        .glean-reading table { border-collapse: collapse; }
        .glean-reading th, .glean-reading td { border: 1px solid ${colors.border}; padding: 5px 10px; }
      `}</style>
      <div className="glean-reading">
        {renderMarkdown(body, { noteNames, onToggle, onNoteLink }) || (
          <span style={{ color: colors.textDim }}>(empty)</span>
        )}
      </div>
    </div>
  )
}
