import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { colors } from '../theme'

// Image rendering over the raw buffer. The ![alt](src) token is real text;
// away from the caret it collapses to an image widget (replace decoration,
// registered atomic), the caret or a selection overlapping the token
// reveals the raw syntax. Scan-based like math: lezer delivers images only
// inside paragraphs and the token text is what must stay byte-true.
// Law 2 does not restrict the widget (it replaces the whole token, no
// inline glyph geometry shifts). Law 3: recomputed whole from (doc,
// selection)

const REVEALED_CLASS = 'glean-syntax-revealed'
const IMAGE = /!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g

class ImageWidget extends WidgetType {
  constructor(src, alt) {
    super()
    this.src = src
    this.alt = alt
  }
  eq(other) { return other.src === this.src && other.alt === this.alt }
  toDOM() {
    if (!this.src) {
      const wrap = document.createElement('span')
      wrap.className = 'glean-image-missing'
      wrap.textContent = this.alt || 'image'
      return wrap
    }
    const wrap = document.createElement('span')
    wrap.className = 'glean-image-wrap'
    const img = document.createElement('img')
    img.className = 'glean-image'
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    wrap.appendChild(img)
    return wrap
  }
  ignoreEvent() { return false }
}

function build(state) {
  const sel = state.selection.main
  const decos = []
  const atomic = []
  const doc = state.doc

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (!line.text.includes('![')) continue
    let m
    IMAGE.lastIndex = 0
    while ((m = IMAGE.exec(line.text))) {
      const from = line.from + m.index
      const to = from + m[0].length
      const near = (sel.head >= from && sel.head <= to) || (sel.from < to && sel.to > from)
      if (near) {
        decos.push({ from, to, deco: Decoration.mark({ class: REVEALED_CLASS }) })
      } else {
        decos.push({ from, to, deco: Decoration.replace({ widget: new ImageWidget(m[2], m[1]) }) })
        atomic.push({ from, to })
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

export const images = ViewPlugin.fromClass(
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

export const imagesTheme = EditorView.theme({
  '.glean-image-wrap': { display: 'inline-block', maxWidth: '100%' },
  '.glean-image': { maxWidth: '100%', maxHeight: '320px', borderRadius: '6px', display: 'block' },
  '.glean-image-missing': {
    color: colors.textMuted,
    fontStyle: 'italic',
    background: 'rgba(106, 122, 138, 0.14)',
    borderRadius: '4px',
    padding: '1px 6px',
  },
})
