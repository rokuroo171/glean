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

// Extract cells from a TableHeader or TableRow subtree node.
// Uses firstChild/nextSibling to walk the children directly.
function extractCells(state, rowNode) {
  const cells = []
  let c = rowNode.firstChild
  while (c) {
    if (c.name === 'TableCell') {
      cells.push({ text: state.doc.sliceString(c.from, c.to).trim(), from: c.from, to: c.to })
    }
    c = c.nextSibling
  }
  return cells
}

class TableWidget extends WidgetType {
  constructor(headerCells, bodyRows, pos) {
    super()
    this.headerCells = headerCells
    this.bodyRows = bodyRows
    this.pos = pos
  }
  eq(o) {
    return o.pos === this.pos &&
      o.headerCells.length === this.headerCells.length &&
      o.bodyRows.length === this.bodyRows.length &&
      o.headerCells.every((c, i) => c.text === this.headerCells[i].text)
  }
  toDOM(view) {
    const table = document.createElement('table')
    table.className = 'glean-table-widget'
    table.setAttribute('aria-hidden', 'true')
    // Header
    const thead = document.createElement('thead')
    const htr = document.createElement('tr')
    for (const cell of this.headerCells) {
      const th = document.createElement('th')
      th.textContent = cell.text
      htr.appendChild(th)
    }
    thead.appendChild(htr)
    table.appendChild(thead)
    // Body
    if (this.bodyRows.length > 0) {
      const tbody = document.createElement('tbody')
      for (const row of this.bodyRows) {
        const tr = document.createElement('tr')
        for (const cell of row) {
          const td = document.createElement('td')
          td.textContent = cell.text
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
    }
    // Click a cell to jump cursor into the source
    table.addEventListener('click', (e) => {
      const td = e.target.closest('td, th')
      if (!td) return
      const tableEl = td.closest('table')
      const row = td.parentElement
      const ri = Array.from(tableEl.children).reduce((acc, sec) => {
        if (sec.tagName === 'THEAD') return acc
        const rows = Array.from(sec.children)
        const idx = rows.indexOf(row)
        return idx >= 0 ? acc + idx : acc
      }, 0)
      const ci = Array.from(row.children).indexOf(td)
      // Map row/col back to source position
      const allRows = [this.headerCells, ...this.bodyRows]
      if (ri < allRows.length && ci < allRows[ri].length) {
        const cellFrom = allRows[ri][ci].from
        view.dispatch({ selection: { anchor: cellFrom } })
        view.focus()
      }
    })
    return table
  }
  ignoreEvent() { return false }
}

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
  // Show # when cursor is anywhere on the heading line
  const onLine = cursorHead >= line.from && cursorHead <= line.to
  if (!onLine) {
    add(markerFrom, markerTo, hideMark)
  }
  // Closing hashes: `# Heading #` hides the trailing run too.
  const content = state.doc.sliceString(textFrom, textTo)
  const cm = content.match(/(\s+#+)(\s*)$/)
  if (cm && content.length > cm[0].length) {
    const closeFrom = textTo - cm[0].length
    if (!onLine) {
      add(closeFrom, textTo, hideMark)
    }
  }
  add(textFrom, textTo, headingMark(level))
}

// Setext headings: style the text lines as a heading, hide the
// underline of `=` or `-` marks.
function setextDecorations(add, state, node, cursorHead, level) {
  const underlineLine = state.doc.lineAt(node.to)
  const textTo = underlineLine.number > 1 ? state.doc.line(underlineLine.number - 1).to : node.from
  if (textTo <= node.from) return
  add(node.from, textTo, headingMark(level))
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (!onNode) {
    add(underlineLine.from, underlineLine.to, hideMark)
  }
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
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (openIsDelim && !onNode) {
    add(node.from, node.from + delimiterLen, hideMark)
  }
  add(innerFrom, innerTo, contentMark)
  if (closeIsDelim && !onNode) {
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
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (!onNode) {
    add(node.from, innerFrom, hideMark)
  }
  add(innerFrom, innerTo, inlineCodeMark)
  if (!onNode) {
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
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (!onNode) {
    add(node.from, labelFrom, hideMark)
  }
  add(labelFrom, labelTo, linkMark)
  if (!onNode) {
    add(node.from + close, node.to, hideMark)
  }
}

// Code fences: block background over every line, fence lines hidden.
function fencedCodeDecorations(add, state, node, cursorHead) {
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (firstLine.number !== lastLine.number) {
    const openFenceTo = firstLine.to
    const closeFenceFrom = lastLine.from
    if (!onNode) {
      add(node.from, openFenceTo, hideMark)
    }
    if (!onNode) {
      add(closeFenceFrom, node.to, hideMark)
    }
  }
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    add(l.from, l.from, codeBlockLine)
  }
}

const CALLOUT_RE = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/
const CALLOUT_ICONS = {
  NOTE: '\u270e',       // pencil
  TIP: '\u26a1',        // lightning
  IMPORTANT: '\u2757',  // exclamation
  WARNING: '\u26a0',    // warning
  CAUTION: '\u26a0',    // caution
}
const CALLOUT_COLORS = {
  NOTE:       { bg: 'rgba(55,130,200,0.10)', border: '#3388cc', title: '#3388cc' },
  TIP:        { bg: 'rgba(80,180,80,0.10)',  border: '#44aa44', title: '#44aa44' },
  IMPORTANT:  { bg: 'rgba(150,90,210,0.10)', border: '#8855cc', title: '#8855cc' },
  WARNING:    { bg: 'rgba(200,160,50,0.10)', border: '#ccaa33', title: '#ccaa33' },
  CAUTION:    { bg: 'rgba(200,80,70,0.10)',  border: '#cc4433', title: '#cc4433' },
}

function calloutTypeColor(type) { return CALLOUT_COLORS[type] || CALLOUT_COLORS.NOTE }

// Callout: detect > [!TYPE] at the start of a blockquote, hide the
// marker, apply a colored background, and add a bold title line.
function calloutDecorations(add, state, node, head) {
  const firstLine = state.doc.lineAt(node.from)
  const m = firstLine.text.match(CALLOUT_RE)
  if (!m) return false
  const type = m[1]
  const color = calloutTypeColor(type)
  const markerLen = m[0].length
  const lastLine = state.doc.lineAt(node.to)
  const icon = CALLOUT_ICONS[type] || ''
  const titleText = `${icon} ${type}`
  const onFirstLine = head >= firstLine.from && head <= firstLine.to
  if (!onFirstLine) {
    add(firstLine.from, firstLine.from + markerLen, hideMark)
  }
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    if (ln === firstLine.number) {
      // Title line: icon + bold type name after the hidden marker
      add(l.from + markerLen, l.from + markerLen, Decoration.line({
        class: 'glean-callout-title',
      }))
      add(l.from + markerLen, l.from + markerLen + titleText.length, Decoration.mark({
        class: `glean-callout-icon glean-callout-${type.toLowerCase()}-icon`,
      }))
    } else {
      // Body lines: callout background
      add(l.from, l.from, Decoration.line({
        class: `glean-callout glean-callout-${type.toLowerCase()}`,
      }))
    }
  }
  return true
}

// Blockquote: hide `>` markers, give the lines a left border.
// If it starts with > [!TYPE], render as a colored callout box.
function blockquoteDecorations(add, state, node, head) {
  if (calloutDecorations(add, state, node, head)) return
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    add(l.from, l.from, quoteLine)
    const qm = l.text.match(/^(?:\s*>\s?)+/)
    const onThisLine = head >= l.from && head <= l.to
    if (qm && !onThisLine) add(l.from, l.from + qm[0].length, hideMark)
  }
}

// Tables: render as a styled HTML grid widget, hiding the source.
// The cursor-reveal pattern lets the user edit by clicking a cell.
function tableDecorations(add, state, node) {
  if (node.to <= node.from) return
  // Walk the document-level children to find the Table subtree at this position
  const docNode = syntaxTree(state).topNode
  let child = docNode.firstChild
  while (child && !(child.name === 'Table' && child.from === node.from)) {
    child = child.nextSibling
  }
  if (!child || child.name !== 'Table') return
  let headerCells = []
  let bodyRows = []
  let rowChild = child.firstChild
  while (rowChild) {
    if (rowChild.name === 'TableHeader') {
      headerCells = extractCells(state, rowChild)
    } else if (rowChild.name === 'TableRow') {
      bodyRows.push(extractCells(state, rowChild))
    }
    rowChild = rowChild.nextSibling
  }
  if (headerCells.length === 0) return
  add(node.from, node.to, Decoration.replace({
    widget: new TableWidget(headerCells, bodyRows, node.from),
    block: true,
  }))
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
      if (name === 'SetextHeading1') { setextDecorations(add, state, node, head, 1); return }
      if (name === 'SetextHeading2') { setextDecorations(add, state, node, head, 2); return }
      if (name === 'FencedCode') { fencedCodeDecorations(add, state, node, head); return false }
      if (name === 'Blockquote') { blockquoteDecorations(add, state, node, head); return }
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