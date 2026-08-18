import { colors, space } from '../lib/theme'

export default function StatusBar({ words, saveState, skyName, version }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[2], padding: '5px 12px',
      borderTop: `1px solid ${colors.border}`, background: colors.bgElevated,
      fontSize: 11, color: colors.textMuted, flexShrink: 0 }}>
      <span>{words} words</span>
      <span>·</span>
      <span>{saveState}</span>
      <span style={{ marginLeft: 'auto' }}>{skyName}</span>
      <span>·</span>
      <span>{version}</span>
    </div>
  )
}
