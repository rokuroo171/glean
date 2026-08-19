import { motion, AnimatePresence } from 'motion/react'
import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import WindowControls from './WindowControls'
import Icon from './Icon'

const drag = { '--wails-draggable': 'drag' }
const noDrag = { '--wails-draggable': 'no-drag' }

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onSettings, onCommand, skyCollapsed, onToggleSky, pseudoTab, onClosePseudo, detailsOpen, onToggleDetails }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 0 10px', height: 38,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        flexShrink: 0, WebkitUserSelect: 'none', ...drag }}
    >
      <button type="button" onClick={onToggleSky} aria-label={skyCollapsed ? 'show explorer' : 'hide explorer'}
        title={skyCollapsed ? 'Show explorer' : 'Hide explorer'}
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

      <AnimatePresence initial={false}>
        {tabs.map(t => {
          const active = t.id === activeId
          return (
            <motion.div key={t.id} layout
              initial={{ opacity: 0, width: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, width: 'auto', scaleX: 1 }}
              exit={{ opacity: 0, width: 0, scaleX: 0.8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onSelect(t.id)}
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
            </motion.div>
          )
        })}
      </AnimatePresence>
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

      <button type="button" onClick={onToggleDetails} aria-label="toggle details"
        title={detailsOpen ? 'Hide details' : 'Show details'}
        style={{ flexShrink: 0, background: 'none', border: 'none',
          color: detailsOpen ? colors.accent : colors.textMuted,
          cursor: 'pointer', padding: 4, ...noDrag }}><Icon name="panel-right" size={15} /></button>
      <button type="button" onClick={onSettings} aria-label="settings"
        style={{ flexShrink: 0, background: 'none', border: 'none', color: colors.textMuted,
          cursor: 'pointer', padding: 4, ...noDrag }}><Icon name="settings" size={15} /></button>
      <WindowControls />
    </div>
  )
}
