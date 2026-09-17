import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const linkTipsKey = new PluginKey('glean-link-tips')

// Hover tooltips for hyperlinks and linked images, fed to the app-wide
// tooltip layer via its data-tip attribute. Editor links are click-inert,
// so the tip carries the Ctrl+Click hint; a linked image carries the link
// mark on the image node itself
function aTip(href) {
  return `${href}\nCtrl+Click to open in browser`
}

export const linkTips = () => new Plugin({
  key: linkTipsKey,
  state: {
    init(_, state) { return build(state.doc) },
    apply(tr, old) {
      if (!tr.docChanged) return old
      return build(tr.doc)
    },
  },
  props: {
    decorations(state) { return this.getState(state) },
  },
})

function build(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    const link = node.marks.find((m) => m.type.name === 'link')
    if (!link) return
    const attrs = { 'data-tip': aTip(link.attrs.href ?? '') }
    // node decorations land attrs on the element itself; inline decorations
    // wrap the text in a span the tooltip layer reaches via closest()
    if (node.isInline && !node.isText) {
      decos.push(Decoration.node(pos, pos + node.nodeSize, attrs))
    } else {
      decos.push(Decoration.inline(pos, pos + node.nodeSize, attrs))
    }
  })
  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty
}
