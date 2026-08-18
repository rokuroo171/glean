import { colors, space, typography } from '../lib/theme'

export default function SettingsPane({ skyName, skyPath, version }) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space[5], color: colors.text }}>
      <div style={{ ...typography.greeting, marginBottom: space[3] }}>Settings</div>
      <Row label="Sky name" value={skyName} />
      <Row label="Sky path" value={skyPath || 'local'} />
      <Row label="Version" value={version} />
      <div style={{ marginTop: space[3], fontSize: 12, color: colors.textMuted }}>
        Everything you write is plain markdown in that folder. Move it, and locate it again from the recovery screen.
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16,
      padding: '10px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>
      <span style={{ color: colors.textMuted }}>{label}</span><span>{value}</span>
    </div>
  )
}