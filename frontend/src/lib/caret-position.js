/**
 * Precise caret pixel measurement for <textarea> elements.
 *
 * PRIMARY: the browser's own caret rect. Chromium (WebView2) reflects a
 * focused textarea's selection into document.getSelection(); the
 * collapsed selection range's client rect IS the caret - the same rect
 * the layout engine uses for IME. It is exact at any depth, wrap, font,
 * padding or scroll, because the browser itself positioned it.
 *
 * FALLBACK: a hidden mirror div that clones the textarea's full computed
 * style, renders the content up to the caret, and uses a zero-width
 * marker span to find the caret. Used only when the native selection is
 * unavailable (typically when the textarea is not focused).
 *
 * Coordinate space: the reported position is viewport-relative to the
 * container (native/marker rect minus container rect). The canvas that
 * draws the caret is pinned over the scrollport (canvas.top =
 * host.scrollTop), so viewport-relative coordinates are exactly the
 * canvas-local coordinates it needs - no scroll math required, in either
 * single-edit mode (textarea scrolls internally) or split mode.
 */

/**
 * @param {HTMLTextAreaElement} ta
 * @param {HTMLElement} container - positioned ancestor the returned
 *        coordinates are relative to.
 * @returns {{x:number,y:number,w:number,h:number,fs:number,lh:number}|null}
 */
export function caretPosition(ta, container) {
  if (!ta || !container) return null

  const cs = getComputedStyle(ta)
  const fs = parseFloat(cs.fontSize) || 14
  const lh = parseFloat(cs.lineHeight) || fs * 1.6

  const native = nativeCaretRect(ta)
  if (native) {
    const hr = container.getBoundingClientRect()
    return {
      x: native.left - hr.left,
      y: native.top - hr.top,
      w: fs * 0.6,
      h: native.height > 0 ? native.height : lh,
      fs,
      lh,
    }
  }

  return mirrorCaretRect(ta, container, cs, fs, lh)
}

/**
 * The caret's client rect from the browser's own selection, or null when
 * the textarea has no native selection to read.
 */
function nativeCaretRect(ta) {
  const sel = window.getSelection?.()
  if (!sel || sel.rangeCount === 0) return null
  const n = sel.anchorNode
  if (!n) return null
  // Chromium reports the anchor as the textarea's internal text node
  // (ta.firstChild), not the element itself. Only trust the native rect
  // when the anchor is that text node - a range whose container is the
  // <textarea> element does not produce a caret-sized rect.
  if (n.nodeType !== 3 || n.parentNode !== ta) return null
  let range
  try { range = sel.getRangeAt(0) } catch { return null }
  const r = range.cloneRange()
  try {
    // The caret sits at the focus end of the selection; a backward drag
    // puts it at the start.
    r.collapse(ta.selectionDirection === 'backward')
  } catch {
    r.collapse(false)
  }
  if (!r.collapsed) return null
  const rect = r.getBoundingClientRect()
  if (!rect || (rect.width === 0 && rect.height === 0)) return null
  return rect
}

/**
 * Mirror-based fallback: clone the textarea's layout into a hidden div
 * and read the caret marker's position. Used only when the native
 * selection is unavailable.
 */
function mirrorCaretRect(ta, container, cs, fs, lh) {
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
  // container's top-left in the current view. The canvas is pinned over
  // the scrollport, so viewport-relative coordinates are exactly what it
  // needs - the host's own scroll cancels out here.
  //
  // The one exception: when the TEXTAREA scrolls internally (split mode,
  // or single-edit mode) the mirror renders the FULL content, so its
  // marker rect includes the internal scroll; subtract it to get back to
  // viewport coordinates.
  let x = r.left - hr.left
  let y = r.top - hr.top
  if (ta.scrollHeight > ta.clientHeight + 1) {
    x -= ta.scrollLeft || 0
    y -= ta.scrollTop || 0
  }

  return { x, y, w: fs * 0.6, h: r.height > 0 ? r.height : lh, fs, lh }
}