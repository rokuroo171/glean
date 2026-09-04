import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { colors } from '../lib/theme'
import StarIcon from './StarIcon'
import WindowControls from './WindowControls'
import Icon from './Icon'

const drag = { '--wails-draggable': 'drag' }
const noDrag = { '--wails-draggable': 'no-drag' }

const TAB_MAX = 220
const TAB_MIN = 70
const GAP = 2

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onSettings, onCustomize, onCommand, pseudoTab, onClosePseudo, detailsOpen, onToggleDetails }) {
  const pseudoLabel = pseudoTab === 'stats' ? 'Sky overview' : pseudoTab === 'customization' ? 'Customization' : 'Settings'
  const [hovered, setHovered] = useState(null)
  // While the cursor is in the bar, tab widths are frozen so closing a
  // tab slides the next one under the cursor (spam-close). Released on leave.
  const [frozenW, setFrozenW] = useState(null)
  const tabsWrapRef = useRef(null)
  const releaseTimer = useRef(null)

  // Compute a compact width that fits all current tabs, and hold it.
  // Re-entering cancels any pending release, so the expand only fires
  // once per genuine leave (no nudge spam on rapid in/out).
  const freezeWidth = () => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }
    const el = tabsWrapRef.current
    if (!el) return
    const count = tabs.length + (pseudoTab ? 1 : 0)
    if (count === 0) return
    const avail = el.clientWidth - GAP * (count - 1)
    setFrozenW(Math.max(TAB_MIN, Math.min(TAB_MAX, Math.floor(avail / count))))
  }

  // Expand once, only after the cursor has stayed out of the bar.
  const scheduleRelease = () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null
      setFrozenW(null)
      setHovered(null)
    }, 250)
  }

  useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current) }, [])

  // Frozen: fixed width, no reflow on close. Otherwise: equal flex tabs
  // that shrink to fit and expand up to TAB_MAX.
  const tabStyle = frozenW != null
    ? { width: frozenW, flex: '0 0 auto' }
    : { flex: '1 1 0', minWidth: TAB_MIN, maxWidth: TAB_MAX }

  return (
    <div
      onMouseEnter={freezeWidth}
      onMouseLeave={scheduleRelease}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 40,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        flexShrink: 0, WebkitUserSelect: 'none', ...drag }}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', ...noDrag }}>
        <StarIcon species="warm" size="sm" />
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        <div ref={tabsWrapRef} style={{ display: 'flex', alignItems: 'center', gap: GAP, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <AnimatePresence initial={false}>
          {tabs.map(t => {
            const active = t.id === activeId
            const showX = active || hovered === t.id
            return (
              <motion.div key={t.id}
                layout
                initial={{ opacity: 0, scaleX: 0.9 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0.7, width: 0, marginRight: -GAP }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onSelect(t.id)}
                onMouseEnter={() => setHovered(t.id)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
                  boxSizing: 'border-box', padding: '5px 20px 5px 8px', borderRadius: 6,
                  cursor: 'pointer', whiteSpace: 'nowrap', ...tabStyle,
                  background: active ? colors.bg : 'transparent',
                  border: `1px solid ${active ? colors.borderStrong : 'transparent'}`,
                  boxShadow: active ? `inset 0 -2px 0 ${colors.accentWarm}` : 'none',
                  transition: 'width 0.12s ease, flex-basis 0.12s ease', ...noDrag }}>
                {t.id === '__night__' ? <Icon name="moon" size={13} style={{ color: colors.accent, flexShrink: 0 }} /> : <StarIcon species={t.species} size="sm" />}
                <span style={{ color: t.id === '__night__' ? colors.accent : colors.text, fontSize: 12,
                  overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{t.title}</span>
                {t.dirty && <span style={{ width: 6, height: 6, borderRadius: 3, background: colors.accentWarm, flexShrink: 0 }} />}
                {showX && (
                  <span role="button" aria-label={`close ${t.title}`}
                    onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
                    style={{ position: 'absolute', right: 4, top: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, color: colors.textMuted, cursor: 'pointer' }}>
                    <Icon name="x" size={12} />
                  </span>
                )}
              </motion.div>
            )
          })}
          </AnimatePresence>
          {pseudoTab && (
            <div key="pseudo"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
                boxSizing: 'border-box', padding: '5px 20px 5px 8px', borderRadius: 6,
                whiteSpace: 'nowrap', ...tabStyle,
                background: colors.bg, border: `1px solid ${colors.borderStrong}`, ...noDrag }}>
              <span style={{ color: colors.text, fontSize: 12 }}>{pseudoLabel}</span>
              <span role="button" aria-label={`close ${pseudoTab}`}
                onClick={onClosePseudo}
                style={{ position: 'absolute', right: 4, top: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, color: colors.textMuted, cursor: 'pointer' }}><Icon name="x" size={12} /></span>
            </div>
          )}
        </div>
        <button type="button" onClick={onNew} aria-label="open night" data-tip="Night"
          style={{ flexShrink: 0, background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textMuted, borderRadius: 6, width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', ...noDrag }}><Icon name="moon" size={14} /></button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Right controls */}
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