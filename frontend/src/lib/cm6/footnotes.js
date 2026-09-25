import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { RangeSetBuilder, EditorSelection } from '@codemirror/state'
import { colors } from '../theme'

// Footnote affordances over the raw buffer. The [^label] tokens stay real
// text with no schema node, so this layer is scan-based: a plain click on
// a reference scrolls its definition into view, double-click opens a
// rename input whose commit rewrites every reference and definition
// sharing the label in one transaction, making the whole rename a single
// undo step. The input renders outside the buffer (a floating element
// positioned at the token) so the one-renderer law holds: nothing inside
// the CM content re-renders text. Law 3: recomputed whole from (doc,
// selection)

const REVEALED_CLASS = 'glean-syntax-revealed'
const FN_CLASS = 'glean-fn'
const FN = /\[\^([^\]\s]+)\]/g

class FootnoteMark extends WidgetType {
  constructor(label, at) {
    super()
    this.label = label
    this.at = at
  }
  eq(other) { return other.label === this.label && other.at === this.at }
  // a mark span, not a replace: the raw text stays in the flow underneath
  toDOM() {
    const span = document.createElement('span')
    span.className = FN_CLASS
    span.textContent = `[^${this.label}]`
    return span
  }
  ignoreEvent() { return true }
}

function build(state) {
  const sel = state.selection.main
  const decos = []
  const doc = state.doc

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (!line.text.includes('[^')) continue
    let m
    FN.lastIndex = 0
    while ((m = FN.exec(line.text))) {
      const from = line.from + m.index
      const to = from + m[0].length
      const near = (sel.head >= from && sel.head <= to) || (sel.from < to && sel.to > from)
      if (near) {
        decos.push({ from, to, deco: Decoration.mark({ class: REVEALED_CLASS }) })
      } else {
        decos.push({ from, to, deco: Decoration.mark({ class: FN_CLASS, attributes: { 'data-fn': m[1] } }) })
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const d of decos) builder.add(d.from, d.to, d.deco)
  return builder.finish()
}

function jumpToDefinition(view, label) {
  const { state } = view
  const doc = state.doc
  const defPattern = /^[ \t]*\[\^([^\]\s]+)\]:/
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const m = defPattern.exec(line.text)
    if (m && m[1] === label) {
      view.dispatch({ selection: EditorSelection.cursor(line.from), scrollIntoView: true })
      view.focus()
      return true
    }
  }
  return false
}

function collectRanges(state, label) {
  const ranges = []
  const doc = state.doc
  const refPattern = /\[\^([^\]\s]+)\]/g
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (!line.text.includes('[^')) continue
    let m
    refPattern.lastIndex = 0
    while ((m = refPattern.exec(line.text))) {
      if (m[1] === label) {
        ranges.push({ from: line.from + m.index, to: line.from + m.index + m[0].length, insert: `[^${label}]` })
      }
    }
  }
  return ranges
}

function openRename(view, label, at) {
  const input = document.createElement('input')
  input.className = 'glean-fn-rename'
  input.value = label
  input.setAttribute('aria-label', 'Rename footnote label')
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    input.remove()
    view.focus()
  }
  const commit = () => {
    if (closed) return
    const next = input.value.trim()
    if (!next || next === label) {
      close()
      return
    }
    // one transaction over every reference and definition with this label
    const ranges = collectRanges(view.state, label)
    if (ranges.length > 0) {
      view.dispatch({
        changes: ranges.map((r) => ({ from: r.from, to: r.to, insert: `[^${next}]` })),
        userEvent: 'input',
      })
    }
    close()
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') close()
    e.stopPropagation()
  })
  input.addEventListener('blur', commit)
  view.dom.appendChild(input)
  const coords = view.coordsAtPos(at)
  if (coords) {
    const rect = view.dom.getBoundingClientRect()
    input.style.left = `${coords.left - rect.left}px`
    input.style.top = `${coords.bottom - rect.top + 2}px`
  }
  requestAnimationFrame(() => { input.focus(); input.select() })
}

export const footnotes = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view.state)
    }
    update(update) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = build(update.state)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export const footnoteHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    const mark = event.target?.closest?.(`.${FN_CLASS}`)
    if (!mark || !view.dom.contains(mark)) return false
    // double-click is left to the browser so it still selects the word and
    // fires dblclick below
    if (event.detail >= 2) return false
    event.preventDefault()
    const label = mark.getAttribute('data-fn')
    jumpToDefinition(view, label)
    return true
  },
  dblclick(event, view) {
    const mark = event.target?.closest?.(`.${FN_CLASS}`)
    if (!mark || !view.dom.contains(mark)) return false
    event.preventDefault()
    const label = mark.getAttribute('data-fn')
    if (label) openRename(view, label, view.posAtDOM(mark))
    return true
  },
})

export const footnotesTheme = EditorView.theme({
  [`.${FN_CLASS}`]: {
    color: colors.accent,
    cursor: 'pointer',
  },
  '.glean-fn-rename': {
    position: 'absolute',
    zIndex: 30,
    background: colors.bgElevated,
    color: colors.text,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '12px',
    fontFamily: 'ui-monospace, monospace',
    minWidth: '80px',
  },
})
