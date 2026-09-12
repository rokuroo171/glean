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
    btn.textContent = 'Copy'
    btn.setAttribute('aria-label', 'copy code')
    btn.addEventListener('mousedown', (e) => {
      // keep editor focus and selection untouched while copying
      e.preventDefault()
      e.stopPropagation()
      const pre = btn.closest('pre')
      const clone = pre?.cloneNode(true)
      clone?.querySelectorAll('.glean-code-copy').forEach((b) => b.remove())
      const text = clone?.textContent.replace(/\n$/, '') ?? ''
      navigator.clipboard?.writeText(text)
      btn.textContent = 'Copied'
      setTimeout(() => { btn.textContent = 'Copy' }, 1200)
    })
    return btn
  }
}

// Obsidian-style hover copy button on fenced code blocks
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
