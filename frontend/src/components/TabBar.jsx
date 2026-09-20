import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { colors, speciesColor } from '../lib/theme'
import StarIcon from './StarIcon'
import StarPoint from './StarPoint'
import Icon from './Icon'

const drag = { '--wails-draggable': 'drag' }
const noDrag = { '--wails-draggable': 'no-drag' }

const TAB_MAX = 220
const TAB_MIN = 70
const GAP = 2

export default function TabBar({ tabs, activeId, onSelect, onClose, pseudoTab, onClosePseudo }) {
  const pseudoLabel = pseudoTab === 'stats' ? 'Sky overview' : pseudoTab === 'customization' ? 'Customization' : 'Settings'
  const [hovered, setHovered] = useState(null)
  // While the cursor is in the bar, tab widths are frozen so closing a
  // tab slides the next one under the cursor (spam-close). Released on leave
  const [frozenW, setFrozenW] = useState(null)
  const tabsWrapRef = useRef(null)
  const releaseTimer = useRef(null)

  // Compute a compact width that fits all current tabs, and hold it
  // Re-entering cancels any pending release, so the expand only fires
  // once per genuine leave (no nudge spam on rapid in/out)
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

  // Expand once, only after the cursor has stayed out of the bar
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
  // that shrink to fit and expand up to TAB_MAX
  const tabStyle = frozenW != null
    ? { width: frozenW, flex: '0 0 auto' }
    : { flex: '1 1 0', minWidth: TAB_MIN, maxWidth: TAB_MAX }

  return (
    <div
      onMouseEnter={freezeWidth}
      onMouseLeave={scheduleRelease}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 36,
        borderBottom: `1px solid ${colors.border}`, background: colors.bgElevated,
        flexShrink: 0, WebkitUserSelect: 'none', ...drag }}>

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
                onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); onClose(t.id) } }}
                onMouseEnter={() => setHovered(t.id)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
                  boxSizing: 'border-box', padding: '5px 20px 5px 8px', borderRadius: 6,
                  cursor: 'pointer', whiteSpace: 'nowrap', ...tabStyle,
                  background: active || hovered === t.id ? colors.bg : 'transparent',
                  border: `1px solid ${active ? colors.borderStrong : 'transparent'}`,
                  boxShadow: active ? `inset 0 -2px 0 ${colors.accent}` : 'none',
                  transition: 'width 0.12s ease, flex-basis 0.12s ease', ...noDrag }}>
                {t.id === '__night__' ? <Icon name="moon" size={13} style={{ color: colors.accent, flexShrink: 0 }} /> : <StarIcon species={t.species} size="sm" />}
                <span style={{ color: t.id === '__night__' ? colors.accent : colors.text, fontSize: 12,
                  overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{t.title}</span>
                {t.dirty && <StarPoint size={8} color={speciesColor[t.species] || colors.starNeutral} />}
                {active && (
                  <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', lineHeight: 0 }}>
                    <StarPoint size={7} color={colors.accent} />
                  </span>
                )}
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
      </div>

      <div style={{ flex: 1, minWidth: 0 }} />
    </div>
  )
}