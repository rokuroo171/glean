import { Decoration, WidgetType, EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { colors } from '../theme'

// The rendered table. Zed-style: a caret-distant table is a real grid with
// borders, a header bar, and per-column alignment; clicking a cell (or
// moving the caret into the table) dissolves it back into the raw pipe
// rows for editing. The grid is a block replacement over the whole Table
// node, so the buffer keeps the bytes and the raw state is one caret step
// away — the same contract images, math, and mermaid already follow.
// Law 2 does not restrict the widget (it replaces whole lines); law 3:
// presence is a pure function of (doc, selection) recomputed whole in the
// block field.

// positional cell ranges and text of a row line, empties included: the
// grid needs one cell per separator column even when a cell holds
// nothing. An escaped pipe is cell text, not a delimiter
export function gridCells(line) {
  const raw = line.text
  const from = line.from
  const cells = []
  let start = -1
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
        cells.push({ from: from + a, to: from + b, text: raw.slice(a, b) })
        start = -1
      }
    } else if (start < 0) {
      start = i
    }
  }
  return cells
}

function alignsOf(sepText, columns) {
  const segs = []
  let start = -1
  for (let i = 0; i <= sepText.length; i++) {
    const ch = i < sepText.length ? sepText[i] : '|'
    if (ch === '|' && sepText[i - 1] === '\\') continue
    if (ch === '|') {
      if (start >= 0) {
        segs.push(sepText.slice(start, i))
        start = -1
      }
    } else if (start < 0) {
      start = i
    }
  }
  const out = []
  for (const seg of segs) {
    const s = seg.trim()
    const left = s.startsWith(':')
    const right = s.endsWith(':')
    out.push(left && right ? 'center' : right ? 'right' : 'left')
  }
  while (out.length < columns) out.push('left')
  return out
}

function parseTable(state, node) {
  const doc = state.doc
  const first = doc.lineAt(node.from).number
  const last = doc.lineAt(node.to).number
  const lines = []
  for (let n = first; n <= last; n++) lines.push(doc.line(n))
  const header = gridCells(lines[0])
  const aligns = alignsOf(lines[1] ? lines[1].text : '', Math.max(1, header.length))
  const rows = []
  for (let i = 2; i < lines.length; i++) rows.push(gridCells(lines[i]))
  return {
    // node bounds ride along so eq catches position shifts from edits
    // above the table: a reused widget would click to stale positions
    from: node.from,
    text: state.sliceDoc(node.from, node.to),
    header,
    aligns,
    rows,
  }
}

class TableGrid extends WidgetType {
  constructor(model) {
    super()
    this.model = model
  }
  eq(other) {
    return other.model.from === this.model.from && other.model.text === this.model.text
  }
  toDOM(view) {
    const m = this.model
    const jump = (e, cell) => {
      e.preventDefault()
      view.dispatch({
        selection: { anchor: cell.from + Math.min(2, Math.max(0, cell.to - cell.from)) },
        scrollIntoView: true,
      })
    }
    const table = document.createElement('table')
    table.className = 'glean-table'
    const thead = document.createElement('thead')
    const hr = document.createElement('tr')
    m.header.forEach((cell, i) => {
      const th = document.createElement('th')
      th.style.textAlign = m.aligns[i] || 'left'
      th.textContent = cell.text
      th.addEventListener('mousedown', (e) => jump(e, cell))
      hr.appendChild(th)
    })
    thead.appendChild(hr)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    for (const row of m.rows) {
      const tr = document.createElement('tr')
      for (let c = 0; c < m.header.length; c++) {
        const td = document.createElement('td')
        td.style.textAlign = m.aligns[c] || 'left'
        const cell = row[c]
        if (cell) {
          td.textContent = cell.text
          td.addEventListener('mousedown', (e) => jump(e, cell))
        }
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    return table
  }
  ignoreEvent() {
    // clicks are handled by the cell listeners, which dispatch the
    // selection themselves; the editor must see the event
    return false
  }
}

// block ranges for every Table whose range does not hold the caret; the
// block field merges these with the math and mermaid ranges
export function tableBlockRanges(state) {
  const head = state.selection.main.head
  const out = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return
      const near = head >= node.from && head <= node.to
      if (!near) {
        out.push({
          from: node.from,
          to: node.to,
          deco: Decoration.replace({ widget: new TableGrid(parseTable(state, node.node)), block: true }),
        })
      }
      return false
    },
  })
  return out
}

export const tableGridTheme = EditorView.theme({
  '.glean-table': {
    borderCollapse: 'collapse',
    margin: '6px 0',
    cursor: 'pointer',
  },
  '.glean-table th': {
    border: `1px solid ${colors.border}`,
    background: 'rgba(106, 122, 138, 0.12)',
    padding: '3px 12px',
    fontWeight: 600,
    color: colors.text,
  },
  '.glean-table td': {
    border: `1px solid ${colors.border}`,
    padding: '3px 12px',
    color: colors.text,
  },
  '.glean-table tbody tr:nth-child(2n) td': {
    background: 'rgba(106, 122, 138, 0.05)',
  },
})
