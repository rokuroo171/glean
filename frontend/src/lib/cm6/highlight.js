import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { colors } from '../theme'

// ==highlight== rendering over the raw buffer. lezer-markdown has no
// highlight node, so like the math layer this is scan-based: per line,
// == runs pair up into spans that split into two delimiter ranges and
// their content. The caret contract follows the inline reveal units in
// reveal.js: the span itself is the reveal scope, so the caret entering
// it turns the raw == pairs into dimmed real characters and leaving
// collapses them (Decoration.replace, registered atomic) while the
// content carries the mark class. Law 2: the mark is tint only, no
// padding on inline spans. Law 3: the set is recomputed whole from
// (doc, selection)

const HL = 'glean-hl'
const REVEALED_CLASS = 'glean-syntax-revealed'
const PAIR = /==/g

function build(state) {
  const head = state.selection.main.head
  const decos = []
  const atomic = []
  const doc = state.doc

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (!line.text.includes('==')) continue
    const runs = []
    let m
    PAIR.lastIndex = 0
    while ((m = PAIR.exec(line.text))) runs.push(line.from + m.index)
    for (let i = 0; i + 1 < runs.length; i += 2) {
      const start = runs[i]
      const end = runs[i + 1] + 2
      const revealed = head >= start && head <= end
      for (const at of [start, runs[i + 1]]) {
        if (revealed) {
          decos.push({ from: at, to: at + 2, deco: Decoration.mark({ class: REVEALED_CLASS }) })
        } else {
          decos.push({ from: at, to: at + 2, deco: Decoration.replace({}) })
          atomic.push({ from: at, to: at + 2 })
        }
      }
      const content = start + 2
      if (content < runs[i + 1] && !revealed) {
        decos.push({ from: content, to: runs[i + 1], deco: Decoration.mark({ class: HL }) })
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const d of decos) builder.add(d.from, d.to, d.deco)

  atomic.sort((a, b) => a.from - b.from || a.to - b.to)
  const atomicBuilder = new RangeSetBuilder()
  for (const r of atomic) atomicBuilder.add(r.from, r.to, Decoration.replace({}))

  return { decorations: builder.finish(), atomic: atomicBuilder.finish() }
}

export const highlight = ViewPlugin.fromClass(
  class {
    constructor(view) {
      const b = build(view.state)
      this.decorations = b.decorations
      this.atomic = b.atomic
    }
    update(update) {
      if (update.docChanged || update.selectionSet) {
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

export const highlightTheme = EditorView.theme({
  [`.${HL}`]: { background: `${colors.accentWarm}47`, borderRadius: '3px' },
})
