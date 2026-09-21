import { colors, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'
import WindowControls from './WindowControls'

const drag = { '--wails-draggable': 'drag' }
const noDrag = { '--wails-draggable': 'no-drag' }

export default function HeaderBar({ skyName, onCommand, onSettings, onToggleDetails, detailsOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px',
      borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
      flexShrink: 0, WebkitUserSelect: 'none', position: 'relative', ...drag }}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <StarIcon species="warm" size="sm" />
      </span>
      <span style={{ fontFamily: typography.display.fontFamily, fontSize: 13, color: colors.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {skyName}
      </span>

      <button type="button" onClick={onCommand} aria-label="search the sky"
        style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 6, height: 26, width: 220,
          padding: '0 12px', background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: 13, color: colors.textMuted, fontSize: 12, cursor: 'pointer', ...noDrag }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderStrong }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border }}>
        <Icon name="search" size={13} />
        <span>Search the sky</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: colors.textDim }}>Ctrl+K</span>
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, ...noDrag }}>
        <button type="button" onClick={onToggleDetails} aria-label="toggle details"
          data-tip={detailsOpen ? 'Hide details' : 'Show details'}
          style={{ background: 'none', border: 'none',
            color: detailsOpen ? colors.accent : colors.textMuted,
            cursor: 'pointer', padding: 4 }}>
          <span style={{ display: 'inline-block', transition: 'transform 0.2s ease',
            transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <Icon name="chevron-right" size={15} />
          </span>
        </button>
        <button type="button" onClick={onSettings} aria-label="settings"
          data-tip="Settings" data-tour="settings"
          style={{ background: 'none', border: 'none', color: colors.textMuted,
            cursor: 'pointer', padding: 4 }}><Icon name="settings" size={15} /></button>
      </div>
      <WindowControls />
    </div>
  )
}
