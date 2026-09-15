import { useEffect, useRef, useState } from 'react'
import { colors, space, success } from '../lib/theme'

export default function StatusBar({ words, chars, line, col, backlinks, saveState, skyName, version, showCursor }) {
  const [flash, setFlash] = useState(false)
  const [time, setTime] = useState(() => new Date())
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

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const saved = saveState === 'saved'
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
      {dot}

      {/* Save state dot */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3, flexShrink: 0,
          background: flash ? colors.accentWarm : saved ? success : colors.accentWarm,
          transition: 'background 0.3s ease',
          boxShadow: flash ? `0 0 6px ${colors.accentWarm}66` : 'none',
        }} />
        <span style={flash ? { color: colors.accentWarm } : undefined}>
          {saveState}
        </span>
      </span>

      {backlinks > 0 && (
        <>
          {dot}
          <span>{backlinks} backlink{backlinks !== 1 ? 's' : ''}</span>
        </>
      )}

      <span style={{ marginLeft: 'auto' }}>{skyName}</span>
      {dot}
      <span>{timeStr}</span>
      {dot}
      <span>{version}</span>
    </div>
  )
}
