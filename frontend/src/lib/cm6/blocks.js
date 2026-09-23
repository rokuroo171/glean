import { ViewPlugin, Decoration } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { colors } from '../theme'

// Block rendering pass. Everything here is static styling driven by the
// syntax tree: what a heading, quote, fence, or table looks like no matter
// where the caret sits. Caret-gated hiding lives in reveal.js. Line classes
// may size blocks (law 2 forbids geometry changes only on inline spans, the
// per-line classes are how heading scale is safe)

const HEADING_CLASS = {
  ATXHeading1: 'glean-h1',
  ATXHeading2: 'glean-h2',
  ATXHeading3: 'glean-h3',
  ATXHeading4: 'glean-h4',
  ATXHeading5: 'glean-h5',
  ATXHeading6: 'glean-h6',
  SetextHeading1: 'glean-h1',
  SetextHeading2: 'glean-h2',
}

const FENCE_CLASS = {
  FencedCode: 'glean-fence',
  CodeBlock: 'glean-fence',
}

function build(view) {
  const builder = new RangeSetBuilder()
  const lineDecos = []
  const markDecos = []

  syntaxTree(view.state).iterate({
    enter: (node) => {
      const name = node.name
      const heading = HEADING_CLASS[name]
      if (heading) {
        const line = view.state.doc.lineAt(node.from)
        lineDecos.push({ from: line.from, to: line.from, spec: { class: heading } })
        return
      }
      const fence = FENCE_CLASS[name]
      if (fence) {
        const first = view.state.doc.lineAt(node.from)
        const last = view.state.doc.lineAt(node.to)
        for (let l = first.number; l <= last.number; l++) {
          const line = view.state.doc.line(l)
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-fence-line' } })
        }
        if (node.node.firstChild && node.node.firstChild.name === 'CodeInfo' && node.node.firstChild.to > node.node.firstChild.from) {
          markDecos.push({
            from: node.node.firstChild.from,
            to: node.node.firstChild.to,
            spec: { class: 'glean-codeinfo' },
          })
        }
        return
      }
      if (name === 'Blockquote') {
        const first = view.state.doc.lineAt(node.from)
        const last = view.state.doc.lineAt(node.to)
        for (let l = first.number; l <= last.number; l++) {
          const line = view.state.doc.line(l)
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-quote-line' } })
        }
        return
      }
      if (name === 'ListMark') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-listmark' } })
        return
      }
      if (name === 'QuoteMark') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-quotemark' } })
        return
      }
      if (name === 'Table') {
        const first = view.state.doc.lineAt(node.from)
        const last = view.state.doc.lineAt(node.to)
        for (let l = first.number; l <= last.number; l++) {
          const line = view.state.doc.line(l)
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-table-line' } })
        }
        return
      }
      if (name === 'TableDelimiter') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-table-delim' } })
        return
      }
      if (name === 'HorizontalRule') {
        const line = view.state.doc.lineAt(node.from)
        lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-hr-line' } })
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-hr' } })
        return
      }
      if (name === 'TaskMarker') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-taskmarker' } })
        return
      }
    },
  })

  lineDecos.sort((a, b) => a.from - b.from)
  for (const d of lineDecos) builder.add(d.from, d.to, Decoration.line(d.spec))
  const markBuilder = new RangeSetBuilder()
  markDecos.sort((a, b) => a.from - b.from || a.to - b.to)
  for (const d of markDecos) {
    if (d.spec) markBuilder.add(d.from, d.to, Decoration.mark(d.spec))
  }
  return { lines: builder.finish(), marks: markBuilder.finish() }
}

export const blocks = ViewPlugin.fromClass(
  class {
    constructor(view) {
      const b = build(view)
      this.lines = b.lines
      this.marks = b.marks
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        const b = build(update.view)
        this.lines = b.lines
        this.marks = b.marks
      }
    }
  },
  {
    decorations: (v) => v.lines,
    // marks ride the same plugin through a second decoration source
    provide: (plugin) => EditorView.decorations.of((view) => {
      const inst = view.plugin(plugin)
      return inst ? inst.marks : Decoration.none
    }),
  },
)

export const blocksTheme = EditorView.theme({
  '&': { fontFamily: 'inherit' },
  '.glean-h1': { fontSize: '2em', fontWeight: 700, lineHeight: 1.3, color: colors.text },
  '.glean-h2': { fontSize: '1.6em', fontWeight: 700, lineHeight: 1.3, color: colors.text },
  '.glean-h3': { fontSize: '1.35em', fontWeight: 600, lineHeight: 1.3, color: colors.text },
  '.glean-h4': { fontSize: '1.15em', fontWeight: 600, lineHeight: 1.35, color: colors.text },
  '.glean-h5': { fontSize: '1em', fontWeight: 600, lineHeight: 1.4, color: colors.text },
  '.glean-h6': { fontSize: '0.9em', fontWeight: 600, lineHeight: 1.4, color: colors.textMuted },
  '.glean-quote-line': { color: colors.textMuted },
  '.glean-quote-line.cm-line': { boxShadow: `inset 3px 0 0 ${colors.border}` },
  '.glean-fence-line': {
    background: 'rgba(106, 170, 255, 0.06)',
    fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
  },
  '.glean-codeinfo': { color: colors.textMuted, fontStyle: 'italic' },
  '.glean-listmark': { color: colors.accent },
  '.glean-quotemark': { color: colors.accent, opacity: 0.6 },
  '.glean-taskmarker': { color: colors.accent },
  '.glean-table-line': { fontFamily: 'ui-monospace, monospace' },
  '.glean-table-delim': { color: colors.textDim, opacity: 0.7 },
  '.glean-hr-line': {},
  '.glean-hr': { color: colors.textDim, letterSpacing: '2px' },
})
