import { colors } from '../lib/theme'
import Constellation from './Constellation'

export default function FullConstellation({ notes, links, onNoteClick, onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: colors.bg }}>
      <button type="button" onClick={onClose} aria-label="return to workspace"
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 41,
          background: colors.bgElevated, border: `1px solid ${colors.border}`,
          color: colors.text, borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
        back to workspace
      </button>
      <Constellation notes={notes} links={links} onNoteClick={onNoteClick}
        selectedNote={null} onCloseNote={() => {}}
        onSave={async () => {}} onWish={async () => false} onDelete={async () => {}}
        onCreate={async () => null}
        showStats={false} stats={null} onCloseStats={() => {}}
        onReturnHome={onClose}
        pendingNoteId={null} onPendingNoteHandled={() => {}}
        pendingNewNote={false} onPendingNewNoteHandled={() => {}}
        onStageUp={null} onWishGlow={null} hideHomeButton />
    </div>
  )
}