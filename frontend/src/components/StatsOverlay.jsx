import { useMemo } from 'react'
import StarIcon from './StarIcon'
import { colors, space } from '../lib/theme'
import { formatDate } from '../lib/format'

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

// Local calendar date key, matching the Go side's dateKey.
function localDateKey(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/* Stats pane. Inline in the workspace, not an overlay. */

export default function StatsOverlay({ stats }) {
  // Build 7-day activity chart data with local dates.
  const chartData = useMemo(() => {
    if (!stats?.daily_counts) return []
    const days = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = localDateKey(d)
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
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space[5], color: colors.text }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: colors.text }}>Sky overview</h2>
      <p style={{ margin: `${space[1]}px 0 ${space[4]}px`, fontSize: 13, color: colors.textMuted }}>
        A look back at your notes.
      </p>

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
    </div>
  )
}