import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const footnoteRenameKey = new PluginKey('glean-footnote-rename')

// Footnote labels only change through attr updates: references are atom
// nodes and the GFM preset ships no input rules for them, so there is no
// caret path into a label. This plugin adds the missing affordance:
// double-click a [^ref] superscript or a definition's dt label to rename
// inline. Committing rewrites the label attr on every reference and
// definition sharing the old label, in one transaction, so the rename and
// the input closing are a single undo step

function findLabelWidget(view, label) {
  const wrap = document.createElement('span')
  wrap.className = 'glean-fn-rename'
  wrap.contentEditable = 'false'
  const input = document.createElement('input')
  input.value = label
  input.setAttribute('aria-label', 'Rename footnote label')
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    view.dispatch(view.state.tr.setMeta(footnoteRenameKey, null))
  }
  const commit = () => {
    if (closed) return
    const next = input.value.trim()
    if (!next || next === label) {
      close()
      return
    }
    const tr = view.state.tr
    view.state.doc.descendants((node, pos) => {
      if ((node.type.name === 'footnote_reference' || node.type.name === 'footnote_definition')
        && node.attrs.label === label) {
        tr.setNodeMarkup(pos, null, { ...node.attrs, label: next })
      }
    })
    tr.setMeta(footnoteRenameKey, null)
    view.dispatch(tr)
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') close()
    e.stopPropagation()
  })
  input.addEventListener('blur', commit)
  wrap.appendChild(input)
  requestAnimationFrame(() => { input.focus(); input.select() })
  return wrap
}

export const footnoteRename = () => new Plugin({
  key: footnoteRenameKey,
  state: {
    init: () => null,
    apply(tr, old) {
      if (tr.getMeta(footnoteRenameKey) !== undefined) return tr.getMeta(footnoteRenameKey)
      if (old && (tr.docChanged || tr.selectionSet)) return null
      return old
    },
  },
  props: {
    handleDoubleClickOn(view, pos, node) {
      if (node.type.name !== 'footnote_reference' && node.type.name !== 'footnote_definition') return false
      if (!node.attrs.label) return false
      view.dispatch(view.state.tr.setMeta(footnoteRenameKey, { pos, label: node.attrs.label }))
      return true
    },
    decorations(state) {
      const active = footnoteRenameKey.getState(state)
      if (!active) return DecorationSet.empty
      // The input renders inline at the node so it follows text flow and
      // scroll with no positioning code; stopEvent keeps PM's hands off
      return DecorationSet.create(state.doc, [
        Decoration.widget(active.pos, (view) => findLabelWidget(view, active.label), {
          side: 1,
          stopEvent: () => true,
          key: `fn-rename-${active.pos}-${active.label}`,
        }),
      ])
    },
  },
})
