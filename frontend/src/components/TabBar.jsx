import { motion, AnimatePresence } from 'motion/react'
import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import WindowControls from './WindowControls'
import Icon from './Icon'

const drag = { '--wails-draggable': 'drag' }
const noDrag = { '--wails-draggable': 'no-drag' }

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onSettings, onCustomize, onCommand, pseudoTab, onClosePseudo, detailsOpen, onToggleDetails }) {
  const pseudoLabel = pseudoTab === 'stats' ? 'Sky overview' : pseudoTab === 'customization' ? 'Customization' : 'Settings'

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 40,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        flexShrink: 0, WebkitUserSelect: 'none', ...drag }}>
      {/* Left: sidebar toggle */}
      <div style={{ flexShrink: 0, ...noDrag }}>{/* sidebar icon lives in Workspace */}</div>

      {/* Tabs — Chrome-style: equal width, shrink together */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <AnimatePresence initial={false} mode="popLayout">
          {tabs.map(t => {
            const active = t.id === activeId
            return (
              <motion.div key={t.id} layout
                initial={{ opacity: 0, scaleX: 0.8 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0.8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onSelect(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px',
                  borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                  flex: '1 1 0', minWidth: 60, maxWidth: 160,
                  background: active ? colors.bg : 'transparent',
                  border: `1px solid ${active ? colors.borderStrong : 'transparent'}`,
                  boxShadow: active ? `inset 0 -2px 0 ${colors.accentWarm}` : 'none', ...noDrag }}>
                {t.id === '__night__' ? <Icon name="moon" size={13} style={{ color: colors.accent, flexShrink: 0 }} /> : <StarIcon species={t.species} size="sm" />}
                <span style={{ color: t.id === '__night__' ? colors.accent : colors.text, fontSize: 12, overflow: 'hidden',
                  textOverflow: 'ellipsis' }}>{t.title}</span>
                {t.dirty && <span style={{ width: 6, height: 6, borderRadius: 3, background: colors.accentWarm, flexShrink: 0 }} />}
                <span role="button" aria-label={`close ${t.title}`}
                  onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
                  style={{ color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '0 2px', flexShrink: 0 }}><Icon name="x" size={12} /></span>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {pseudoTab && (
          <div key="pseudo"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px',
              borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
              background: colors.bg, border: `1px solid ${colors.borderStrong}`, ...noDrag }}>
            <span style={{ color: colors.text, fontSize: 12 }}>{pseudoLabel}</span>
            <span role="button" aria-label={`close ${pseudoTab}`}
              onClick={onClosePseudo}
              style={{ color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '0 2px' }}><Icon name="x" size={12} /></span>
          </div>
        )}
        <button type="button" onClick={onNew} aria-label="open night" data-tip="Night"
          style={{ flexShrink: 0, background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textMuted, borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', ...noDrag }}><Icon name="moon" size={14} /></button>
      </div>

      {/* Center: logo — flex item, never overlapped */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.text,
        fontSize: 13, fontWeight: 600, flexShrink: 0, ...noDrag }}>
        <StarIcon species="warm" size="sm" />
        glean
      </span>

      {/* Spacer — balances tabs so logo stays centered */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Right: search, actions, controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, ...noDrag }}>
        <button type="button" onClick={onCommand} aria-label="search the sky"
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26,
            padding: '0 12px', background: colors.bg, border: `1px solid ${colors.border}`,
            borderRadius: 13, color: colors.textMuted, fontSize: 12, cursor: 'pointer' }}>
          <Icon name="search" size={13} />
        </button>
        <button type="button" onClick={onCustomize} aria-label="customization"
          data-tip="Customization"
          style={{ background: 'none', border: 'none', color: pseudoTab === 'customization' ? colors.accent : colors.textMuted,
            cursor: 'pointer', padding: 4, borderRadius: 4 }}>
          <Icon name="palette" size={15} />
        </button>
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
          style={{ background: 'none', border: 'none', color: colors.textMuted,
            cursor: 'pointer', padding: 4 }}><Icon name="settings" size={15} /></button>
      </div>
      <WindowControls />
    </div>
  )
}
