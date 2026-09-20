import { colors, space } from '../lib/theme'

// Only live document facts: cursor position, counts, backlinks. Version
// lives in Settings, the clock and sky name duplicate the explorer, and
// the save dot duplicated the tab's dirty star
export default function StatusBar({ words, chars, line, col, backlinks, showCursor }) {
  const dot = <span style={{ color: colors.textDim }}>·</span>

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space[2],
      padding: '6px 14px',
      borderTop: `1px solid ${colors.border}`,
      background: colors.bgElevated,
      fontSize: 11, color: colors.textMuted, flexShrink: 0,
    }}>
      {showCursor && line != null && (
        <>
          <span>Ln {line}, Col {col}</span>
          {dot}
        </>
      )}

      {chars != null && (
        <>
          <span>{chars.toLocaleString()} chars</span>
          {dot}
        </>
      )}

      <span>{words} words</span>

      {backlinks > 0 && (
        <>
          {dot}
          <span>{backlinks} backlink{backlinks !== 1 ? 's' : ''}</span>
        </>
      )}
    </div>
  )
}
