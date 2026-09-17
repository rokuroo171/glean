import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const htmlPairsKey = new PluginKey('glean-html-pairs')

// Tags whose open/close pairs get their real element styling between the
// raw chips; mirrors RENDERED_TAGS in hardBrRescue.js
const PAIR_TAGS = new Set(['sub', 'sup', 'strong', 'em', 'kbd', 'ins', 'u', 'mark'])

function tagOf(node) {
  const m = /^<\/?([a-z]+)\s*\/?>$/i.exec((node.attrs.value || '').trim())
  return m ? m[1].toLowerCase() : null
}

// Html pair content between the raw chips gets its real element styling
// here, caret-independent, the way alerts tint their boxes. The chips stay
// raw and visible; only the content between an open and its matching close
// is decorated. A stack handles nesting (a sub inside a sup); an unpaired
// or stray chip decorates nothing
function buildDecos(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    if (node.type.spec.code) return false
    const stack = []
    let offset = 0
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child.type.name === 'html') {
        const tag = tagOf(child)
        if (tag && PAIR_TAGS.has(tag)) {
          const at = pos + 1 + offset
          if (!child.attrs.value.trim().startsWith('</')) {
            stack.push({ tag, at })
          } else {
            const idx = stack.map((s) => s.tag).lastIndexOf(tag)
            if (idx !== -1) {
              const open = stack[idx]
              stack.length = idx
              decos.push(Decoration.inline(open.at + 1, at, { class: `glean-html-${tag}` }))
            }
          }
        }
      }
      offset += child.nodeSize
    }
    return false
  })
  if (decos.length === 0) return DecorationSet.empty
  return DecorationSet.create(doc, decos)
}

export const htmlPairs = () => new Plugin({
  key: htmlPairsKey,
  state: {
    init(_, state) { return buildDecos(state.doc) },
    apply(tr, old) {
      if (!tr.docChanged) return old
      return buildDecos(tr.doc)
    },
  },
  props: {
    decorations(state) { return this.getState(state) },
  },
})
