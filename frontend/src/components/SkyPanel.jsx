import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Circle, Line } from 'react-konva'
import { colors, space, typography } from '../lib/theme'
import Icon from './Icon'

const SPECIES = { warm: colors.starWarm, cool: colors.starCool, hot: colors.starHot, neutral: colors.starNeutral }

export default function SkyPanel({ notes, trails, activeId, onOpenNote, onExpand, skyName }) {
  const [query, setQuery] = useState('')
  const [size, setSize] = useState({ w: 264, h: 0 })
  const [pulsingId, setPulsingId] = useState(null)
  const prevActiveId = useRef(activeId)

  useEffect(() => {
    if (activeId && activeId !== prevActiveId.current) {
      setPulsingId(activeId)
      const t = setTimeout(() => setPulsingId(null), 400)
      prevActiveId.current = activeId
      return () => clearTimeout(t)
    }
    prevActiveId.current = activeId
  }, [activeId])

  const q = query.trim().toLowerCase()
  const visible = q
    ? notes.filter(n => n.title.toLowerCase().includes(q))
    : notes

  // Fit all stars into the stage.
  const layout = useMemo(() => {
    if (visible.length === 0) return { points: [], scale: 1, ox: 0, oy: 0 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of visible) {
      minX = Math.min(minX, n.world_x); maxX = Math.max(maxX, n.world_x)
      minY = Math.min(minY, n.world_y); maxY = Math.max(maxY, n.world_y)
    }
    const w = Math.max(maxX - minX, 1)
    const h = Math.max(maxY - minY, 1)
    const scale = Math.min((size.w - 40) / w, (size.h - 40) / h, 14)
    const ox = (size.w - w * scale) / 2 - minX * scale
    const oy = (size.h - h * scale) / 2 - minY * scale
    const points = visible.map(n => ({ ...n, x: n.world_x * scale + ox, y: n.world_y * scale + oy }))
    return { points, scale, ox, oy }
  }, [visible, size])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: space[2] }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted }}>{skyName || 'Sky'}</div>
          <button type="button" onClick={onExpand} aria-label="expand sky" data-tip="Full sky"
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', padding: 2 }}><Icon name="maximize" size={13} /></button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stars..."
          style={{ width: '100%', background: colors.bg, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: 14, padding: '6px 12px',
            fontSize: 12, outline: 'none' }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}
        ref={(el) => { if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight }) }}>
        {size.h > 0 && (
          <Stage width={size.w} height={size.h}>
            <Layer>
              {trails.map((t, i) => {
                const a = layout.points.find(p => p.id === t.note_a)
                const b = layout.points.find(p => p.id === t.note_b)
                if (!a || !b) return null
                return <Line key={i} points={[a.x, a.y, b.x, b.y]}
                  stroke={t.dimmed ? 'rgba(90,106,122,0.25)' : 'rgba(90,106,122,0.5)'} strokeWidth={1} />
              })}
              {layout.points.map(n => {
                const r = Math.min(4 + (n.visit_count || 0) * 0.15, 9)
                const active = n.id === activeId
                const pulsing = n.id === pulsingId
                return (
                  <Circle key={n.id} x={n.x} y={n.y}
                    radius={pulsing ? r + 6 : active ? r + 3 : r}
                    fill={SPECIES[n.species] || colors.starNeutral}
                    stroke={active ? colors.accentWarm : undefined} strokeWidth={active ? 2 : 0}
                    opacity={q && !visible.includes(n) ? 0.15 : 1}
                    animation={pulsing ? 'bounce' : undefined}
                    onClick={() => onOpenNote(n.id)}
                    onTap={() => onOpenNote(n.id)} />
                )
              })}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  )
}