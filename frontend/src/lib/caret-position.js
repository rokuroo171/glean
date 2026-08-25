/**
 * Precise caret pixel measurement for <textarea> elements.
 *
 * PRIMARY: the browser's own caret. While a textarea is focused, Chromium
 * (WebView2) reflects the edit caret in document.getSelection(). The
 * selection's anchor is the textarea's INTERNAL text node (ta.firstChild),
 * not the textarea element itself. The collapsed range's client rect IS
 * the caret rect - exact, scroll-aware, wrap-aware, at any note depth.
 *
 * FALLBACK: a hidden mirror div with the textarea's full computed style,
 * content up to the caret and a zero-width marker. The marker's rect is
 * the caret. The mirror only runs when the selection is unavailable
 * (unfocused, or a non-WebView2 engine), and it compensates for the
 * scroller that actually moves.
 */

/**
 * @param {HTMLTextAreaElement} ta
 * @param {HTMLElement} container  anchored ancestor the returned
 *        coordinates are relative to.
 * @returns {{x:number,y:number,w:number,h:number,fs:number}|null}
 */
export function caretPosition(ta, container) {
  if (!ta || !container) return null

  const cs = getComputedStyle(ta)
  const fs = parseFloat(cs.fontSize) || 14
  const lh = parseFloat(cs.lineHeight) || fs * 1.6
  const hostRect = container.getBoundingClientRect()

  const native = nativeCaretRect(ta)
  if (native) {
    // The native rect is in viewport space. The drawing canvas is pinned
    // to the visible area (sticky) and does not scroll with the content,
    // so viewport coordinates are exactly what it needs - no scroll
    // compensation on either axis.
    return {
      x: native.left - hostRect.left,
      y: native.top - hostRect.top,
      w: fs * 0.6,
      h: native.height > 0 ? native.height : lh,
      fs,
      lh,
    }
  }

  return mirrorCaretRect(ta, container, cs, lh)
}

/**
 * The browser's own caret rect, from the document selection. Works while
 * the textarea is focused; the anchor is the textarea's internal text
 * node, NOT the element. Returns null when there is no usable selection.
 */
function nativeCaretRect(ta) {
  let sel
  try {
    sel = document.getSelection()
  } catch { return null }
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed === false) return null
  const anchor = sel.anchorNode
  const inTa = anchor === ta ||
    (anchor && anchor.nodeType === Node.TEXT_NODE && anchor.parentElement === ta)
  if (!inTa) return null
  const range = sel.getRangeAt(0)
  if (!range || range.collapsed === false) return null
  const rects = range.getClientRects()
  const rect = rects && rects.length > 0 ? rects[0] : null
  if (!rect || !isFinite(rect.left) || !isFinite(rect.top)) return null
  // A degenerate caret rect has width 0; reject a zero-zero rect that
  // appears when the document selection is a blank artefact.
  if (rect.left === 0 && rect.top === 0 && rect.width === 0 && rect.height === 0) return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/**
 * Mirror fallback: the textarea's layout clone with its content up to the
 * caret and a zero-width marker. Scroll-compensated for the scroller that
 * actually moves (textarea internal scroll in split; the wrapper scrolls
 * and the mirror rides along in single-edit mode).
 */
function mirrorCaretRect(ta, container, cs, lh) {
  const host = container

  let mirror = ta._caretMirror
  if (mirror && mirror._host !== host) {
    mirror.remove()
    mirror = null
  }
  if (!mirror) {
    mirror = document.createElement('div')
    mirror._host = host
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i]
      if (['position', 'top', 'left', 'right', 'bottom', 'z-index', 'visibility',
        'pointer-events', 'overflow', 'resize', 'cursor', 'display', 'width',
        'height', 'margin', 'float', 'opacity'].includes(prop)) continue
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

  // clientWidth already excludes the scrollbar, so this is exactly the
  // textarea's wrap width - do NOT subtract the scrollbar again or lines
  // wrap early and drift row by row on long notes.
  mirror.style.width = Math.max(1, ta.clientWidth) + 'px'

  const sel = ta.selectionEnd ?? ta.selectionStart ?? 0
  mirror.textContent = ta.value.slice(0, sel)
  const marker = document.createElement('span')
  marker.style.display = 'inline'
  marker.textContent = '\uFEFF'
  mirror.appendChild(marker)
  const r = marker.getBoundingClientRect()
  try { marker.remove() } catch { /* noop */ }

  const hr = host.getBoundingClientRect()
  // The mirror marker rect is also viewport space; the sticky drawing
  // layer takes it directly. No scroll compensation on either axis.
  return { left: r.left - hr.left, top: r.top - hr.top, width: 0, height: r.height > 0 ? r.height : lh }
}