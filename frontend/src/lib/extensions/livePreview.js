import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

// Live preview renders markdown as rich content while keeping the source
// editable. The engine walks the markdown syntax tree and builds a
// decoration set each time the doc or the cursor moves:
//
// - inline marks (bold, italic, strike, code, links, images) get styled
//   and their delimiters hidden
// - headings and blockquotes hide their markers and style the text
// - code fences get a block background with the fence lines hidden
// - task markers render as clickable checkboxes that toggle the source
// - tables dim the delimiter row and keep cells readable
//
// Hidden ranges follow the folding pattern: when the cursor touches a
// hidden marker, the marker is shown so the user can edit it, and it
// hides again once the cursor leaves.
//
// Ranges are collected and sorted by (from, startSide) before they go
// into the RangeSetBuilder, since it requires sorted input and a plain
// tree walk mixes block ranges with the inline ranges inside them.

class TaskCheckbox extends WidgetType {
  constructor(checked) { super(); this.checked = checked }
  eq(o) { return o.checked === this.checked }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.className = 'glean-taskbox'
    const box = wrap.appendChild(document.createElement('input'))
    box.type = 'checkbox'
    box.checked = this.checked
    return wrap
  }
  ignoreEvent() { return false }
}

const hideMark = Decoration.mark({ class: 'glean-hide' })
const inlineCodeMark = Decoration.mark({ class: 'glean-icode' })
const linkMark = Decoration.mark({ class: 'glean-link' })
const imagePlaceholder = Decoration.mark({ class: 'glean-image' })
const codeBlockLine = Decoration.line({ class: 'glean-codeblock' })
const quoteLine = Decoration.line({ class: 'glean-quote' })
const tableDelimiterLine = Decoration.line({ class: 'glean-tabledelim' })
const boldMark = Decoration.mark({ class: 'glean-bold' })
const italicMark = Decoration.mark({ class: 'glean-italic' })
const strikeMark = Decoration.mark({ class: 'glean-strike' })
const taskTextMark = Decoration.mark({ class: 'glean-tasktext' })

function headingMark(level) {
  return Decoration.mark({ class: `glean-h${Math.min(level, 6)}` })
}

function taskCheckbox(checked) {
  return Decoration.replace({ widget: new TaskCheckbox(checked) })
}

// Headings. ATXHeading nodes cover the whole line including the `#`
// markers. Style the text, hide the marker run plus one space.
function headingDecorations(add, state, node, cursorHead, level) {
  const line = state.doc.lineAt(node.from)
  const rel = node.from - line.from
  const text = line.text.slice(rel)
  const m = text.match(/^(#{1,6})(\s*)/)
  if (!m) return
  const markerFrom = node.from
  const markerTo = markerFrom + m[1].length + Math.min(m[2].length, 1)
  const textFrom = markerTo
  const textTo = Math.min(node.to, line.to)
  if (textFrom >= textTo) return
  if (!(cursorHead >= markerFrom && cursorHead <= markerTo)) {
    add(markerFrom, markerTo, hideMark)
  }
  add(textFrom, textTo, headingMark(level))
}

// Inline emphasis: hide the delimiter pairs, style the content.
function emphasisDecorations(add, state, node, cursorHead, contentMark, delimiterLen) {
  const open = state.doc.sliceString(node.from, node.from + delimiterLen)
  const close = state.doc.sliceString(node.to - delimiterLen, node.to)
  const openIsDelim = /^(\*\*|__|\*|_|~~)$/.test(open)
  const closeIsDelim = /^(\*\*|__|\*|_|~~)$/.test(close)
  const innerFrom = node.from + (openIsDelim ? delimiterLen : 0)
  const innerTo = node.to - (closeIsDelim ? delimiterLen : 0)
  if (innerFrom >= innerTo) return
  if (openIsDelim && !(cursorHead >= node.from && cursorHead <= node.from + delimiterLen)) {
    add(node.from, node.from + delimiterLen, hideMark)
  }
  add(innerFrom, innerTo, contentMark)
  if (closeIsDelim && !(cursorHead >= node.to - delimiterLen && cursorHead <= node.to)) {
    add(node.to - delimiterLen, node.to, hideMark)
  }
}

// Inline code: hide the backtick pairs, style the content.
function inlineCodeDecorations(add, state, node, cursorHead) {
  const text = state.doc.sliceString(node.from, node.to)
  const fence = (text.match(/^(`+)/) || ['', '`'])[1].length
  if (node.to - node.from <= fence * 2) return
  const innerFrom = node.from + fence
  const innerTo = node.to - fence
  if (!(cursorHead >= node.from && cursorHead <= node.from + fence)) {
    add(node.from, innerFrom, hideMark)
  }
  add(innerFrom, innerTo, inlineCodeMark)
  if (!(cursorHead >= node.to - fence && cursorHead <= node.to)) {
    add(innerTo, node.to, hideMark)
  }
}

// Links: hide the brackets and the `](url)` tail, style the label.
function linkDecorations(add, state, node, cursorHead) {
  const text = state.doc.sliceString(node.from, node.to)
  const close = text.lastIndexOf(']')
  if (close <= 0) return
  const labelFrom = node.from + 1
  const labelTo = node.from + close
  if (!(cursorHead >= node.from && cursorHead <= node.from + 1)) {
    add(node.from, labelFrom, hideMark)
  }
  add(labelFrom, labelTo, linkMark)
  if (!(cursorHead >= node.from + close && cursorHead <= node.to)) {
    add(node.from + close, node.to, hideMark)
  }
}

// Code fences: block background over every line, fence lines hidden.
function fencedCodeDecorations(add, state, node, cursorHead) {
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  if (firstLine.number !== lastLine.number) {
    const openFenceTo = firstLine.to
    const closeFenceFrom = lastLine.from
    if (!(cursorHead >= node.from && cursorHead <= openFenceTo)) {
      add(node.from, openFenceTo, hideMark)
    }
    if (!(cursorHead >= closeFenceFrom && cursorHead <= node.to)) {
      add(closeFenceFrom, node.to, hideMark)
    }
  }
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    add(l.from, l.from, codeBlockLine)
  }
}

// Blockquote: hide `>` markers, give the lines a left border.
function blockquoteDecorations(add, state, node) {
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    add(l.from, l.from, quoteLine)
    const m = l.text.match(/^(?:\s*>\s?)+/)
    if (m) add(l.from, l.from + m[0].length, hideMark)
  }
}

// Tables: dim the delimiter row (the `---` separator). Cells keep as-is.
function tableDecorations(add, state, node) {
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    const body = l.text.trim().replace(/^\|/, '').replace(/\|$/, '')
    const cells = body.split('|').map(c => c.trim())
    if (cells.length >= 1 && cells.every(c => /^:?-{1,}:?$/.test(c))) {
      add(l.from, l.from, tableDelimiterLine)
    }
  }
}

// Images: style the whole syntax as a dimmed placeholder.
function imageDecorations(add, state, node) {
  add(node.from, node.to, imagePlaceholder)
}

// Task markers: replace `[ ]`/`[x]` with a clickable checkbox.
function taskDecorations(add, state, node, cursorHead) {
  const text = state.doc.sliceString(node.from, node.to)
  const m = text.match(/^\[([ x])\]/)
  if (!m) return
  if (cursorHead >= node.from && cursorHead <= node.to) {
    add(node.from, node.to, taskTextMark)
  } else {
    add(node.from, node.to, taskCheckbox(m[1] !== ' '))
  }
}

// Build the full decoration set for the current doc and cursor.
export function buildLivePreview(state) {
  const tree = syntaxTree(state)
  const head = state.selection.main.head
  const ranges = []
  const add = (from, to, deco) => ranges.push({ from, to, deco })
  tree.iterate({
    enter(node) {
      const name = node.name
      if (name.startsWith('ATXHeading')) {
        headingDecorations(add, state, node, head, Number(name.slice(-1)))
        return
      }
      if (name === 'FencedCode') { fencedCodeDecorations(add, state, node, head); return false }
      if (name === 'Blockquote') { blockquoteDecorations(add, state, node); return }
      if (name === 'Table') { tableDecorations(add, state, node); return }
      if (name === 'Image') { imageDecorations(add, state, node); return false }
      if (name === 'TaskMarker') { taskDecorations(add, state, node, head); return false }
      if (name === 'StrongEmphasis') { emphasisDecorations(add, state, node, head, boldMark, 2); return false }
      if (name === 'Emphasis') { emphasisDecorations(add, state, node, head, italicMark, 1); return false }
      if (name === 'Strikethrough') { emphasisDecorations(add, state, node, head, strikeMark, 2); return false }
      if (name === 'InlineCode') { inlineCodeDecorations(add, state, node, head); return false }
      if (name === 'Link') { linkDecorations(add, state, node, head); return false }
      return undefined
    },
  })
  ranges.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const r of ranges) builder.add(r.from, r.to, r.deco)
  return builder.finish()
}

// The live preview state field. Rebuilds when the doc, the syntax tree,
// or the cursor changes so hidden markers reveal at the cursor.
export const livePreviewField = StateField.define({
  create(state) { return buildLivePreview(state) },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selectionSet && syntaxTree(tr.startState) === syntaxTree(tr.state)) {
      return deco
    }
    return buildLivePreview(tr.state)
  },
  provide: f => EditorView.decorations.from(f),
})

// Toggle a task checkbox in the source when the rendered box is clicked.
export function toggleTaskAt(view, pos) {
  const line = view.state.doc.lineAt(pos)
  const text = line.text
  const m = text.match(/^(\s*[-*+]\s+)\[([ x])\]/)
  if (!m) return false
  const from = line.from + m[0].length - 3
  const checked = m[2] === ' ' ? 'x' : ' '
  view.dispatch({
    changes: { from, to: from + 3, insert: `[${checked}]` },
  })
  return true
}

// Clicks on the rendered checkbox flip the source marker. The widget
// reports ignoreEvent: false, so the editor-wide handler sees the click.
export const taskClickPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = Decoration.none
  }
  update() {}
}, {
  decorations: () => Decoration.none,
  eventHandlers: {
    mousedown(e, view) {
      const target = e.target
      if (target && target.nodeName === 'INPUT' &&
          target.parentElement && target.parentElement.classList.contains('glean-taskbox')) {
        e.preventDefault()
        toggleTaskAt(view, view.posAtDOM(target))
        return true
      }
      return false
    },
  },
})