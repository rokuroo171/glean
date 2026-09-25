import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

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
      out.push({ from: node.from, to: node.to, href })
    },
  })
  return out
}

function decorationsFor(view) {
  const builder = new RangeSetBuilder()
  for (const r of urlRanges(view).sort((a, b) => a.from - b.from)) {
    builder.add(r.from, r.to, Decoration.mark({
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

export const linkHandlers = EditorView.domEventHandlers({
  mousedown(event, view) { return linkClick(view, event) },
})
