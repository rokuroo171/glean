import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { colors } from '../lib/theme'

// Custom dropdown. The option list renders through a portal in a fixed
// position layer: the settings panel and other hosts scroll and clip, so
// an absolutely positioned list gets cut off to a sliver. Fixed position
// plus viewport coordinates escapes every overflow ancestor; flip above
// the button when the list would run past the viewport bottom
export default function Select({ value, options, onChange, style }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 })
  const ref = useRef(null)
  const listRef = useRef(null)
  const btnRef = useRef(null)

  const current = options.find(o => o.value === value)

  const place = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const estimated = Math.min(options.length, 8) * 30 + 8
    const below = rect.bottom + estimated <= window.innerHeight
    setDropUp(!below && rect.top > estimated)
    setPos({ left: rect.left, top: below ? rect.bottom : rect.top, width: rect.width })
  }

  useEffect(() => {
    if (!open) return
    place()
    function onDown(e) {
      // outside both the trigger wrapper and the ported list closes; the
      // trigger itself must stay inside so its click can toggle closed
      const t = e.target
      if (!ref.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false)
    }
    function onScrollOrResize() { place() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, options.length])

  // the last group header sticky logic lives in the list; the portal body
  // re-renders on every open so lastGroup resets naturally
  let lastGroup = null

  const list = open && (
    <div
      ref={listRef}
      style={{
        position: 'fixed', left: pos.left, top: dropUp ? undefined : pos.top + 4,
        bottom: dropUp ? window.innerHeight - pos.top - 4 : undefined, width: pos.width,
        zIndex: 1000, maxHeight: 280, overflowY: 'auto',
        background: colors.bgElevated, border: '1px solid ' + colors.border,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
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
  )

  return (
    <div style={{ position: 'relative', ...style }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12,
          background: colors.bg, border: '1px solid ' + colors.border,
          color: colors.text, cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          outline: 'none' }}>
        <span>{current?.label || value}</span>
        <span style={{ color: colors.textMuted, fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {createPortal(list, document.body)}
    </div>
  )
}
