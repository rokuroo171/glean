import { useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

const STAGE_SCORE = { faintspeck: 1, dimstar: 2, steadystar: 3, brightstar: 4, brilliantstar: 5 }

export default function DetailsPanel({ note, linked, onWish, onDelete, onOpenNote }) {
  const [wishMsg, setWishMsg] = useState(null)
  const score = STAGE_SCORE[note.stage] || 1

  async function wish() {
    setWishMsg(null)
    const ok = await onWish(note.id)
    setWishMsg(ok ? 'Wish granted!' : 'Already wished today.')
    setTimeout(() => setWishMsg(null), 2500)
  }

  return (
    <div style={{ padding: space[3], fontSize: 12, color: colors.textMuted, overflow: 'auto' }}>
      <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: space[2] }}>Note</div>
      <Row label="Created" value={new Date(note.created_at).toLocaleDateString()} />
      <Row label="Last visit" value={note.last_visited ? new Date(note.last_visited).toLocaleDateString() : 'never'} />
      <Row label="Visits" value={String(note.visit_count)} />

      <div style={{ marginTop: space[2] }}>Brightness</div>
      <div style={{ display: 'flex', gap: 3, margin: '4px 0 12px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} style={{ width: 10, height: 10, borderRadius: 5,
            background: i <= score ? colors.accentWarm : 'transparent',
            border: `1px solid ${i <= score ? colors.accentWarm : colors.border}` }} />
        ))}
      </div>

      <div style={{ marginTop: space[2] }}>Actions</div>
      <div style={{ display: 'flex', gap: 6, margin: '6px 0 14px' }}>
        <button type="button" onClick={wish} title="Wish (once per day)"
          style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
            borderRadius: 4, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="sparkle" size={13} /></button>
        <button type="button" onClick={() => onDelete(note.id)} title="Delete note"
          style={{ background: 'none', border: `1px solid ${colors.border}`, color: '#b06060',
            borderRadius: 4, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="trash" size={13} /></button>
      </div>
      {wishMsg && <div style={{ fontSize: 12, color: '#80c090', marginBottom: 8 }}>{wishMsg}</div>}

      <div style={{ ...typography.sectionLabel, color: colors.textMuted, margin: `${space[2]}px 0` }}>Linked stars</div>
      {linked.length === 0 ? <div style={{ fontSize: 11, color: colors.textDim }}>No trail lines yet.</div> : (
        linked.map(n => (
          <button key={n.id} type="button" onClick={() => onOpenNote(n.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none',
              border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: colors.textMuted }}>
            <StarIcon species={n.species} size="sm" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
          </button>
        ))
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
      <span>{label}</span><span style={{ color: colors.text }}>{value}</span>
    </div>
  )
}
