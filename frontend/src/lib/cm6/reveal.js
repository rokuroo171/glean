import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// The caret-gated reveal state, the heart of the live preview contract.
// Inline syntax (emphasis, strike, code marks) and block prefixes (heading
// hashes, quote marks, list marks, task markers) hide when the caret is
// away from their block unit and return as dimmed real characters when the
// caret is inside it. Law 2: hiding is opacity and color only, never
// geometry. Law 3: this set is recomputed whole from (doc, selection) on
// every relevant transaction; it is never patched

// hiding rides in attributes.style; Decoration.mark has no top-level style
// field, so a bare { style } spec would be silently ignored
const HIDDEN = { attributes: { style: 'opacity:0' } }
const REVEALED_CLASS = 'glean-syntax-revealed'

const INLINE_PAIRS = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark', 'HighlightMark'])

const BLOCK_PREFIXES = new Set(['HeaderMark', 'QuoteMark', 'ListMark', 'TaskMarker'])

// the block a prefix belongs to: the caret editing anywhere inside this
// node sees that prefix raw. List and task marks answer to their item,
// quote marks to their quote (nested quotes are their own unit), heading
// hashes to the heading
const BLOCK_UNITS = new Set([
  'ListItem', 'Blockquote',
  'ATXHeading1', 'ATXHeading2', 'ATXHeading3', 'ATXHeading4', 'ATXHeading5', 'ATXHeading6',
  'SetextHeading1', 'SetextHeading2',
])

function revealSpan(node) {
  let cur = node.parent
  while (cur) {
    if (BLOCK_UNITS.has(cur.name)) return cur
    cur = cur.parent
  }
  return node
}

function build(state) {
  const head = state.selection.main.head
  const marks = []
  const tree = syntaxTree(state)

  tree.iterate({
    enter: (node) => {
      const name = node.name
      let span
      if (INLINE_PAIRS.has(name)) {
        const parent = node.node.parent
        // fence marks keep their raw ``` until phase 4 replaces them with
        // the language chip treatment
        if (name === 'CodeMark' && parent && (parent.name === 'FencedCode' || parent.name === 'CodeBlock')) return
        span = parent && parent.from < parent.to ? parent : node.node
      } else if (BLOCK_PREFIXES.has(name)) {
        span = revealSpan(node.node)
      } else {
        return
      }
      const near = head >= span.from && head <= span.to
      marks.push(near
        ? { from: node.from, to: node.to, spec: { class: REVEALED_CLASS } }
        : { from: node.from, to: node.to, spec: HIDDEN })
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
