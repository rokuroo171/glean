import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { colors } from '../theme'

export const taskCheckboxKey = new PluginKey('glean-task-checkbox')

// This prosemirror-view version only accepts a function or WidgetType
// instance for Decoration.widget, so build the checkbox in a closure
function squircleSvg(checked) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '18')
  svg.setAttribute('height', '18')
  svg.setAttribute('viewBox', '0 0 18 18')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.display = 'block'
  const rect = document.createElementNS(ns, 'rect')
  rect.setAttribute('x', '1.5')
  rect.setAttribute('y', '1.5')
  rect.setAttribute('width', '15')
  rect.setAttribute('height', '15')
  rect.setAttribute('rx', '5')
  rect.setAttribute('stroke-width', '1.75')
  if (checked) {
    rect.setAttribute('fill', colors.accent)
    rect.setAttribute('stroke', colors.accent)
  } else {
    rect.setAttribute('fill', 'none')
    rect.setAttribute('stroke', colors.borderStrong)
  }
  svg.appendChild(rect)
  if (checked) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M5.5 9.2l2.4 2.4 4.6-5.4')
    path.setAttribute('stroke', colors.bg)
    path.setAttribute('stroke-width', '1.75')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('fill', 'none')
    svg.appendChild(path)
  }
  return svg
}

function checkboxDom(checked, pos) {
  return (view) => {
    const wrap = document.createElement('span')
    wrap.className = 'glean-taskbox'
    const box = document.createElement('span')
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(checked))
    box.setAttribute('aria-label', 'toggle task')
    box.tabIndex = 0
    box.appendChild(squircleSvg(checked))
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
