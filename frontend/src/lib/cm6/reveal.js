import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// The caret-gated reveal state, the heart of the live preview contract.
// Inline syntax (emphasis, strike, code, highlight marks) hides when the
// caret is away from the range and returns as dimmed real characters when
// the caret is inside or on either edge. Law 2: hiding is opacity and color
// only, never geometry. Law 3: this set is recomputed whole from (doc,
// selection) on every relevant transaction; it is never patched

// hiding rides in attributes.style; Decoration.mark has no top-level style
// field, so a bare { style } spec would be silently ignored
const HIDDEN = { attributes: { style: 'opacity:0' } }
const REVEALED_CLASS = 'glean-syntax-revealed'

const PAIRS = new Set([
  'EmphasisMark', 'StrikethroughMark', 'CodeMark', 'HighlightMark',
])

const HEADS = new Set(['HeaderMark'])

function build(state) {
  const head = state.selection.main.head
  const marks = []
  const tree = syntaxTree(state)

  tree.iterate({
    enter: (node) => {
      const name = node.name
      const isPair = PAIRS.has(name)
      const isHead = HEADS.has(name)
      if (!isPair && !isHead) return

      // reveal window: the caret sits anywhere in [from, to] of the parent
      // construct, so walking into a pair shows both halves plus the text
      const parent = node.node.parent
      const span = parent && parent.from < parent.to ? parent : node.node
      const near = head >= span.from && head <= span.to

      if (isHead) {
        // heading marks: hide when the caret is elsewhere on the line's
        // construct, reveal dim when the caret is on the heading at all
        if (near) {
          marks.push({ from: node.from, to: node.to, spec: { class: REVEALED_CLASS } })
        } else {
          marks.push({ from: node.from, to: node.to, spec: HIDDEN })
        }
        return
      }

      if (near) {
        marks.push({ from: node.from, to: node.to, spec: { class: REVEALED_CLASS } })
      } else {
        marks.push({ from: node.from, to: node.to, spec: HIDDEN })
      }
    },
  })

  marks.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const m of marks) builder.add(m.from, m.to, Decoration.mark(m.spec))
  return builder.finish()
}

export const reveal = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view.state)
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = build(update.state)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export const revealTheme = EditorView.theme({
  [`.${REVEALED_CLASS}`]: { opacity: 0.45 },
})
