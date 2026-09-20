import { useState } from 'react'
import { colors, speciesColor } from '../lib/theme'
import StarIcon from './StarIcon'
import StarPoint from './StarPoint'
import Icon from './Icon'

export default function OpenNotesList({ tabs, activeId, onSelect, onClose }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ padding: '8px 6px 4px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: colors.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 4px' }}>
        Open notes
      </div>
      {tabs.map(t => {
        const active = t.id === activeId
        const showX = active || hovered === t.id
        return (
          <div key={t.id} onClick={() => onSelect(t.id)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); onClose(t.id) } }}
            onMouseEnter={() => setHovered(t.id)} onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28,
              padding: '0 8px', borderRadius: 6, cursor: 'pointer', position: 'relative',
              background: active ? colors.bg : 'transparent' }}>
            {active && (
              <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2,
                borderRadius: 1, background: colors.accent }} />
            )}
            {t.id === '__night__'
              ? <Icon name="moon" size={13} style={{ color: colors.accent, flexShrink: 0 }} />
              : <StarIcon species={t.species} size="sm" />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 12,
              color: t.id === '__night__' ? colors.accent : colors.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.title}
            </span>
            {t.dirty && <StarPoint size={8} color={speciesColor[t.species] || colors.starNeutral} />}
            {showX && (
              <span role="button" aria-label={`close ${t.title}`}
                onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
                style={{ display: 'flex', alignItems: 'center', width: 16,
                  color: colors.textMuted, cursor: 'pointer', flexShrink: 0 }}>
                <Icon name="x" size={12} />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
