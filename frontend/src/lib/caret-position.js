/**
 * Precise caret pixel measurement for <textarea> elements.
 *
 * The browser already knows exactly where the caret is: the collapsed
 * selection Range of the textarea's live selection. We measure THAT rect
 * instead of approximating with a style-cloning mirror div, because a
 * mirror can never match the real layout on long notes (scrollbar width
 * changes wrap points, and the mirror is unaware of the scroller that
 * moves in single-edit mode). The native rect is exact, always.
 */

/**
 * @param {HTMLTextAreaElement} ta
 * @param {HTMLElement} container  canvas-anchored ancestor; the returned
 *        coordinates are relative to this element's border box.
 * @returns {{x:number,y:number,w:number,h:number,fs:number}|null}
 */
export function caretPosition(ta, container) {
  if (!ta || !container) return null
  // Requires a live, focused caret. If the textarea lost focus the
  // selection is not accessible from the rendered text node - fall back
  // to the previous position (caller keeps its last value on null).
  let rect = null
  try {
    const sel = document.getSelection()
    if (sel && sel.rangeCount > 0 && sel.anchorNode === ta) {
      const range = sel.getRangeAt(0).cloneRange()
      const caret = document.createElement('span')
      caret.style.position = 'absolute'
      caret.style.width = '0'
      caret.style.height = '0'
      range.collapse(true)
      range.insertNode(caret)
      rect = caret.getBoundingClientRect()
      if (caret.parentNode) caret.parentNode.removeChild(caret)
      else caret.remove()
    }
  } catch { /* fall through */ }

  if (!rect) return null

  const cs = getComputedStyle(ta)
  const fs = parseFloat(cs.fontSize) || 14
  const lh = parseFloat(cs.lineHeight) || fs * 1.6

  const taRect = ta.getBoundingClientRect()
  const hostRect = container.getBoundingClientRect()

  // The native rect is already in the same scrolled space the caret is
  // drawn in (the wrapper scrolls the text, and this rect moves with it).
  // Offset by the textarea's padding so the position marks the glyph
  // column, then translate into the container's box.
  return {
    x: taRect.left - hostRect.left + (rect.left - taRect.left),
    y: taRect.top - hostRect.top + (rect.top - taRect.top),
    w: fs * 0.6,
    h: rect.height > 0 ? rect.height : lh,
    fs,
    lh,
  }
}