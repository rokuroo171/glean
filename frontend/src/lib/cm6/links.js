import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { colors } from '../theme'

// Links stay click-inert so a plain click can never navigate the app window;
// ctrl/cmd+click opens http and mailto hrefs in the system browser, matching
// the read view. Hover tooltips ride the app-wide data-tip layer with the
// Ctrl+Click hint, since the URL text itself is not the link label

function openExternal(href) {
  if (window.runtime?.BrowserOpenURL) window.runtime.BrowserOpenURL(href)
  else window.open(href, '_blank')
}

export function linkClick(view, event) {
  const a = event.target?.closest?.('a')
  if (!a || !view.dom.contains(a)) return false
  event.preventDefault()
  if (!(event.ctrlKey || event.metaKey)) return true
  const href = a.getAttribute('href') || ''
  if (!/^(https?:|mailto:)/.test(href)) return true
  openExternal(href)
  return true
}

function urlRanges(view) {
  const out = []
  const doc = view.state.doc
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'URL') return
      const href = doc.sliceString(node.from, node.to)
      if (!href) return
      // the visible link styling covers the whole token: the enclosing
      // Link/Autolink when the tree gives one, the bare url otherwise
      const p = node.node.parent
      const span = p && (p.name === 'Link' || p.name === 'Autolink') ? p : node.node
      if (out.some((r) => r.from <= span.from && r.to >= span.to)) return
      out.push({ from: span.from, to: span.to, href })
    },
  })
  return out
}

function decorationsFor(view) {
  const builder = new RangeSetBuilder()
  for (const r of urlRanges(view).sort((a, b) => a.from - b.from)) {
    builder.add(r.from, r.to, Decoration.mark({
      class: 'glean-link',
      attributes: { 'data-tip': `${r.href}\nCtrl+Click to open in browser` },
    }))
  }
  return builder.finish()
}

export const linkTips = ViewPlugin.fromClass(
  class {
    constructor(view) { this.decos = decorationsFor(view) }
    update(update) {
      if (update.docChanged || update.viewportChanged) this.decos = decorationsFor(update.view)
    }
  },
  { decorations: (v) => v.decos },
)

// CM6 renders no anchor elements, so the click is resolved from the
// buffer: the position under the mouse is lifted to its Link or Autolink
// node and the destination read from there, so a click anywhere on the
// link opens it. Without this no link in the editor opens at all
function linkAtPos(state, pos) {
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (node.name === 'Autolink') {
      const inner = node.node.getChild('URL')
      return state.sliceDoc(inner ? inner.from : node.from + 1, inner ? inner.to : node.to - 1)
    }
    if (node.name === 'Link') {
      const url = node.node.getChild('URL')
      if (url) return state.sliceDoc(url.from, url.to)
    }
    node = node.parent
  }
  return null
}

export const linksTheme = EditorView.theme({
  '.glean-link': {
    color: colors.accent,
    textDecoration: 'underline',
    textDecorationColor: `${colors.accent}55`,
    cursor: 'pointer',
  },
})

export const linkHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (linkClick(view, event)) return true
    const a = event.target?.closest?.('a')
    if (a || !(event.ctrlKey || event.metaKey)) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const href = linkAtPos(view.state, pos)
    if (!href || !/^(https?:|mailto:)/.test(href)) return false
    event.preventDefault()
    openExternal(href)
    return true
  },
})
