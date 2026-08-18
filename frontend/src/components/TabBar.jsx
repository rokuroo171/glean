import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import WindowControls from './WindowControls'
import Icon from './Icon'

const runtime = window.runtime

const noDrag = { WebkitAppRegion: 'no-drag' }

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onSettings, onCommand, skyCollapsed, onToggleSky, pseudoTab, onClosePseudo }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 0 10px', height: 38,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        overflowX: 'auto', flexShrink: 0,
        WebkitAppRegion: 'drag', WebkitUserSelect: 'none' }}
      // Linux webkit2gtk ignores CSS drag regions; hand the drag to the runtime there.
      onPointerDown={() => { if (runtime?.WindowStartDragging) runtime.WindowStartDragging() }}
    >
      <button type="button" onClick={onToggleSky} aria-label={skyCollapsed ? 'show sky panel' : 'hide sky panel'}
        title={skyCollapsed ? 'Show sky panel' : 'Hide sky panel'}
        style={{ flexShrink: 0, background: 'none', border: 'none', color: colors.textMuted,
          cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', ...noDrag }}>
        <Icon name={skyCollapsed ? 'panel-right' : 'panel-left'} size={14} />
      </button>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.text,
        fontSize: 13, fontWeight: 600, marginRight: 8 }}>
        <StarIcon species="warm" size="sm" />
        glean
      </span>

      {pseudoTab && (
        <div key="pseudo"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
            background: colors.bg, border: `1px solid ${colors.borderStrong}`, ...noDrag }}>
          <span style={{ color: colors.text, fontSize: 12 }}>{pseudoTab === 'stats' ? 'Sky overview' : 'Settings'}</span>
          <span role="button" aria-label={`close ${pseudoTab}`}
            onClick={onClosePseudo}
            style={{ color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '0 2px' }}><Icon name="x" size={12} /></span>
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
              style={{ color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '0 2px' }}><Icon name="x" size={12} /></span>
          </div>
        )
      })}
      <button type="button" onClick={onNew} aria-label="new star"
        style={{ flexShrink: 0, background: 'none', border: `1px solid ${colors.border}`,
          color: colors.textMuted, borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', ...noDrag }}><Icon name="plus" size={14} /></button>

      <div style={{ flex: 1 }} />
      <button type="button" onClick={onCommand} aria-label="search the sky"
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 26,
          padding: '0 12px', background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: 13, color: colors.textMuted, fontSize: 12, cursor: 'pointer', ...noDrag }}>
        <Icon name="search" size={13} />
      </button>
      <div style={{ flex: 1 }} />

      <button type="button" onClick={onSettings} aria-label="settings"
        style={{ flexShrink: 0, background: 'none', border: 'none', color: colors.textMuted,
          cursor: 'pointer', padding: 4, ...noDrag }}><Icon name="settings" size={15} /></button>
      <WindowControls />
    </div>
  )
}
