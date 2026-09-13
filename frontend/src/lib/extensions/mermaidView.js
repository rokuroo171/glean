import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const mermaidKey = new PluginKey('glean-mermaid')

let initPromise = null
let renderCounter = 0
const svgCache = new Map()
const MAX_CACHE = 30

// Same theme variables as the read view's initMermaid so both modes match
async function ensureInit() {
  if (!initPromise) {
    initPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#5b9fd4',
          primaryTextColor: '#e8eaed',
          primaryBorderColor: 'rgba(180, 140, 80, 0.12)',
          lineColor: 'rgba(180, 140, 80, 0.25)',
          secondaryColor: '#121824',
          tertiaryColor: 'rgba(90, 106, 122, 0.1)',
          fontFamily: 'inherit',
        },
      })
    })
  }
  return initPromise
}

async function renderSvg(code) {
  if (svgCache.has(code)) return svgCache.get(code)
  await ensureInit()
  const mermaid = (await import('mermaid')).default
  const { svg } = await mermaid.render(`glean-mermaid-${++renderCounter}`, code)
  svgCache.set(code, svg)
  if (svgCache.size > MAX_CACHE) svgCache.delete(svgCache.keys().next().value)
  return svg
}

function diagramDom(code) {
  const box = document.createElement('div')
  box.className = 'glean-mermaid'
  const cached = svgCache.get(code)
  if (cached) {
    box.innerHTML = cached
    return box
  }
  box.textContent = 'Rendering diagram…'
  renderSvg(code)
    .then((svg) => {
      box.innerHTML = svg
    })
    .catch((e) => {
      box.textContent = `Diagram error: ${e.message || 'failed to render'}`
      box.classList.add('has-error')
    })
  return box
}

// Renders mermaid fences as diagrams below their editable source, like the
// read view. The code block itself stays untouched so saves remain byte-true
export const mermaidView = () => new Plugin({
  key: mermaidKey,
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
    if (node.type.name !== 'code_block' || node.attrs.language !== 'mermaid') return
    decos.push(Decoration.widget(pos + node.nodeSize, () => diagramDom(node.textContent), { side: 1 }))
  })
  return DecorationSet.create(doc, decos)
}
