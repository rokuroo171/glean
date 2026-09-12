import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { highlightCode } from '../prism-setup'

export const codeHighlightKey = new PluginKey('glean-code-highlight')

function tokensToDecos(text, lang, from) {
  const html = highlightCode(text, lang)
  if (!html) return []
  const host = document.createElement('div')
  host.innerHTML = html
  const decos = []
  let offset = 0
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        offset += child.textContent.length
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const start = offset
        walk(child)
        decos.push(Decoration.inline(from + start, from + offset, {
          class: `token ${child.className}`
        }))
      }
    }
  }
  walk(host)
  return decos
}

function buildDecos(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return
    const lang = node.attrs.language
    if (!lang) return
    const text = node.textContent
    let lineStart = pos + 1
    for (const line of text.split('\n')) {
      if (line) decos.push(...tokensToDecos(line, lang, lineStart))
      lineStart += line.length + 1
    }
  })
  return DecorationSet.create(doc, decos)
}

// The read view highlights code via Prism but the editor schema renders plain
// text, so this overlays token spans per line without touching the document
export const codeHighlight = () => new Plugin({
  key: codeHighlightKey,
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
