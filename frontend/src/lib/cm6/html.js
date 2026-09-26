import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { colors } from '../theme'

// HTML pair styling over the raw buffer, ported from the PM htmlPairs.
// The <tag> chips stay raw and visible; only the content between an open
// tag and its matching close gets the element's styling, caret
// independent the way alerts tint their boxes. A stack per tag handles
// nesting (a sub inside a sup); an unpaired or stray chip decorates
// nothing. The PM Backspace-dissolve has no port: the chips were
// already literal text here, so dissolution is the native buffer behavior.
// Law 2: sub and sup lose the PM font-size and baseline shift, a tint
// carries the distinction instead. Law 3: recomputed whole on doc change

const PAIR_TAGS = ['sub', 'sup', 'strong', 'em', 'kbd', 'ins', 'u', 'mark']
const VOID_TAGS = ['br', 'hr', 'img', 'input']
// every raw html tag token in the buffer, paired or not, attributes
// included: the chip treatment applies to all of them alike
const TAG_RE = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*)?)>/g

function inCodeAt(state, pos) {
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'CodeText') return true
    node = node.parent
  }
  return false
}

function build(state) {
  const decos = []
  const doc = state.doc
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (!line.text.includes('<')) continue
    if (inCodeAt(state, line.from + Math.max(0, line.to - line.from - 1))) continue
    const stack = []
    let m
    TAG_RE.lastIndex = 0
    while ((m = TAG_RE.exec(line.text))) {
      const tag = m[2].toLowerCase()
      const at = line.from + m.index
      // every tag token stays raw but reads as chrome: dimmed mono chip
      decos.push({ from: at, to: at + m[0].length, cls: 'glean-html-chip' })
      if (m[1]) {
        const idx = stack.map((s) => s.tag).lastIndexOf(tag)
        if (idx !== -1) {
          const open = stack[idx]
          stack.length = idx
          if (open.contentFrom < at) {
            decos.push({ from: open.contentFrom, to: at, cls: `glean-html-${tag}` })
          }
        }
      } else if (PAIR_TAGS.includes(tag) && !m[0].endsWith('/>') && !VOID_TAGS.includes(tag)) {
        stack.push({ tag, contentFrom: at + m[0].length })
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const d of decos) builder.add(d.from, d.to, Decoration.mark({ class: d.cls }))
  return builder.finish()
}

export const htmlPairs = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view.state)
    }
    update(update) {
      if (update.docChanged) this.decorations = build(update.state)
    }
  },
  { decorations: (v) => v.decorations },
)

export const htmlPairsTheme = EditorView.theme({
  '.glean-html-chip': {
    fontFamily: "'Fira Code', ui-monospace, monospace",
    color: colors.textMuted,
    opacity: 0.8,
  },
  '.glean-html-strong': { fontWeight: 700 },
  '.glean-html-em': { fontStyle: 'italic' },
  '.glean-html-u, .glean-html-ins': { textDecoration: 'underline' },
  '.glean-html-mark': { background: `${colors.accentWarm}47`, borderRadius: '3px' },
  '.glean-html-kbd': {
    fontFamily: "'Fira Code', ui-monospace, monospace",
    background: 'rgba(106, 122, 138, 0.18)',
    borderRadius: '4px',
  },
  '.glean-html-sub': { color: colors.textMuted, fontStyle: 'italic' },
  '.glean-html-sup': { color: colors.textMuted, fontStyle: 'italic' },
})
