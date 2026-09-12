import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const taskCheckboxKey = new PluginKey('glean-task-checkbox')

// This prosemirror-view version only accepts a function or WidgetType
// instance for Decoration.widget, so build the checkbox in a closure
function checkboxDom(checked, pos) {
  return (view) => {
    const wrap = document.createElement('span')
    wrap.className = 'glean-taskbox'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = checked
    box.setAttribute('aria-label', 'toggle task')
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const node = view.state.doc.nodeAt(pos)
      if (!node) return
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        checked: !node.attrs.checked
      }))
    })
    wrap.appendChild(box)
    return wrap
  }
}

// Milkdown's gfm task items carry a checked attr but render no checkbox,
// so this draws one before the item text and wires the click through
export const taskCheckbox = () => new Plugin({
  key: taskCheckboxKey,
  state: {
    init(_, state) {
      return buildDecos(state.doc)
    },
    apply(tr, old) {
      if (!tr.docChanged && !tr.selectionSet) return old
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
    if (node.type.name === 'list_item' && node.attrs.checked != null) {
      // Widget goes at the paragraph content start so it renders inline with
      // the text line; at the li start it becomes a block sibling and the
      // paragraph overlaps it
      const p = node.maybeChild(0)
      const inner = p && p.isTextblock && p.type.name === 'paragraph' ? pos + 1 + 1 : pos + 1
      decos.push(Decoration.widget(inner, checkboxDom(node.attrs.checked, pos), { side: -1, ignoreEvent: () => true }))
    }
  })
  return DecorationSet.create(doc, decos)
}
