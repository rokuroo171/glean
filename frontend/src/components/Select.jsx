import { useState, useRef, useEffect } from 'react'
import { colors } from '../lib/theme'

export default function Select({ value, options, onChange, style }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const [dropUp, setDropUp] = useState(false)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const estimated = Math.min(options.length, 8) * 30 + 8
    setDropUp(rect.bottom + estimated > window.innerHeight && rect.top > estimated)
  }, [open, options.length])

  let lastGroup = null
  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12,
          background: colors.bg, border: '1px solid ' + colors.border,
          color: colors.text, cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          outline: 'none' }}>
        <span>{current?.label || value}</span>
        <span style={{ color: colors.textMuted, fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 60,
          ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
          maxHeight: 240, overflowY: 'auto',
          background: colors.bgElevated, border: '1px solid ' + colors.border,
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {options.map(o => {
            const groupHeader = o.group && o.group !== lastGroup ? o.group : null
            lastGroup = o.group
            return (
              <div key={o.value}>
                {groupHeader && (
                  <div style={{ padding: '6px 10px 2px', fontSize: 10, color: colors.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    borderBottom: `1px solid ${colors.border}`,
                    position: 'sticky', top: 0, background: colors.bgElevated }}>
                    {groupHeader}
                  </div>
                )}
                <button type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '8px 10px',
                    background: o.value === value ? colors.accent + '22' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, color: o.value === value ? colors.accent : colors.text,
                    transition: 'background 100ms ease-out' }}
                  onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'rgba(90,106,122,0.1)' }}
                  onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}>
                  {o.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
