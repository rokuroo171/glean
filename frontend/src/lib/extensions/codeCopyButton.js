import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const codeCopyKey = new PluginKey('glean-code-copy')

// A pre can hold multiple paragraphs (blank lines split fenced content), so
// the copy reads from the pre element rather than one text node
function copyButtonDom() {
  return () => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'glean-code-copy'
    btn.setAttribute('aria-label', 'copy code')
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
    btn.addEventListener('mousedown', (e) => {
      // keep editor focus and selection untouched while copying
      e.preventDefault()
      e.stopPropagation()
      const pre = btn.closest('pre')
      const clone = pre?.cloneNode(true)
      clone?.querySelectorAll('.glean-code-copy').forEach((b) => b.remove())
      const text = clone?.textContent.replace(/\n$/, '') ?? ''
      navigator.clipboard?.writeText(text)
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      setTimeout(() => {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
      }, 1200)
    })
    return btn
  }
}

// Hover copy button on fenced code blocks
export const codeCopyButton = () => new Plugin({
  key: codeCopyKey,
  state: {
    init(_, state) {
      return buildDecos(state.doc)
    },
    apply(tr, old) {
      if (!tr.docChanged) return old
      return buildDecos(tr.doc)
    }
  },
  props: {
    decorations(state) {
      return this.getState(state)
    }
  }
})

function buildDecos(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'code_block') {
      decos.push(Decoration.widget(pos + 1, copyButtonDom(), { side: 1, ignoreEvent: () => true }))
    }
  })
  return DecorationSet.create(doc, decos)
}
