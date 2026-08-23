import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import StarIcon from './StarIcon'
import { colors, space } from '../lib/theme'
import { formatDate } from '../lib/format'

const HEAT_COLORS = [
  'rgba(90,106,122,0.08)',
  colors.starCool + '44',
  colors.starCool + '88',
  colors.starCool + 'cc',
  colors.starCool,
]

const STAGE_CONFIG = [
  { key: 'faintspeck', label: 'Faint speck', color: colors.starWarm },
  { key: 'dimstar', label: 'Dim star', color: colors.starCool },
  { key: 'steadystar', label: 'Steady star', color: colors.starNeutral },
  { key: 'brilliantstar', label: 'Brilliant star', color: colors.starPurple },
]

const MILESTONES = [
  { key: 'first_sprout_at', label: 'First note' },
  { key: 'first_tree_at', label: 'First star' },
  { key: 'ten_notes_at', label: '10 notes' },
  { key: 'twenty_notes_at', label: '20 notes' },
]

const sectionLabel = {
  fontSize: 11,
  fontWeight: 500,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

function Heatmap({ dailyCounts }) {
  const weeks = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)
    startDate.setDate(startDate.getDate() - startDate.getDay())
    const result = []
    const current = new Date(startDate)
    while (current <= today) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        week.push({
          date: key,
          label: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          count: dailyCounts?.[key] || 0,
        })
        current.setDate(current.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [dailyCounts])

  const maxCount = useMemo(() => {
    let max = 0
    for (const week of weeks) {
      for (const day of week) {
        if (day.count > max) max = day.count
      }
    }
    return Math.max(1, max)
  }, [weeks])

  function getColor(count) {
    if (count === 0) return HEAT_COLORS[0]
    const ratio = count / maxCount
    if (ratio <= 0.25) return HEAT_COLORS[1]
    if (ratio <= 0.5) return HEAT_COLORS[2]
    if (ratio <= 0.75) return HEAT_COLORS[3]
    return HEAT_COLORS[4]
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthLabels = useMemo(() => {
    const labels = []
    let lastMonth = -1
    for (let i = 0; i < weeks.length; i++) {
      const firstDay = weeks[i]?.[0]
      if (!firstDay) continue
      const m = new Date(firstDay.date).getMonth()
      if (m !== lastMonth) {
        labels.push({
          week: i,
          label: new Date(firstDay.date).toLocaleDateString(undefined, { month: 'short' }),
        })
        lastMonth = m
      }
    }
    return labels
  }, [weeks])

  return (
    <div style={{ marginBottom: space[4] }}>
      <div style={sectionLabel}>Activity</div>
      <div style={{ marginTop: space[2], overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 16 }}>
            {dayLabels.filter((_, i) => i % 2 === 1).map((d) => (
              <span key={d} style={{ fontSize: 9, color: colors.textDim, height: 11, lineHeight: '11px' }}>{d}</span>
            ))}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 2, height: 16, position: 'relative' }}>
              {monthLabels.map((m, i) => (
                <span key={i} style={{
                  position: 'absolute', left: m.week * 13,
                  fontSize: 9, color: colors.textDim,
                }}>{m.label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {week.map((day, di) => (
                    <div key={di}
                      data-tip={`${day.label}: ${day.count} note${day.count !== 1 ? 's' : ''}`}
                      style={{
                        width: 11, height: 11, borderRadius: 2,
                        background: getColor(day.count),
                        transition: 'background 200ms ease-out',
                        cursor: 'default',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: space[2], justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: colors.textDim }}>Less</span>
          {HEAT_COLORS.map((c, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
          ))}
          <span style={{ fontSize: 9, color: colors.textDim }}>More</span>
        </div>
      </div>
    </div>
  )
}

function DonutChart({ data, size = 140, strokeWidth = 16 }) {
  const [hovered, setHovered] = useState(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  let cumulative = 0
  const segments = data.filter(d => d.value > 0).map((d) => {
    const pct = total === 0 ? 0 : (d.value / total) * 100
    const dashLen = (pct / 100) * circumference
    const offset = (cumulative / 100) * circumference
    cumulative += pct
    return { ...d, dashLen, offset, pct }
  })

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="transparent" stroke={colors.border} strokeWidth={strokeWidth} />
        {segments.map((seg, i) => (
          <motion.circle key={seg.label}
            cx={size / 2} cy={size / 2} r={radius}
            fill="transparent" stroke={seg.color}
            strokeWidth={hovered === seg.label ? strokeWidth + 4 : strokeWidth}
            strokeDasharray={`${seg.dashLen} ${circumference}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="round"
            initial={{ opacity: 0, strokeDashoffset: circumference }}
            animate={{ opacity: 1, strokeDashoffset: -seg.offset }}
            transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
            style={{
              filter: hovered === seg.label ? `drop-shadow(0 0 6px ${seg.color})` : 'none',
              transition: 'filter 200ms ease-out, stroke-width 200ms ease-out',
              cursor: 'default',
            }}
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {hovered ? (
          <>
            <span style={{ fontSize: 18, fontWeight: 500, color: colors.text }}>
              {data.find(d => d.label === hovered)?.value || 0}
            </span>
            <span style={{ fontSize: 10, color: colors.textMuted }}>{hovered}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 18, fontWeight: 500, color: colors.text }}>{total}</span>
            <span style={{ fontSize: 10, color: colors.textMuted }}>total</span>
          </>
        )}
      </div>
    </div>
  )
}

function MilestoneTimeline({ milestones }) {
  const items = MILESTONES
    .map(m => ({ ...m, date: milestones?.[m.key] }))
    .filter(m => m.date)

  if (items.length === 0) {
    return (
      <div style={{ marginBottom: space[4] }}>
        <div style={sectionLabel}>Milestones</div>
        <div style={{ fontSize: 12, color: colors.textDim, marginTop: space[2] }}>
          No milestones yet
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: space[4] }}>
      <div style={sectionLabel}>Milestones</div>
      <div style={{ marginTop: space[2], position: 'relative', paddingLeft: 20 }}>
        <div style={{
          position: 'absolute', left: 5, top: 6, bottom: 6,
          width: 1, background: colors.border,
        }} />
        {items.map((item) => (
          <div key={item.key} style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: space[2],
            padding: '6px 0',
          }}>
            <div style={{
              position: 'absolute', left: -20,
              width: 12, height: 12, borderRadius: 6,
              background: colors.bg, border: `2px solid ${colors.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: colors.accent }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
                <StarIcon species="warm" size="sm" glow={false} />
                <span style={{ fontSize: 13, color: colors.text }}>{item.label}</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0 }}>
              {formatDate(item.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsOverlay({ stats }) {
  if (!stats) return null

  const donutData = useMemo(() => {
    if (!stats.stage_counts) return []
    return STAGE_CONFIG.map(s => ({
      label: s.label,
      value: stats.stage_counts[s.key] || 0,
      color: s.color,
    }))
  }, [stats.stage_counts])

  const streak = stats.current_streak ?? 0

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: space[5], color: colors.text }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: colors.text }}>Sky overview</h2>
      <p style={{ margin: `${space[1]}px 0 ${space[4]}px`, fontSize: 13, color: colors.textMuted }}>
        A look back at your notes.
      </p>

      <Heatmap dailyCounts={stats.daily_counts} />

      <div style={{ display: 'flex', gap: space[4], marginBottom: space[4], alignItems: 'center' }}>
        <div>
          <div style={{ ...sectionLabel, marginBottom: space[2] }}>Star stages</div>
          <DonutChart data={donutData} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: space[2] }}>
            {donutData.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: colors.textMuted }}>{d.label}</span>
                <span style={{ fontSize: 11, color: colors.text, marginLeft: 'auto' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 500, color: colors.text, lineHeight: 1.1 }}>{streak}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
            {streak > 0 ? 'day streak' : 'no streak yet'}
          </div>
          <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>
            {stats.longest_streak > 0 && `Longest: ${stats.longest_streak}`}
          </div>
        </div>
      </div>

      <MilestoneTimeline milestones={stats.milestones} />
    </div>
  )
}
