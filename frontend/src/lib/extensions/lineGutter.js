import { Plugin, PluginKey } from 'prosemirror-state'

// Numbers every visual line, Word-style: a paragraph wrapped over three
// lines gets three numbers, so the gutter stays truthful under any wrap
// setting. Enable/wrap come from a plain state object the React side
// mutates, so prefs toggle without rebuilding the editor
export const lineGutterKey = new PluginKey('glean-line-gutter')

const LEAF_BLOCK = 'p, h1, h2, h3, h4, h5, h6, pre, td, th'
// two distinct lines are never closer than a small code line; 8px absorbs
// same-row table cells and same-line inline fragments
const LINE_MERGE_PX = 8

class GutterView {
  constructor(view, state) {
    this.view = view
    this.state = state
    this.pending = 0
    this.scroller = view.dom.closest('.milkdown')
    state.api = this
    if (!this.scroller) return
    this.el = document.createElement('div')
    this.el.className = 'glean-line-gutter'
    this.scroller.appendChild(this.el)
    this.observer = new ResizeObserver(() => this.schedule())
    this.observer.observe(view.dom)
    this.onScroll = () => { this.el.style.left = `${this.scroller.scrollLeft}px` }
    this.scroller.addEventListener('scroll', this.onScroll)
    // web fonts change wrapping after first paint
    document.fonts.ready.then(() => this.schedule())
    this.schedule()
  }

  update() { this.schedule() }

  destroy() {
    cancelAnimationFrame(this.pending)
    this.observer?.disconnect()
    this.scroller?.removeEventListener('scroll', this.onScroll)
    this.el?.remove()
  }

  refresh() { this.schedule() }

  schedule() {
    if (this.pending) return
    this.pending = requestAnimationFrame(() => {
      this.pending = 0
      this.measure()
    })
  }

  measure() {
    if (!this.el) return
    const { enabled, wrap } = this.state
    this.el.style.display = enabled ? 'block' : 'none'
    this.scroller.classList.toggle('glean-has-gutter', enabled)
    this.scroller.classList.toggle('glean-nowrap', !wrap)
    if (!enabled) return
    // the gutter is absolutely positioned inside the scroller so it already
    // follows vertical scroll; the left correction keeps numbers pinned
    // during horizontal scroll in no-wrap mode
    this.el.style.left = `${this.scroller.scrollLeft}px`
    this.el.style.height = `${this.scroller.scrollHeight}px`

    const scrollerTop = this.scroller.getBoundingClientRect().top
    const scrollTop = this.scroller.scrollTop
    const tops = []
    for (const block of this.view.dom.querySelectorAll(LEAF_BLOCK)) {
      if (block.querySelector(LEAF_BLOCK)) continue
      const range = document.createRange()
      range.selectNodeContents(block)
      const rects = [...range.getClientRects()].filter((r) => r.height > 1)
      if (rects.length === 0) {
        const box = block.getBoundingClientRect()
        if (box.height > 0) tops.push(box.top)
        continue
      }
      for (const r of rects) tops.push(r.top)
    }
    tops.sort((a, b) => a - b)
    const lines = []
    for (const top of tops) {
      if (lines.length > 0 && top - lines[lines.length - 1] < LINE_MERGE_PX) continue
      lines.push(top)
    }
    const frag = document.createDocumentFragment()
    lines.forEach((top, i) => {
      const span = document.createElement('span')
      span.textContent = String(i + 1)
      span.style.top = `${top - scrollerTop + scrollTop}px`
      frag.appendChild(span)
    })
    this.el.replaceChildren(frag)
  }
}

export function lineGutter({ state }) {
  return new Plugin({
    key: lineGutterKey,
    view: (view) => new GutterView(view, state),
  })
}
