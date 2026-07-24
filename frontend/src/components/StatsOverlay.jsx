import { useMemo } from 'react'
import { motion } from 'motion/react'
import StarIcon from './StarIcon'
import { colors, space } from '../lib/theme'
import { formatDate } from '../lib/format'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useReducedMotion } from '../hooks/useReducedMotion'

/* ── Close icon (X) ────────────────────────────────────── */

function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/* ── Milestone definitions (display labels only) ───────── */

const MILESTONES = [
  { key: 'first_sprout_at', label: 'First note', color: colors.starWarm },
  { key: 'first_tree_at', label: 'First star', color: colors.starCool },
  { key: 'ten_notes_at', label: '10 notes', color: colors.starNeutral },
  { key: 'twenty_notes_at', label: '20 notes', color: colors.starPurple },
]

/* ── Section label style ───────────────────────────────── */

const sectionLabel = {
  fontSize: 11,
  fontWeight: 500,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

/* ── Backdrop + card animation variants ────────────────── */

const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

const cardMotion = {
  initial: { opacity: 0, scale: 0.95, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.95, y: 12 },
}

/* Stats overlay. Centered card per STATS ref. */

export default function StatsOverlay({ stats, onClose }) {
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press
  // Build 7-day activity chart data (narrower window per ref)
  const chartData = useMemo(() => {
    if (!stats?.daily_counts) return []
    const days = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({
        date: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: stats.daily_counts[key] || 0,
      })
    }
    return days
  }, [stats?.daily_counts])

  // Y-axis scale: 0, 3, 6 (match ref)
  const yMax = Math.max(6, ...chartData.map(d => d.count * 1.2))

  if (!stats) return null

  return (
    <motion.div
      initial={backdropMotion.initial}
      animate={backdropMotion.animate}
      exit={backdropMotion.exit}
      transition={{ duration: motionTokens.duration.fast }}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(10, 14, 20, 0.92)', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={cardMotion.initial}
        animate={cardMotion.animate}
        exit={cardMotion.exit}
        transition={springs.gentle}
        style={{
          background: '#1a2030',
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: space[4],
          color: colors.text,
          width: 440,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space[1] }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: colors.text }}>Sky overview</h2>
            <p style={{ margin: `${space[1]}px 0 0`, fontSize: 13, color: colors.textMuted }}>
              A look back at your notes.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              background: 'none', border: 'none', padding: 6,
              borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 160ms ease-out, transform 160ms ease-out',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(90,106,122,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
          >
            <IconClose size={16} />
          </motion.button>
        </div>

        {/* ── 7-day chart ── */}
        <div style={{ marginBottom: space[4] }}>
          <div style={sectionLabel}>Notes created</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginTop: space[2], position: 'relative' }}>
            {/* Y-axis labels */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              <span style={{ fontSize: 10, color: colors.textDim }}>{Math.round(yMax)}</span>
              <span style={{ fontSize: 10, color: colors.textDim }}>{Math.round(yMax / 2)}</span>
              <span style={{ fontSize: 10, color: colors.textDim }}>0</span>
            </div>
            {/* Bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flex: 1, marginLeft: 24 }}>
              {chartData.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    title={`${day.label}: ${day.count}`}
                    style={{
                      width: '100%',
                      height: `${Math.max(2, (day.count / yMax) * 100)}%`,
                      background: day.count > 0 ? colors.accent : 'rgba(90,106,122,0.1)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: 2,
                      transition: 'height 300ms ease-out',
                    }}
                  />
                  <span style={{ fontSize: 9, color: colors.textDim, whiteSpace: 'nowrap' }}>{day.label.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Streaks. Two columns with vertical divider. */}
        <div style={{ marginBottom: space[4], display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 500, color: colors.text, lineHeight: 1.2 }}>{stats.current_streak}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>current streak</div>
          </div>
          <div style={{ width: 1, height: 40, background: colors.border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 500, color: colors.text, lineHeight: 1.2 }}>{stats.longest_streak}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>longest streak</div>
          </div>
        </div>

        {/* ── Milestones ── */}
        <div>
          <div style={{ ...sectionLabel, marginBottom: space[2] }}>Milestones</div>
          {MILESTONES.map(({ key, label, color }) => {
            const dateStr = stats.milestones?.[key]
            if (!dateStr) return null
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${space[1] - 4}px 0`,
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                  <StarIcon color={color} size="sm" glow={false} />
                  <span style={{ fontSize: 13, color: colors.text }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, color: colors.textMuted }}>{formatDate(dateStr)}</span>
              </div>
            )
          })}
          {!MILESTONES.some(({ key }) => stats.milestones?.[key]) && (
            <div style={{ fontSize: 12, color: colors.textDim, padding: `${space[1]}px 0` }}>
              No milestones yet
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
