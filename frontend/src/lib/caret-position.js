/**
 * Precise caret pixel measurement for <textarea> elements.
 *
 * Browsers never expose a textarea's caret position on the DOM, so we
 * replicate its layout: a hidden mirror div renders the textarea's full
 * computed style plus its content up to the caret, with a zero-width
 * marker span at the caret. The marker's rect IS the caret.
 *
 * Two details keep the mirror pixel-exact on long notes:
 * - the mirror width excludes the scrollbar, so lines wrap exactly like
 *   the textarea (a scrollbar shrinks the wrap width; a wider mirror
 *   would hold more chars per line and drift on every wrapped row);
 * - caret coordinates are compensated for the scroller that actually
 *   moves (the textarea scrolls internally; in single-edit mode the
 *   wrapper scrolls and the mirror/canvas ride along with it).
 */

const STYLE_BLOCKLIST = new Set([
  'position', 'top', 'left', 'right', 'bottom', 'z-index',
  'visibility', 'pointer-events', 'overflow', 'resize', 'cursor',
  'display', 'width', 'height', 'margin', 'float', 'opacity',
])

/**
 * @param {HTMLTextAreaElement} ta
 * @param {HTMLElement} container  anchored ancestor (position:relative) the
 *        returned coordinates are relative to.
 * @returns {{x:number,y:number,w:number,h:number,fs:number}|null}
 */
export function caretPosition(ta, container) {
  if (!ta || !container) return null

  const cs = getComputedStyle(ta)
  const host = container

  let mirror = ta._caretMirror
  if (mirror && mirror._host !== host) {
    mirror.remove()
    mirror = null
  }
  if (!mirror) {
    mirror = document.createElement('div')
    mirror._host = host
    // Clone every computed property so layout matches the textarea exactly.
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i]
      mirror.style.setProperty(prop, cs.getPropertyValue(prop), cs.getPropertyPriority(prop))
    }
    Object.assign(mirror.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      boxSizing: 'border-box',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
      margin: '0',
      resize: 'none',
      width: '0px',
    })
    host.appendChild(mirror)
    ta._caretMirror = mirror
  }

  const fs = parseFloat(cs.fontSize) || 14
  const lh = parseFloat(cs.lineHeight) || fs * 1.6

  // A vertical scrollbar steals horizontal space and moves the wrap point.
  // The mirror must wrap at the SAME width or every wrapped line lands
  // one character right of the textarea's lines.
  const taScrollable = ta.scrollHeight > ta.clientHeight + 1
  const borderLR = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
  const sbW = taScrollable ? Math.max(0, ta.offsetWidth - ta.clientWidth - borderLR) : 0
  mirror.style.width = Math.max(1, ta.clientWidth - sbW) + 'px'

  const sel = ta.selectionEnd ?? ta.selectionStart ?? 0
  mirror.textContent = ta.value.slice(0, sel)
  const marker = document.createElement('span')
  marker.style.display = 'inline'
  // Zero-width NO-BREAK marker: has no width so it never moves the wrap
  // point, and unlike a zero-width space it cannot introduce a line
  // break right where we are measuring.
  marker.textContent = '\uFEFF'
  mirror.appendChild(marker)
  const r = marker.getBoundingClientRect()
  try { marker.remove() } catch { /* noop */ }

  const hr = host.getBoundingClientRect()
  let x = r.left - hr.left
  let y = r.top - hr.top
  // The scroller moves the caret on screen. In split mode the textarea
  // scrolls internally, and the canvas/drawn caret must follow. In
  // single-edit mode the WRAPPER scrolls and the mirror rides along with
  // it, so no compensation is needed.
  if (taScrollable) {
    x -= ta.scrollLeft || 0
    y -= ta.scrollTop || 0
  }

  return {
    x,
    y,
    w: fs * 0.6,
    h: r.height > 0 ? r.height : lh,
    fs,
    lh,
  }
}