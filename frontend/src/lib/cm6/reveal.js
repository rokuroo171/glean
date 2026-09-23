import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// The caret-gated reveal state, the heart of the live preview contract.
// Inline syntax (emphasis, strike, code marks) and block prefixes (heading
// hashes, quote marks, list marks, task markers) collapse to zero width
// when the caret is away from their block unit and return as dimmed real
// characters when the caret is inside it. Hiding is Decoration.replace
// registered in atomicRanges: CM6 caret motion is buffer-position based, so
// replace is the honest hide (RIGOR family 3) and atomicRanges keeps arrows
// from parking inside collapsed syntax. The PM-era opacity trick does not
// carry over: it existed to preserve browser caret traversal through spans,
// which CM6 never relies on, and it leaves phantom layout width behind.
// Law 2: revealed styling is color and opacity only. Law 3: the set is
// recomputed whole from (doc, selection) on every relevant transaction

const REVEALED_CLASS = 'glean-syntax-revealed'

const INLINE_PAIRS = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark', 'HighlightMark'])

// TaskMarker is absent: widgets.js replaces [x] markers with the checkbox
// itself, so there is no raw state to reveal and both layers replacing the
// same range would conflict
const BLOCK_PREFIXES = new Set(['HeaderMark', 'QuoteMark', 'ListMark'])

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
  const decos = []
  const atomic = []
  const tree = syntaxTree(state)
  const doc = state.doc

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
      if (near) {
        decos.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: REVEALED_CLASS }) })
        return
      }
      // collapse the marker plus one trailing separator so the line starts
      // at the text the way the rendered look expects; the buffer keeps
      // both characters and entering the block reveals them together
      let to = node.to
      if (BLOCK_PREFIXES.has(name) && doc.sliceString(to, to + 1) === ' ') to += 1
      decos.push({ from: node.from, to, deco: Decoration.replace({}) })
      atomic.push({ from: node.from, to })
    },
  })

  decos.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const d of decos) builder.add(d.from, d.to, d.deco)

  atomic.sort((a, b) => a.from - b.from || a.to - b.to)
  const atomicBuilder = new RangeSetBuilder()
  for (const r of atomic) atomicBuilder.add(r.from, r.to, Decoration.replace({}))

  return { decorations: builder.finish(), atomic: atomicBuilder.finish() }
}

export const reveal = ViewPlugin.fromClass(
  class {
    constructor(view) {
      const b = build(view.state)
      this.decorations = b.decorations
      this.atomic = b.atomic
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        const b = build(update.state)
        this.decorations = b.decorations
        this.atomic = b.atomic
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => {
      const inst = view.plugin(plugin)
      return inst ? inst.atomic : Decoration.none
    }),
  },
)

export const revealTheme = EditorView.theme({
  [`.${REVEALED_CLASS}`]: { opacity: 0.45 },
})
