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

// pipes inside a table are structural punctuation; in the delimiter row the
// dashes are too. Hyphens elsewhere are cell content and stay untouched.
// Marked so the theme can sink them toward the background while cell text
// stays bright
function addTablePunct(state, node, out, withHyphens) {
  const text = state.sliceDoc(node.from, node.to)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== '|' && !(ch === '-' && withHyphens)) continue
    // an escaped pipe is literal content in a cell, not a delimiter
    if (ch === '|' && i > 0 && text[i - 1] === '\\') continue
    const at = node.from + i
    out.push({ from: at, to: at + 1, spec: { class: ch === '|' ? 'glean-table-pipe' : 'glean-table-hyphen' } })
  }
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
          // first and last rows carry the panel cap classes so the theme
          // rounds only the block's corners and dims the boundary marks
          const cap = l === first.number ? ' glean-fence-open' : l === last.number ? ' glean-fence-close' : ''
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-fence-line' + cap } })
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
        // depth = how many ancestors of this node are Blockquotes too; each
        // level stacks one more bar and one more indent step the way
        // Obsidian's nested rails read
        let depth = 1
        for (let p = node.node.parent; p; p = p.parent) {
          if (p.name === 'Blockquote') depth++
        }
        for (let l = first.number; l <= last.number; l++) {
          const line = view.state.doc.line(l)
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-quote-line', attributes: { 'data-depth': String(depth) } } })
        }
        return
      }
      // list geometry: one line class per nesting depth with a hanging
      // indent (text starts after the marker, wrapped lines align under the
      // text, not under the marker) plus a faint guide rail per ancestor
      // level, the way Obsidian's list trees read
      if (name === 'ListItem') {
        let depth = 1
        for (let p = node.node.parent; p; p = p.parent) {
          if (p.name === 'ListItem') depth++
        }
        const line = view.state.doc.lineAt(node.from)
        lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-list-line', attributes: { 'data-depth': String(Math.min(depth, 5)) } } })
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
        addTablePunct(view.state, node, markDecos, false)
        const first = view.state.doc.lineAt(node.from)
        const last = view.state.doc.lineAt(node.to)
        for (let l = first.number; l <= last.number; l++) {
          const line = view.state.doc.line(l)
          // header and separator rows get the rail variant so the table
          // head reads as one bar across both rows
          const kind = l === first.number || l === first.number + 1 ? ' glean-table-head' : ''
          lineDecos.push({ from: line.from, to: line.from, spec: { class: 'glean-table-line' + kind } })
        }
        return
      }
      if (name === 'TableDelimiter') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-table-delim' } })
        addTablePunct(view.state, node, markDecos, true)
        return
      }
      // lezer gives a definition-list colon no node of its own: a paragraph
      // line starting with ': ' is its definition mark, dimmed so the term
      // and definition read as one entry. Colon lines are usually lazy
      // continuations inside the term's paragraph, so every line of the
      // paragraph is checked
      if (name === 'Paragraph') {
        const first = view.state.doc.lineAt(node.from).number
        const last = view.state.doc.lineAt(node.to).number
        for (let l = first; l <= last; l++) {
          const line = view.state.doc.line(l)
          if (/^:\s/.test(line.text)) {
            markDecos.push({ from: line.from, to: line.from + 1, spec: { class: 'glean-defcolon' } })
          }
        }
      }
      // reference link definitions read as metadata, not body prose
      if (name === 'LinkLabel') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-linklabel' } })
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
      if (name === 'InlineCode') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-inline-code' } })
        return
      }
      // the emphasis semantics themselves: the reveal layer only collapses
      // the markers, the content between them must carry the style or
      // **bold** renders as plain prose. Nodes cover marks plus content, so
      // hidden markers inside are unaffected and nesting (***bold italic***)
      // stacks through overlapping spans. Paint only — weight, slant, strike
      // — no geometry, per law 2
      if (name === 'Emphasis') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-em' } })
        return
      }
      if (name === 'StrongEmphasis') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-strong' } })
        return
      }
      if (name === 'Strikethrough') {
        markDecos.push({ from: node.from, to: node.to, spec: { class: 'glean-strike' } })
        return
      }
    },
  })

  lineDecos.sort((a, b) => a.from - b.from)
  for (const d of lineDecos) builder.add(d.from, d.to, Decoration.line(d.spec))
  const markBuilder = new RangeSetBuilder()
  // the whole-table pipe pass and the delimiter-row pass can hit the same
  // pipe: identical ranges would trip the builder, so collapse them
  markDecos.sort((a, b) => a.from - b.from || a.to - b.to || (a.spec.class < b.spec.class ? -1 : 1))
  let prev = null
  for (const d of markDecos) {
    if (!d.spec) continue
    if (prev && prev.from === d.from && prev.to === d.to && prev.spec.class === d.spec.class) continue
    prev = d
    markBuilder.add(d.from, d.to, Decoration.mark(d.spec))
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
  '.glean-h1': { fontSize: '2em', fontWeight: 700, lineHeight: 1.3, color: colors.text },
  '.glean-h2': { fontSize: '1.6em', fontWeight: 700, lineHeight: 1.3, color: colors.text },
  '.glean-h3': { fontSize: '1.35em', fontWeight: 600, lineHeight: 1.3, color: colors.text },
  '.glean-h4': { fontSize: '1.15em', fontWeight: 600, lineHeight: 1.35, color: colors.text },
  '.glean-h5': { fontSize: '1em', fontWeight: 600, lineHeight: 1.4, color: colors.text },
  '.glean-h6': { fontSize: '0.9em', fontWeight: 600, lineHeight: 1.4, color: colors.textMuted },
  // Obsidian-grade quote rails: full-brightness text and one accent bar per
  // nesting level, each a hard-stop background stripe at a full 16px step
  // (inset box-shadows cannot paint a mid-line strip: spread shrinks on all
  // four edges, which smeared a faint wash instead of drawing the nested
  // rails). Deeper levels keep stepping; 4+ share the deepest pattern
  '.glean-quote-line': { color: colors.text },
  '.glean-quote-line.cm-line': {
    backgroundImage: `linear-gradient(90deg, ${colors.accent} 0 3px, transparent 3px)`,
    paddingLeft: '12px',
  },
  '.glean-quote-line.cm-line[data-depth="2"]': {
    backgroundImage: `linear-gradient(90deg, ${colors.accent} 0 3px, transparent 3px 16px, ${colors.accent} 16px 19px, transparent 19px)`,
    paddingLeft: '28px',
  },
  '.glean-quote-line.cm-line[data-depth="3"]': {
    backgroundImage: `linear-gradient(90deg, ${colors.accent} 0 3px, transparent 3px 16px, ${colors.accent} 16px 19px, transparent 19px 32px, ${colors.accent} 32px 35px, transparent 35px)`,
    paddingLeft: '44px',
  },
  '.glean-quote-line.cm-line[data-depth="4"], .glean-quote-line.cm-line[data-depth="5"], .glean-quote-line.cm-line[data-depth="6"]': {
    backgroundImage: `linear-gradient(90deg, ${colors.accent} 0 3px, transparent 3px 16px, ${colors.accent} 16px 19px, transparent 19px 32px, ${colors.accent} 32px 35px, transparent 35px 48px, ${colors.accent} 48px 51px, transparent 51px)`,
    paddingLeft: '60px',
  },
  // the fence reads as one clean panel: quiet uniform background, rounded
  // corners on the caps, mono face for code rows. The mark row is dimmed so
  // the collapsed backticks do not fight the header
  '.glean-fence-line': {
    background: 'rgba(106, 122, 138, 0.07)',
    fontFamily: "'Fira Code', ui-monospace, monospace",
    fontVariantLigatures: 'none',
  },
  '.glean-fence-line.glean-fence-open': {
    borderRadius: '8px 8px 0 0',
  },
  '.glean-fence-line.glean-fence-close': {
    borderRadius: '0 0 8px 8px',
  },
  '.glean-fence-open .glean-fence-chip, .glean-fence-close .glean-hr': {
    opacity: 0.4,
  },
  '.glean-codeinfo': { color: colors.textMuted, fontStyle: 'italic' },
  // list markers stay visible always (reveal no longer collapses them):
  // structure like bullets and numbers must not vanish away from the caret.
  // Unordered markers are replaced with a real bullet glyph by widgets.js;
  // this face styles the ordered numbers that stay as text
  '.glean-listmark': { color: colors.accent, opacity: 0.85 },
  // hanging indent per depth: marker column at 4 + (depth-1)*22px, text
  // column 18px later, wrapped lines align under the text. Guide rails ride
  // as 1px stripes at each ancestor marker column
  '.glean-list-line.cm-line': {
    paddingLeft: '22px',
    textIndent: '-18px',
  },
  '.glean-list-line.cm-line[data-depth="2"]': {
    paddingLeft: '44px',
    backgroundImage: `linear-gradient(90deg, transparent 13px, ${colors.border} 13px 14px, transparent 14px)`,
  },
  '.glean-list-line.cm-line[data-depth="3"]': {
    paddingLeft: '66px',
    backgroundImage: `linear-gradient(90deg, transparent 13px, ${colors.border} 13px 14px, transparent 14px 35px, ${colors.border} 35px 36px, transparent 36px)`,
  },
  '.glean-list-line.cm-line[data-depth="4"]': {
    paddingLeft: '88px',
    backgroundImage: `linear-gradient(90deg, transparent 13px, ${colors.border} 13px 14px, transparent 14px 35px, ${colors.border} 35px 36px, transparent 36px 57px, ${colors.border} 57px 58px, transparent 58px)`,
  },
  '.glean-list-line.cm-line[data-depth="5"]': {
    paddingLeft: '110px',
    backgroundImage: `linear-gradient(90deg, transparent 13px, ${colors.border} 13px 14px, transparent 14px 35px, ${colors.border} 35px 36px, transparent 36px 57px, ${colors.border} 57px 58px, transparent 58px 79px, ${colors.border} 79px 80px, transparent 80px)`,
  },
  '.glean-quotemark': { color: colors.accent, opacity: 0.6 },
  '.glean-taskmarker': { color: colors.accent },
  // inline code keeps the mono face the PM editor gave `code`;
  // family and tint only, law 2 forbids the em size and padding here
  '.glean-inline-code': {
    fontFamily: "'Fira Code', ui-monospace, monospace",
    background: 'rgba(106, 122, 138, 0.18)',
    borderRadius: '4px',
  },
  // the table reads as a table through a mono face, a left rail that marks
  // the block, a dimmed header bar, and pipe glyphs sunk to background
  // punctuation: all line-scoped color/opacity per the stability laws
  '.glean-table-line': {
    fontFamily: 'ui-monospace, monospace',
    color: colors.textDim,
  },
  '.glean-table-line .glean-table-pipe': { opacity: 0.3 },
  '.glean-table-line .glean-table-hyphen': { opacity: 0.3 },
  '.glean-table-head': {
    background: 'rgba(106, 122, 138, 0.10)',
    color: colors.text,
  },
  '.glean-table-line.cm-line': {
    boxShadow: `inset 3px 0 0 ${colors.border}`,
  },
  '.glean-table-delim': { color: colors.textDim, opacity: 0.7 },
  '.glean-defcolon': { color: colors.accent, fontWeight: 700 },
  '.glean-linklabel': { color: colors.textMuted },
  '.glean-em': { fontStyle: 'italic' },
  '.glean-strong': { fontWeight: 700 },
  '.glean-strike': { textDecoration: 'line-through' },
  // the rule draws as the line's own centered background: the line box
  // stays alive so the line-number gutter keeps counting the row (a block
  // widget over the whole line made the gutter skip it and shifted every
  // number below). The raw --- / *** glyphs inside are sunk to transparent;
  // they hold the width and the caret access, the background paints the
  // line, caret on it shows the raw text dimmed
  '.glean-hr-line': {
    background: `linear-gradient(to bottom, transparent calc(50% - 0.5px), ${colors.borderStrong} calc(50% - 0.5px), ${colors.borderStrong} calc(50% + 0.5px), transparent calc(50% + 0.5px)) no-repeat center / 100% 1.5px`,
  },
  '.glean-hr-line .glean-hr': {
    color: 'transparent',
    letterSpacing: '2px',
  },
})
