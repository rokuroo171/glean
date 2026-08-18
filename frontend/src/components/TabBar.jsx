import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import WindowControls from './WindowControls'

const runtime = window.runtime

const noDrag = { WebkitAppRegion: 'no-drag' }

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onSettings, pseudoTab, onClosePseudo }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 0 10px', height: 38,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        overflowX: 'auto', flexShrink: 0,
        WebkitAppRegion: 'drag', WebkitUserSelect: 'none' }}
      // Linux webkit2gtk ignores CSS drag regions; hand the drag to the runtime there.
      onPointerDown={() => { if (runtime?.WindowStartDragging) runtime.WindowStartDragging() }}
    >
      <span style={{ color: colors.text, fontSize: 13, fontWeight: 600, marginRight: 8 }}>glean</span>

      {pseudoTab && (
        <div key="pseudo"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
            background: colors.bg, border: `1px solid ${colors.borderStrong}`, ...noDrag }}>
          <span style={{ color: colors.text, fontSize: 12 }}>{pseudoTab === 'stats' ? 'Sky overview' : 'settings'}</span>
          <span role="button" aria-label={`close ${pseudoTab}`}
            onClick={onClosePseudo}
            style={{ color: colors.textMuted, fontSize: 11, padding: '0 2px', cursor: 'pointer' }}>x</span>
        </div>
      )}

      {tabs.map(t => {
        const active = t.id === activeId
        return (
          <div key={t.id} onClick={() => onSelect(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? colors.bg : 'transparent',
              border: `1px solid ${active ? colors.borderStrong : 'transparent'}`, ...noDrag }}>
            <StarIcon species={t.species} size="sm" />
            <span style={{ color: colors.text, fontSize: 12, maxWidth: 160, overflow: 'hidden',
              textOverflow: 'ellipsis' }}>{t.title}</span>
            {t.dirty && <span style={{ width: 6, height: 6, borderRadius: 3, background: colors.accentWarm }} />}
            <span role="button" aria-label={`close ${t.title}`}
              onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
              style={{ color: colors.textMuted, fontSize: 11, padding: '0 2px', cursor: 'pointer' }}>x</span>
          </div>
        )
      })}
      <button type="button" onClick={onNew} aria-label="new star"
        style={{ flexShrink: 0, background: 'none', border: `1px solid ${colors.border}`,
          color: colors.textMuted, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', ...noDrag }}>+</button>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onSettings} aria-label="settings"
        style={{ flexShrink: 0, background: 'none', border: 'none', color: colors.textMuted,
          fontSize: 14, cursor: 'pointer', ...noDrag }}>settings</button>
      <WindowControls />
    </div>
  )
}