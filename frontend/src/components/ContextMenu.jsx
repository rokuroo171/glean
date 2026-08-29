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
  const [openSubmenu, setOpenSubmenu] = useState(null) // id of the item whose nested menu is open
  const menuRef = useRef(null)
  const nestedRef = useRef(null)
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
    setOpenSubmenu(null)
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
    // A submenu parent opens its nested menu instead of closing the whole
    // menu (clicking the parent shouldn't dismiss everything).
    if (it.submenu) {
      setOpenSubmenu(it.id)
      return
    }
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
    // The nested submenu renders in its own portal; treat it as part of
    // the menu so clicking its entries never counts as an outside click.
    const inside = (t) =>
      (menuRef.current && menuRef.current.contains(t)) ||
      (nestedRef.current && nestedRef.current.contains(t))
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
              onMouseEnter={() => {
                if (it.disabled) return
                // Hovering a submenu parent opens it; hovering any other
                // item closes the open submenu so it never lingers.
                if (it.submenu) setOpenSubmenu(it.id)
                else setOpenSubmenu(null)
              }}
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
              {it.submenu ? (
                <span style={{ fontSize: 11, color: colors.textDim, flexShrink: 0 }}>›</span>
              ) : null}
            </button>
          ))}
          {openSubmenu && (() => {
            const idx = items.findIndex(it => it.id === openSubmenu)
            const parent = items[idx]
            if (!parent || !parent.submenu) return null
            return (
              <NestedMenu
                parent={parent}
                anchor={itemRefs.current[idx]}
                onClose={close}
                innerRef={nestedRef}
              />
            )
          })()}
        </div>,
        document.body
      )}
    </>
  )
}


/** A small popover listing a parent menu item's submenu entries.
 *  Renders beside the parent item and closes when the user clicks an
 *  entry or anywhere outside. */
function NestedMenu({ parent, anchor, onClose, innerRef }) {
  const ref = useRef(null)
  // Expose this popover's root node so the parent menu can treat it as
  // inside the menu (clicks on nested entries must not close everything).
  useEffect(() => {
    if (innerRef) innerRef.current = ref.current
  }, [innerRef])
  const [shown, setShown] = useState(false)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const items = parent.submenu || []
    const h = Math.min(items.length * ITEM_H + PAD * 2, document.documentElement.clientHeight - 16)
    let left = r.right + 6
    if (left + 200 > document.documentElement.clientWidth - 8) left = r.left - 206
    let top = r.top
    if (top + h > document.documentElement.clientHeight - 8) top = Math.max(8, document.documentElement.clientHeight - h - 8)
    setPos({ left, top, width: 200, height: h })
    // Mount invisible, flip visible next frame so the transition plays.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
  }, [anchor, parent])

  useEffect(() => {
    if (!pos) return
    const onDown = (e) => {
      if (!ref.current || !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [pos, onClose])

  return createPortal(
    <div ref={ref} role="menu" tabIndex={-1} style={{
      position: 'fixed', left: pos?.left, top: pos?.top, width: pos?.width || 200,
      maxHeight: pos?.height, overflowY: 'auto', zIndex: 1001,
      background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`,
      borderRadius: 10, padding: PAD, boxShadow: colors.shadow,
      opacity: shown ? 1 : 0,
      transform: shown ? 'scale(1)' : 'scale(0.96)',
      transition: 'opacity 0.12s ease, transform 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
      outline: 'none',
    }}>
      {(parent.submenu || []).map((it, i) => (
        <NestedItem key={it.id} it={it} index={i} onClose={onClose} />
      ))}
    </div>,
    document.body
  )
}

/** One entry in a nested submenu, with hover highlight like the parent
 *  menu items so users can see it's reachable. */
function NestedItem({ it, index, onClose }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={it.disabled}
      onPointerEnter={() => { if (!it.disabled) setHover(true) }}
      onPointerLeave={() => setHover(false)}
      onClick={() => { if (it.onSelect) it.onSelect(it.id); onClose() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: ITEM_H,
        padding: '0 10px', borderRadius: 7, border: 'none', cursor: 'default',
        background: hover ? 'rgba(180, 140, 80, 0.14)' : 'transparent',
        color: it.disabled ? colors.textDim : colors.text,
        fontSize: 12.5, textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, flexShrink: 0, color: it.disabled ? colors.textDim : colors.textMuted }}>
        {it.icon ? <Icon name={it.icon} size={14} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {it.label}
      </span>
      {it.shortcut ? (
        <span style={{ fontSize: 10.5, color: colors.textDim, fontFamily: 'Consolas, monospace', flexShrink: 0 }}>
          {it.shortcut}
        </span>
      ) : null}
    </button>
  )
}
