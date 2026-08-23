import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors } from '../lib/theme'
import Icon from './Icon'

const ITEM_H = 30
const SEP_H = 9
const PAD = 5

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), Math.max(min, max))
}

function measure(items) {
  let h = PAD * 2
  for (const it of items) h += it.type === 'separator' ? SEP_H : ITEM_H
  return h
}

/**
 * Right-click context menu.
 *
 * items: array of
 *   { id, type: 'separator' }                     -> divider
 *   { id, label, icon?, shortcut?, disabled?, onSelect? } -> item
 *
 * Children are wrapped; right-clicking them (or pressing the menu key /
 * Shift+F10 while they are focused) opens the menu at the cursor.
 */
export default function ContextMenu({ items, onSelect, width = 220, triggerStyle, children }) {
  const [pos, setPos] = useState(null)
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState(-1)
  const menuRef = useRef(null)
  const itemRefs = useRef([])
  const listRef = useRef(items)
  listRef.current = items
  const emitRef = useRef(onSelect)
  emitRef.current = onSelect
  const activeRef = useRef(-1)
  activeRef.current = active
  const queryRef = useRef('')
  const queryTimer = useRef(null)

  const height = useMemo(() => measure(items), [items])

  const steps = useMemo(() => {
    const out = []
    items.forEach((it, i) => { if (it.type !== 'separator' && !it.disabled) out.push(i) })
    return out
  }, [items])

  const close = useCallback(() => {
    setPos(null)
    setShown(false)
    setActive(-1)
  }, [])

  const openAt = useCallback((x, y) => {
    if (!items || items.length === 0) return
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const w = Math.min(width, Math.max(160, vw - 16))
    const h = Math.min(height, Math.max(ITEM_H + PAD * 2, vh - 16))
    const left = clamp(x + w + 8 <= vw ? x : x - w, 8, vw - w - 8)
    const top = clamp(y + h + 8 <= vh ? y : y - h, 8, vh - h - 8)
    setPos({ left, top, width: w, height: h, origin: `${clamp(x - left, 0, w)}px ${clamp(y - top, 0, h)}px` })
    setActive(-1)
    setShown(false)
    // Mount invisible, then flip to visible next frame so the transition plays.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
  }, [items, width, height])

  const choose = useCallback((index) => {
    const it = listRef.current[index]
    if (!it || it.type === 'separator' || it.disabled) return
    close()
    if (it.onSelect) it.onSelect(it.id)
    if (emitRef.current) emitRef.current(it.id)
  }, [close])

  const step = useCallback((dir) => {
    const order = steps
    if (order.length === 0) return
    const at = order.indexOf(activeRef.current)
    setActive(at === -1
      ? (dir === 1 ? order[0] : order[order.length - 1])
      : order[(at + dir + order.length) % order.length])
  }, [steps])

  const edge = useCallback((which) => {
    const order = steps
    if (order.length === 0) return
    setActive(which === 'first' ? order[0] : order[order.length - 1])
  }, [steps])

  const typeahead = useCallback((char) => {
    queryRef.current += char.toLowerCase()
    if (queryTimer.current) clearTimeout(queryTimer.current)
    queryTimer.current = setTimeout(() => { queryRef.current = '' }, 600)
    const order = steps
    const from = order.indexOf(activeRef.current) + 1
    for (let k = 0; k < order.length; k++) {
      const index = order[(from + k) % order.length]
      const it = listRef.current[index]
      if (it.type !== 'separator' && it.label.toLowerCase().startsWith(queryRef.current)) {
        setActive(index)
        return
      }
    }
  }, [steps])

  // Focus the active item (or the menu) and keep it visible.
  useEffect(() => {
    if (!pos) return
    const node = active >= 0 ? itemRefs.current[active] : menuRef.current
    if (node) {
      node.focus({ preventScroll: true })
      if (active >= 0) node.scrollIntoView({ block: 'nearest' })
    }
  }, [pos, active])

  // Close on outside pointer down, scroll, resize, blur, or Escape.
  useEffect(() => {
    if (!pos) return
    const inside = (t) => menuRef.current && menuRef.current.contains(t)
    const onDown = (e) => { if (!inside(e.target)) close() }
    const onScroll = (e) => { if (!inside(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    const bail = () => close()
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', bail)
    window.addEventListener('blur', bail)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', bail)
      window.removeEventListener('blur', bail)
    }
  }, [pos, close])

  useEffect(() => () => {
    if (queryTimer.current) clearTimeout(queryTimer.current)
  }, [])

  const hasIcons = items.some(it => it.type !== 'separator' && it.icon)

  return (
    <>
      <span
        style={triggerStyle || { display: 'inline' }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openAt(e.clientX, e.clientY)
        }}
        onKeyDown={(e) => {
          if (pos) return
          const wants = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')
          if (!wants) return
          e.preventDefault()
          const child = e.currentTarget.firstElementChild
          const r = (child || e.currentTarget).getBoundingClientRect()
          openAt(Math.round(r.left + 14), Math.round(r.top + 14))
        }}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              step(e.key === 'ArrowDown' ? 1 : -1)
              return
            }
            if (e.key === 'Home' || e.key === 'End') {
              e.preventDefault()
              edge(e.key === 'Home' ? 'first' : 'last')
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              choose(active)
              return
            }
            if (e.key === 'Tab') {
              e.preventDefault()
              close()
              return
            }
            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeahead(e.key)
          }}
          style={{
            position: 'fixed', left: pos.left, top: pos.top, width: pos.width,
            maxHeight: pos.height, overflowY: 'auto', zIndex: 1000,
            background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`,
            borderRadius: 10, padding: PAD, boxShadow: colors.shadow,
            transformOrigin: pos.origin,
            opacity: shown ? 1 : 0,
            transform: shown ? 'scale(1)' : 'scale(0.96)',
            transition: 'opacity 0.12s ease, transform 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
            outline: 'none',
          }}
        >
          {items.map((it, index) => it.type === 'separator' ? (
            <div key={it.id} style={{ padding: '3px 2px' }}>
              <div style={{ height: 1, background: colors.border }} />
            </div>
          ) : (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={it.disabled}
              ref={(n) => { itemRefs.current[index] = n }}
              onPointerMove={() => { if (active !== index && !it.disabled) setActive(index) }}
              onClick={() => choose(index)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: ITEM_H,
                padding: '0 10px', borderRadius: 7, border: 'none', cursor: 'default',
                background: active === index ? 'rgba(180, 140, 80, 0.14)' : 'transparent',
                color: it.disabled ? colors.textDim : colors.text,
                fontSize: 12.5, textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              {hasIcons ? (
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, flexShrink: 0,
                  color: it.disabled ? colors.textDim : colors.textMuted,
                }}>
                  {it.icon ? <Icon name={it.icon} size={14} /> : null}
                </span>
              ) : null}
              <span style={{
                flex: 1, minWidth: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {it.label}
              </span>
              {it.shortcut ? (
                <span style={{
                  fontSize: 10.5, color: colors.textDim,
                  fontFamily: 'Consolas, monospace', flexShrink: 0,
                }}>
                  {it.shortcut}
                </span>
              ) : null}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
