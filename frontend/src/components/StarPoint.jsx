/** Four-point star marker: dirty dots, active indicators, divider nodes */
export default function StarPoint({ size = 8, color }) {
  const c = size / 2
  const d = `M ${c} 0 Q ${c} ${c} ${size} ${c} Q ${c} ${c} ${c} ${size} Q ${c} ${c} 0 ${c} Q ${c} ${c} ${c} 0 Z`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}>
      <path d={d} fill={color} />
    </svg>
  )
}
