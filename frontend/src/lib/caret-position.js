/**
 * Precise caret pixel measurement for <textarea> elements.
 *
 * A textarea's caret is not exposed anywhere on the DOM, so we replicate
 * its layout: a hidden mirror div clones the textarea's full computed
 * style, renders the content up to the caret, and a zero-width marker
 * span marks the caret. Reading the marker's layout rect gives the
 * caret's position pixel-perfectly - wrap-aware, font-aware, padding and
 * scrollbar aware.
 *
 * Coordinate space: the reported position is the caret's position in
 * CONTENT coordinates relative to the container's content origin. The
 *canvas that draws the caret is re-pinned to the scrollport on every
 * scroll (canvas.top = host.scrollTop), so content coordinates map to the
 * correct on-screen pixels regardless of who scrolls.
 */

/**
 * @param {HTMLTextAreaElement} ta
 * @param {HTMLElement} container - positioned ancestor the returned
 *        coordinates are relative to its content area.
 * @returns {{x:number,y:number,w:number,h:number,fs:number}|null}
 */
export function caretPosition(ta, container) {
  if (!ta || !container) return null

  const cs = getComputedStyle(ta)
  const fs = parseFloat(cs.fontSize) || 14
  const lh = parseFloat(cs.lineHeight) || fs * 1.6
  // The absolute mirror is positioned at the host's padding box origin;
  // the textarea's own content starts at the host's CONTENT box (it lies
  // inside the host's padding). Offset the mirror by the host's padding
  // so both texts share the same origin.
  const hcs = getComputedStyle(container)
  const padTop = parseFloat(hcs.paddingTop) || 0
  const padLeft = parseFloat(hcs.paddingLeft) || 0

  let mirror = ta._caretMirror
  if (mirror && mirror._host !== container) {
    mirror.remove()
    mirror = null
  }
  if (!mirror) {
    mirror = document.createElement('div')
    mirror._host = container
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i]
      if (['position', 'top', 'left', 'right', 'bottom', 'z-index', 'visibility',
        'pointer-events', 'overflow', 'resize', 'cursor', 'display', 'width',
        'height', 'margin', 'float', 'opacity', 'contain'].includes(prop)) continue
      mirror.style.setProperty(prop, cs.getPropertyValue(prop), cs.getPropertyPriority(prop))
    }
    Object.assign(mirror.style, {
      position: 'absolute',
      left: padLeft + 'px',
      top: padTop + 'px',
      boxSizing: 'border-box',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
      margin: '0',
      resize: 'none',
      width: '0px',
    })
    container.appendChild(mirror)
    ta._caretMirror = mirror
  } else {
    mirror.style.top = padTop + 'px'
    mirror.style.left = padLeft + 'px'
  }

  // clientWidth already excludes a vertical scrollbar, so the wrap width
  // matches the textarea exactly - never subtract the scrollbar again.
  mirror.style.width = Math.max(1, ta.clientWidth) + 'px'

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

  const hr = container.getBoundingClientRect()
  // Marker rect minus container rect is the caret offset from the
  // container's top-left IN THE SCROLLED VIEW (viewport-relative).
  // The canvas is pinned over the scrollport (canvas.top = host.scrollTop),
  // so viewport-relative coordinates are exactly what it needs - the
  // host's own scroll cancels out here.
  //
  // The one exception: in split mode the TEXTAREA scrolls internally
  // (the host does not) and the mirror renders the FULL content, so its
  // marker rect includes the internal scroll; subtract it to get back
  // to viewport coordinates.
  let x = r.left - hr.left
  let y = r.top - hr.top
  if (ta.scrollHeight > ta.clientHeight + 1) {
    x -= ta.scrollLeft || 0
    y -= ta.scrollTop || 0
  }

  return { x, y, w: fs * 0.6, h: r.height > 0 ? r.height : lh, fs, lh }
}