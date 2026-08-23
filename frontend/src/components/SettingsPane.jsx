import { colors, space } from '../lib/theme'

const sectionTitle = {
  fontSize: 11,
  fontWeight: 500,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: space[2],
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: space[5] }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ background: colors.bgCard, border: '1px solid ' + colors.border, borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', gap: 16, fontSize: 13,
      borderBottom: last ? 'none' : '1px solid ' + colors.border,
    }}>
      <span style={{ color: colors.textMuted, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  )
}

export default function SettingsPane({ skyName, skyPath, version }) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space[5], color: colors.text }}>
      <h2 style={{ margin: '0 0 ' + space[4] + 'px', fontSize: 18, fontWeight: 500 }}>Settings</h2>

      <Section title="About">
        <Row label="Sky name"><span style={{ color: colors.text }}>{skyName}</span></Row>
        <Row label="Sky path">
          <span style={{ color: colors.textMuted, fontSize: 11, maxWidth: 280, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skyPath || 'local'}</span>
        </Row>
        <Row label="Version" last><span style={{ color: colors.text }}>{version}</span></Row>
      </Section>

      <div style={{ fontSize: 12, color: colors.textDim, marginTop: space[2] }}>
        Everything you write is plain markdown in that folder. Move it, and locate it again from the recovery screen.
      </div>
    </div>
  )
}
