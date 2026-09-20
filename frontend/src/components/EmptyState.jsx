import { colors, space, radius, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

// Shown when the last tab closes: a quiet welcome card with the three
// actions that make sense from nothing. Ctrl+O and Ctrl+K work everywhere,
// so they are listed as hints, not buttons
export default function EmptyState({ onNewNote, onNight, onConstellation }) {
  const btn = {
    display: 'flex', alignItems: 'center', gap: space[2],
    padding: `${space[2]}px ${space[3]}px`, background: colors.bgCard,
    border: `1px solid ${colors.border}`, borderRadius: radius.lg,
    cursor: 'pointer', color: colors.text, transition: 'border-color 160ms ease-out',
  }
  const hover = {
    onMouseEnter: (e) => { e.currentTarget.style.borderColor = colors.borderStrong },
    onMouseLeave: (e) => { e.currentTarget.style.borderColor = colors.border },
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[4], maxWidth: 380, padding: space[4] }}>
        <StarIcon species="warm" size="lg" />
        <div style={{ ...typography.paneTitle, color: colors.text, textAlign: 'center' }}>
          The sky is clear
        </div>
        <div style={{ ...typography.notePreview, color: colors.textMuted, textAlign: 'center' }}>
          Open a note from the explorer, or start something new.
        </div>
        <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={onNewNote} style={btn} {...hover}>
            <Icon name="file-plus" size={15} />
            <span style={{ fontSize: 13 }}>New note</span>
          </button>
          <button type="button" onClick={onNight} style={btn} {...hover}>
            <Icon name="moon" size={15} />
            <span style={{ fontSize: 13 }}>Night</span>
          </button>
          <button type="button" onClick={onConstellation} style={btn} {...hover}>
            <Icon name="sparkles" size={15} />
            <span style={{ fontSize: 13 }}>Constellation</span>
          </button>
        </div>
        <div style={{ fontSize: 12, color: colors.textDim, textAlign: 'center' }}>
          <span style={{ ...typography.sectionLabel, color: colors.textDim }}>Ctrl+O</span> switch notes
          <span style={{ margin: '0 8px', color: colors.borderStrong }}>-</span>
          <span style={{ ...typography.sectionLabel, color: colors.textDim }}>Ctrl+K</span> commands
        </div>
      </div>
    </div>
  )
}
