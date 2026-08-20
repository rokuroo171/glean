import { useEffect, useRef, useState } from 'react'
import { colors, space } from '../lib/theme'

export default function StatusBar({ words, chars, line, col, backlinks, saveState, skyName, version, showCursor }) {
  const [flash, setFlash] = useState(false)
  const [time, setTime] = useState(() => new Date())
  const [showHint, setShowHint] = useState(true)
  const prev = useRef(saveState)

  useEffect(() => {
    if (saveState === 'saved' && prev.current === 'unsaved') {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 800)
      prev.current = saveState
      return () => clearTimeout(t)
    }
    prev.current = saveState
  }, [saveState])

  // Clock: update every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Hide Ctrl+K hint after 8s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(t)
  }, [])

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const saved = saveState === 'saved'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space[2],
      padding: '6px 14px',
      borderTop: `1px solid ${colors.border}`,
      background: 'linear-gradient(to bottom, rgba(18, 24, 36, 0.9), rgba(11, 15, 25, 0.95))',
      fontSize: 11, color: colors.textMuted, flexShrink: 0,
    }}>
      {showCursor && line != null && (
        <>
          <span>Ln {line}, Col {col}</span>
          <span style={{ color: colors.border }}>|</span>
        </>
      )}

      {chars != null && (
        <>
          <span>{chars.toLocaleString()} chars</span>
          <span style={{ color: colors.border }}>|</span>
        </>
      )}

      <span>{words} words</span>
      <span style={{ color: colors.border }}>|</span>

      {/* Save state dot */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3, flexShrink: 0,
          background: flash ? colors.accentWarm : saved ? '#4ade80' : colors.accentWarm,
          transition: 'background 0.3s ease',
          boxShadow: flash ? `0 0 6px ${colors.accentWarm}66` : 'none',
        }} />
        <span style={flash ? { color: colors.accentWarm } : undefined}>
          {saveState}
        </span>
      </span>

      {backlinks > 0 && (
        <>
          <span style={{ color: colors.border }}>|</span>
          <span>{backlinks} backlink{backlinks !== 1 ? 's' : ''}</span>
        </>
      )}

      <span style={{ marginLeft: 'auto' }}>{skyName}</span>
      <span style={{ color: colors.border }}>|</span>
      <span>{timeStr}</span>
      <span style={{ color: colors.border }}>|</span>
      <span>{version}</span>

      {showHint && (
        <span style={{ color: colors.textDim, fontSize: 10, marginLeft: 4, opacity: 0.6 }}>
          Ctrl+K
        </span>
      )}
    </div>
  )
}
