import { Plugin, PluginKey } from 'prosemirror-state'

export const footnoteJumpKey = new PluginKey('glean-footnote-jump')

// Clicking a footnote reference scrolls its definition to the top of the
// view, matching the ref-to-def affordance Typora and Obsidian give readers.
// scrollIntoView walks the wrong offset chain inside Milkdown's nested
// scrollers and the embedded webview does not animate smooth scrolls, so the
// scroll targets offsetTop directly with instant behavior
export const footnoteJump = () => new Plugin({
  key: footnoteJumpKey,
  props: {
    handleDOMEvents: {
      click(view, event) {
        const sup = event.target && event.target.closest ? event.target.closest('sup[data-type="footnote_reference"]') : null
        if (!sup || !view.dom.contains(sup)) return false
        event.preventDefault()
        const label = sup.getAttribute('data-label')
        const def = view.dom.querySelector(`dl[data-type="footnote_definition"][data-label="${CSS.escape(label)}"]`)
        if (!def) return true
        let scroller = view.dom
        while (scroller && scroller !== document.body) {
          const cs = getComputedStyle(scroller)
          if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') break
          scroller = scroller.parentElement
        }
        if (scroller && scroller !== document.body) {
          let offset = 0
          let el = def
          while (el && el !== scroller) { offset += el.offsetTop; el = el.offsetParent }
          scroller.scrollTo({ top: Math.max(0, offset - 60), behavior: 'auto' })
        }
        return true
      }
    }
  }
})
