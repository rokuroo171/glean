import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { renderToString } from 'katex'

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

class EmptyWidget extends WidgetType {
  constructor() { super() }
  eq() { return true }
  toDOM() {
    const s = document.createElement('span')
    s.setAttribute('aria-hidden', 'true')
    s.style.cssText = 'display:inline'
    return s
  }
}
const _emptyW = new EmptyWidget()
function hideMark() { return Decoration.replace({ widget: _emptyW }) }

// Alternative hide using mark decoration with CSS
const hiddenMark = Decoration.mark({ class: 'glean-hidden-mark' })

// KaTeX math rendering widget
class MathWidget extends WidgetType {
  constructor(latex, displayMode) {
    super()
    this.latex = latex
    this.displayMode = displayMode
  }
  eq(o) { return o.latex === this.latex && o.displayMode === this.displayMode }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'glean-math'
    try {
      span.innerHTML = renderToString(this.latex, {
        displayMode: this.displayMode,
        throwOnError: false,
        trust: true,
      })
    } catch (e) {
      span.textContent = this.latex
      span.style.color = '#db4c40'
    }
    return span
  }
}

// Mermaid diagram rendering widget (lazy init)
let mermaidReady = false
let mermaidInstance = null
let mermaidId = 0

async function ensureMermaid() {
  if (mermaidReady) return mermaidInstance
  const m = (await import('mermaid')).default
  m.initialize({ startOnLoad: false, theme: 'dark' })
  mermaidInstance = m
  mermaidReady = true
  return m
}

class MermaidWidget extends WidgetType {
  constructor(code) {
    super()
    this.code = code
  }
  eq(o) { return o.code === this.code }
  toDOM(view) {
    const container = document.createElement('div')
    container.className = 'glean-mermaid'
    container.style.cssText = 'text-align:center;margin:8px 0;min-height:40px;'
    const id = `mermaid-${++mermaidId}`
    container.textContent = 'Loading diagram...'
    ensureMermaid().then(m => {
      m.render(id, this.code).then(({ svg }) => {
        container.innerHTML = svg
      }).catch(e => {
        console.error('Mermaid render error:', e)
        container.style.color = '#db4c40'
        container.style.fontSize = '12px'
        container.textContent = `Mermaid error: ${e.message}`
      })
    }).catch(e => {
      console.error('Mermaid init error:', e)
      container.style.color = '#db4c40'
      container.textContent = `Mermaid init error: ${e.message}`
    })
    return container
  }
}

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
    add(markerFrom, markerTo, hideMark())
  }
  // Closing hashes: `# Heading #` hides the trailing run too.
  const content = state.doc.sliceString(textFrom, textTo)
  const cm = content.match(/(\s+#+)(\s*)$/)
  if (cm && content.length > cm[0].length) {
    const closeFrom = textTo - cm[0].length
    if (!onLine) {
      add(closeFrom, textTo, hideMark())
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
    add(underlineLine.from, underlineLine.to, hideMark())
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
    add(node.from, node.from + delimiterLen, hideMark())
  }
  add(innerFrom, innerTo, contentMark)
  if (closeIsDelim && !onNode) {
    add(node.to - delimiterLen, node.to, hideMark())
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
    add(node.from, innerFrom, hideMark())
  }
  add(innerFrom, innerTo, inlineCodeMark)
  if (!onNode) {
    add(innerTo, node.to, hideMark())
  }
}

// Links: hide the brackets and the `](url)` tail, style the label.
function linkDecorations(add, state, node, cursorHead) {
  const text = state.doc.sliceString(node.from, node.to)
  // For [text](url) use first ], for [text][ref] also use first ]
  const close = text.indexOf(']')
  if (close <= 0) return
  const labelFrom = node.from + 1
  const labelTo = node.from + close
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  if (!onNode) {
    add(node.from, labelFrom, hideMark())
  }
  add(labelFrom, labelTo, linkMark)
  if (!onNode) {
    add(node.from + close, node.to, hideMark())
  }
}

// Code fences: block background over every line, fence lines hidden.
// For math/mermaid blocks, render as widgets when cursor is not inside.
function fencedCodeDecorations(add, state, node, cursorHead) {
  const firstLine = state.doc.lineAt(node.from)
  const lastLine = state.doc.lineAt(node.to)
  const onNode = cursorHead >= node.from && cursorHead <= node.to
  
  // Detect language from opening fence
  const fenceMatch = firstLine.text.match(/^(`{3,}|~{3,})\s*(\w*)/)
  const lang = fenceMatch ? fenceMatch[2].toLowerCase() : ''
  
  // Math block: render as KaTeX widget when not editing
  if ((lang === 'math' || lang === 'latex' || lang === 'katex') && !onNode) {
    const code = state.doc.sliceString(firstLine.to + 1, lastLine.from)
    add(node.from, node.to, Decoration.replace({
      widget: new MathWidget(code.trim(), true),
      block: true,
    }))
    return false
  }
  
  // Mermaid block: render as diagram widget when not editing
  if (lang === 'mermaid' && !onNode) {
    const code = state.doc.sliceString(firstLine.to + 1, lastLine.from)
    add(node.from, node.to, Decoration.replace({
      widget: new MermaidWidget(code.trim()),
      block: true,
    }))
    return false
  }
  
  // Default: style as code block
  if (firstLine.number !== lastLine.number) {
    const openFenceTo = firstLine.to
    const closeFenceFrom = lastLine.from
    if (!onNode) {
      add(node.from, openFenceTo, hideMark())
    }
    if (!onNode) {
      add(closeFenceFrom, node.to, hideMark())
    }
  }
  for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
    const l = state.doc.line(ln)
    add(l.from, l.from, codeBlockLine)
  }
}

const CALLOUT_RE = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/

// GitHub-style Lucide SVG icons for callouts
const CALLOUT_SVG = {
  NOTE: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  TIP: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8l4 2"/><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>',
  IMPORTANT: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  WARNING: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  CAUTION: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
}

const CALLOUT_COLORS = {
  NOTE:       { bg: 'rgba(56,139,253,0.10)', border: '#388bfd', title: '#58a6ff', iconBg: 'rgba(56,139,253,0.15)' },
  TIP:        { bg: 'rgba(63,185,80,0.10)',  border: '#3fb950', title: '#3fb950', iconBg: 'rgba(63,185,80,0.15)' },
  IMPORTANT:  { bg: 'rgba(137,87,224,0.10)', border: '#8957e5', title: '#bc8cff', iconBg: 'rgba(137,87,224,0.15)' },
  WARNING:    { bg: 'rgba(210,153,34,0.10)', border: '#d29922', title: '#e3b341', iconBg: 'rgba(210,153,34,0.15)' },
  CAUTION:    { bg: 'rgba(248,81,73,0.10)',  border: '#f85149', title: '#f85149', iconBg: 'rgba(248,81,73,0.15)' },
}

class CalloutWidget extends WidgetType {
  constructor(type, bodyLines) {
    super()
    this.type = type
    this.bodyLines = bodyLines
  }
  eq(o) { return o.type === this.type && o.bodyLines === this.bodyLines }
  toDOM() {
    const c = CALLOUT_COLORS[this.type] || CALLOUT_COLORS.NOTE
    const icon = CALLOUT_SVG[this.type] || CALLOUT_SVG.NOTE
    const wrap = document.createElement('div')
    wrap.style.cssText = `border-left:3px solid ${c.border};border-radius:6px;background:${c.bg};padding:0 16px 4px 12px;margin:8px 0;`
    wrap.setAttribute('aria-hidden', 'true')
    const title = document.createElement('div')
    title.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 0 4px;font-weight:600;font-size:14px;color:${c.title};`
    title.innerHTML = `<span style="display:inline-flex;align-items:center;color:${c.title}">${icon}</span><span>${this.type.charAt(0) + this.type.slice(1).toLowerCase()}</span>`
    wrap.appendChild(title)
    const body = document.createElement('div')
    body.style.cssText = 'color:#c8d6e0;font-size:14px;line-height:1.6;padding-bottom:4px;'
    body.textContent = this.bodyLines
    wrap.appendChild(body)
    return wrap
  }
  ignoreEvent() { return false }
}

function calloutTypeColor(type) { return CALLOUT_COLORS[type] || CALLOUT_COLORS.NOTE }

// Callout: detect > [!TYPE] at the start of a blockquote, replace with
// a GitHub-style callout widget with SVG icon, colored border, and background.
function calloutDecorations(add, state, node, head) {
  const firstLine = state.doc.lineAt(node.from)
  const m = firstLine.text.match(CALLOUT_RE)
  if (!m) return false
  const type = m[1]
  const markerLen = m[0].length
  const lastLine = state.doc.lineAt(node.to)
  const onNode = head >= node.from && head <= node.to
  if (!onNode) {
    // Collect body lines (strip leading > markers)
    let bodyLines = ''
    for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
      const l = state.doc.line(ln)
      let lineText = l.text
      // Strip leading > markers
      lineText = lineText.replace(/^\s*>\s?/, '')
      // Skip the [!TYPE] marker on first line
      if (ln === firstLine.number) {
        lineText = lineText.replace(/^\[!\w+\]\s*/, '')
      }
      if (lineText || ln > firstLine.number) {
        bodyLines += (bodyLines ? '\n' : '') + lineText
      }
    }
    add(node.from, node.to, Decoration.replace({
      widget: new CalloutWidget(type, bodyLines),
      block: true,
    }))
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
    if (qm && !onThisLine) add(l.from, l.from + qm[0].length, hideMark())
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

// Inline math: detect $...$ and render as KaTeX when not editing.
function inlineMathDecorations(add, state, cursorHead) {
  const text = state.doc.toString()
  const mathRegex = /\$([^$]+)\$/g
  let match
  while ((match = mathRegex.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    const latex = match[1]
    // Skip if cursor is inside this math
    const onMath = cursorHead >= from && cursorHead <= to
    if (!onMath && latex.trim()) {
      add(from, to, Decoration.replace({
        widget: new MathWidget(latex, false),
      }))
    }
  }
}

// Strikethrough: detect ~~...~~ via regex since CM6 base parser doesn't parse it.
function strikethroughDecorations(add, state, cursorHead) {
  const text = state.doc.toString()
  const re = /~~([^~]+?)~~/g
  let match
  while ((match = re.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    const onNode = cursorHead >= from && cursorHead <= to
    if (!onNode) {
      add(from, from + 2, hideMark())
      add(from + 2, to - 2, strikeMark)
      add(to - 2, to, hideMark())
    } else {
      add(from + 2, to - 2, strikeMark)
    }
  }
}

// List marks: hide -, *, +, 1. etc when cursor is not on the line.
function listMarkDecorations(add, state, node, head) {
  const line = state.doc.lineAt(node.from)
  const onLine = head >= line.from && head <= line.to
  if (!onLine) {
    // Replace the marker text with an empty widget to hide it
    add(node.from, node.to, Decoration.replace({ widget: _emptyW }))
  }
}

// Horizontal rule: replace --- with a styled <hr>.
class HorizontalRuleWidget extends WidgetType {
  constructor() { super() }
  eq() { return true }
  toDOM() {
    const hr = document.createElement('div')
    hr.setAttribute('aria-hidden', 'true')
    hr.style.cssText = `border:none;border-top:1px solid rgba(90,106,122,0.3);margin:16px 0;`
    return hr
  }
}

function horizontalRuleDecorations(add, state, node, head) {
  const line = state.doc.lineAt(node.from)
  const onLine = head >= line.from && head <= line.to
  if (!onLine) {
    add(line.from, line.to, Decoration.replace({
      widget: new HorizontalRuleWidget(),
      block: true,
    }))
  }
}

// Build the full decoration set for the current doc and cursor.
export function buildLivePreview(state) {
  const tree = syntaxTree(state)
  const head = state.selection.main.head
  const ranges = []
  const add = (from, to, deco) => ranges.push({ from, to, deco })
  
  // Add inline math decorations
  inlineMathDecorations(add, state, head)
  
  // Add strikethrough decorations (regex-based since CM6 doesn't parse ~~)
  strikethroughDecorations(add, state, head)
  
  // Hide reference link definitions [label]: url
  const docText = state.doc.toString()
  const refDefRe = /^\s*\[([^^\]]+)\]:\s+\S/mg
  let refMatch
  while ((refMatch = refDefRe.exec(docText)) !== null) {
    const lineStart = docText.lastIndexOf('\n', refMatch.index) + 1
    let lineEnd = docText.indexOf('\n', refMatch.index)
    if (lineEnd < 0) lineEnd = docText.length
    const onDef = head >= lineStart && head <= lineEnd
    if (!onDef) {
      add(lineStart, lineEnd, Decoration.replace({ widget: _emptyW }))
    }
  }
  
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
      if (name === 'ListMark') { listMarkDecorations(add, state, node, head); return false }
      if (name === 'HorizontalRule') { horizontalRuleDecorations(add, state, node, head); return false }
      if (name === 'StrongEmphasis') { emphasisDecorations(add, state, node, head, boldMark, 2); return false }
      if (name === 'Emphasis') { emphasisDecorations(add, state, node, head, italicMark, 1); return undefined }
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
    // Rebuild on every transaction so cursor moves trigger marker reveal/hide
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