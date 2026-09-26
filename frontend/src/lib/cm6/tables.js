import { EditorSelection } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// Table cell navigation over the raw buffer. The pipes and dashes stay
// real text: nothing here renders a table (blocks.js styles the lines),
// this layer only moves the caret between cell text ranges the way the
// PM table editor moved it between cell nodes. Tab lands on the
// next cell's text (creating trailing cells is a content edit the author
// makes by typing pipes), Shift-Tab goes back, and Tab on the last cell
// of the header falls through so the browser can move focus out.

function tableAt(state, pos) {
  const node = syntaxTree(state).resolveInner(pos, -1)
  let cur = node
  while (cur) {
    if (cur.name === 'Table') return cur
    cur = cur.parent
  }
  return null
}

export function isSeparatorLine(text) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(text)
}

// cell text ranges of one table row line, in order, trimmed to the cell
// content the way a cell editor holds no padding whitespace. An escaped
// pipe is cell text, not a delimiter
export function cellsOfLine(line) {
  const text = line.text
  if (isSeparatorLine(text)) return []
  const cells = []
  let start = -1
  const raw = text
  const from = line.from
  let i = 0
  if (raw.startsWith('|')) i = 1
  for (; i <= raw.length; i++) {
    const ch = i < raw.length ? raw[i] : '|'
    if (ch === '|' && raw[i - 1] === '\\') continue
    if (ch === '|') {
      if (start >= 0) {
        let a = start
        let b = i
        while (a < b && (raw[a] === ' ' || raw[a] === '\t')) a++
        while (b > a && (raw[b - 1] === ' ' || raw[b - 1] === '\t')) b--
        if (b > a) cells.push({ from: from + a, to: from + b })
        start = -1
      }
    } else if (start < 0) {
      start = i
    }
  }
  // a row without a leading pipe still holds its first cell
  if (cells.length === 0 && raw.trim() !== '') {
    const trimmedStart = raw.search(/\S/)
    const trimmedEnd = raw.replace(/\s+$/, '').length
    if (trimmedStart >= 0 && trimmedEnd > trimmedStart) {
      cells.push({ from: from + trimmedStart, to: from + trimmedEnd })
    }
  }
  return cells
}

function rowLines(table, doc) {
  const first = doc.lineAt(table.from).number
  const last = doc.lineAt(table.to).number
  const lines = []
  for (let n = first; n <= last; n++) lines.push(doc.line(n))
  return lines
}

export function cellOffset(view, dir) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const table = tableAt(state, sel.head)
  if (!table) return false
  const doc = state.doc
  const lines = rowLines(table, doc).filter((l) => !isSeparatorLine(l.text))
  if (lines.length === 0) return false

  const flat = []
  for (const line of lines) {
    for (const cell of cellsOfLine(line)) flat.push(cell)
  }
  if (flat.length === 0) return false

  const idx = flat.findIndex((c) => sel.head >= c.from && sel.head <= c.to)
  if (idx < 0) return false

  if (dir > 0) {
    // Tab: the start of the next cell; on the table's last cell it falls
    // through so focus behavior stays the browser's
    if (idx + 1 >= flat.length) return false
    view.dispatch({ selection: EditorSelection.cursor(flat[idx + 1].from), scrollIntoView: true })
    return true
  }
  // Shift-Tab: back to the current cell's start when the caret moved
  // inside it, otherwise the previous cell's start
  const at = sel.head > flat[idx].from ? flat[idx].from
    : idx > 0 ? flat[idx - 1].from : -1
  if (at < 0) return false
  view.dispatch({ selection: EditorSelection.cursor(at), scrollIntoView: true })
  return true
}

export const tableKeymap = [
  { key: 'Tab', run: (v) => cellOffset(v, 1) },
  { key: 'Shift-Tab', run: (v) => cellOffset(v, -1) },
]
