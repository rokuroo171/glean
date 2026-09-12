import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const alertsKey = new PluginKey('glean-alerts')

// Palette mirrors the read view's ALERT_KINDS so both modes tint alike
const KINDS = {
  note: { label: 'Note', color: '#5b9fd4', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5v.01M12 11v6' },
  tip: { label: 'Tip', color: '#56b87a', icon: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5' },
  important: { label: 'Important', color: '#8b7cf6', icon: 'M7.9 20A9 9 0 1 0 4 16.1L2 22ZM12 8v4M12 16v.01' },
  warning: { label: 'Warning', color: '#d99a3d', icon: 'm21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17v.01' },
  caution: { label: 'Caution', color: '#db4c40', icon: 'M21.73 18l-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17v.01' }
}

const ALERT_TEXT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

// The svg path set per kind, stroked like lucide renders them
function iconSvg(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', KINDS[kind].icon)
  svg.appendChild(path)
  return svg
}

function headerDom(kind) {
  const wrap = document.createElement('span')
  wrap.className = 'glean-alert-head'
  const inner = document.createElement('span')
  inner.style.color = KINDS[kind].color
  inner.appendChild(iconSvg(kind))
  const label = document.createElement('span')
  label.textContent = KINDS[kind].label
  inner.appendChild(label)
  wrap.appendChild(inner)
  return wrap
}

// Finds the doc range of the marker text at the start of a blockquote's
// first paragraph, walking inline children since marks split text nodes
function markerRange(bqNode, bqPos) {
  const first = bqNode.maybeChild(0)
  if (!first || !first.isTextblock) return null
  const text = first.textContent
  const m = text.match(ALERT_TEXT_RE)
  if (!m) return null
  const markerLen = m[0].length
  let consumed = 0
  let end = null
  for (let i = 0; i < first.childCount; i++) {
    const child = first.child(i)
    consumed += child.text ? child.text.length : 0
    if (consumed >= markerLen) {
      // child start in doc + offset into this child where the marker ends
      const childStart = bqPos + 1 + 1 + (first.child(i).text ? consumed - child.text.length : consumed)
      end = childStart + (child.text ? child.text.length - (consumed - markerLen) : 0)
      break
    }
  }
  return end == null ? null : { from: bqPos + 1 + 1, to: end, kind: m[1].toLowerCase() }
}

// Renders > [!NOTE] as a tinted callout with a lucide icon and category
// label, like the read view and the reference renderers. The marker text
// stays in the document so saves remain byte-true; it is only hidden
export const alerts = () => new Plugin({
  key: alertsKey,
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
    if (node.type.name !== 'blockquote') return
    const range = markerRange(node, pos)
    if (!range) return
    decos.push(Decoration.node(pos, pos + node.nodeSize, {
      class: 'glean-alert',
      'data-kind': range.kind
    }))
    decos.push(Decoration.inline(range.from, range.to, { class: 'glean-alert-marker' }))
    decos.push(Decoration.widget(range.to, () => headerDom(range.kind), { side: 1, ignoreEvent: () => false }))
  })
  return DecorationSet.create(doc, decos)
}
