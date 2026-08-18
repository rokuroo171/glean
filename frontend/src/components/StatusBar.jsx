import { useEffect, useRef, useState } from 'react'
import { colors, space } from '../lib/theme'

const pulseKeyframe = `
  @keyframes save-pulse {
    0% { color: ${colors.accentWarm}; }
    100% { color: ${colors.textMuted}; }
  }
`

export default function StatusBar({ words, saveState, skyName, version }) {
  const [flash, setFlash] = useState(false)
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[2], padding: '5px 12px',
      borderTop: `1px solid ${colors.border}`, background: colors.bgElevated,
      fontSize: 11, color: colors.textMuted, flexShrink: 0 }}>
      <style>{pulseKeyframe}</style>
      <span>{words} words</span>
      <span>·</span>
      <span style={flash ? { animation: 'save-pulse 0.8s ease-out', color: colors.accentWarm } : undefined}>{saveState}</span>
      <span style={{ marginLeft: 'auto' }}>{skyName}</span>
      <span>·</span>
      <span>{version}</span>
    </div>
  )
}
