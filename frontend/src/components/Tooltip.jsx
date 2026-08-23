/*
 * Portal tooltip layer. Renders one fixed-position tooltip above the app
 * via createPortal(document.body), so it can never be clipped by
 * overflow:auto/hidden containers the way CSS ::after tooltips were.
 *
 * Usage: <button data-tip="label">...</button>  (optionally data-tip-side="below")
 * Mount <TooltipLayer /> once at the app root.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors } from '../lib/theme'

const DELAY = 350
const GAP = 8
const TIP_KEYFRAMES = '@keyframes glean-tip-in { from { opacity: 0; transform: translate(-50%, -3px); } to { opacity: 1; transform: translate(-50%, 0); } }'

export default function TooltipLayer() {
  const [tip, setTip] = useState(null) // { text, left, top, anchorX }
  const timerRef = useRef(null)
  const currentElRef = useRef(null)

  useEffect(() => {
    const place = (el) => {
      const text = el.getAttribute('data-tip')
      if (!text) return null
      const r = el.getBoundingClientRect()
      const anchorX = r.left + r.width / 2
      let top = r.bottom + GAP
      let side = 'below'
      if (top + 26 > window.innerHeight - 8) {
        top = r.top - GAP
        side = 'above'
        if (top < 8) {
          top = r.bottom + GAP
          side = 'below'
        }
      }
      // Keep the popover inside the viewport; short labels are ~6px/char.
      const estW = Math.min(Math.max(text.length * 6 + 20, 40), 320)
      const left = Math.min(Math.max(anchorX, estW / 2 + 8), window.innerWidth - estW / 2 - 8)
      return { text, left, top, anchorX, side }
    }

    const show = () => {
      if (!currentElRef.current) return
      setTip(place(currentElRef.current))
    }

    const onOver = (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null
      if (!el) return
      if (el === currentElRef.current) return
      clearTimeout(timerRef.current)
      currentElRef.current = el
      timerRef.current = setTimeout(show, DELAY)
    }

    const onOut = (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null
      if (el && el === currentElRef.current) {
        clearTimeout(timerRef.current)
        currentElRef.current = null
        setTip(null)
      }
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    window.addEventListener('scroll', show, true)
    window.addEventListener('resize', show)
    return () => {
      clearTimeout(timerRef.current)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      window.removeEventListener('scroll', show, true)
      window.removeEventListener('resize', show)
    }
  }, [])

  if (!tip) return null
  return createPortal(
    <div style={{
      position: 'fixed', zIndex: 9999, pointerEvents: 'none',
      left: tip.left, top: tip.top,
      transform: `translate(-50%, ${tip.side === 'below' ? 0 : -100}%)`,
      padding: '5px 9px',
      background: colors.bgElevated,
      border: `1px solid ${colors.borderStrong}`,
      color: colors.text,
      fontSize: 11, lineHeight: 1.3, whiteSpace: 'nowrap',
      borderRadius: 6,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
      animation: 'glean-tip-in 0.16s ease-out',
    }}>
      {tip.text}
      <style>{TIP_KEYFRAMES}</style>
    </div>,
    document.body
  )
}
