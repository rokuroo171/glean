import { keymap } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { indentMore, indentLess } from '@codemirror/commands'

// glean editing behaviors on top of CodeMirror 6:
//
// - Backspace removes a full tab-width of leading spaces at once
// - Tab indents the selection, or navigates table cells; Shift+Tab
//   outdents, or goes to the previous cell
// - Enter inside a table row inserts a new row with the same columns
// - Ctrl+B/I/K wrap the selection in bold, italic, or a link
// - Ctrl+Shift+I opens the image picker (delegated to the shell)

function tabWidth(prefs) {
  return prefs?.editor?.tab_width || 2
}

function selectionLine(state, pos) {
  return state.doc.lineAt(pos)
}

function isTableRow(lineText) {
  return lineText.includes('|') && !/^\s*\|[\s\-:|]+\|\s*$/.test(lineText)
}

function cellStarts(lineText) {
  const starts = []
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '|') starts.push(i)
  }
  return starts
}

/** Move to the next table cell, or insert a new row at the end. */
function tableNextCell(view) {
  const { state } = view
  const { from, to } = state.selection.main
  if (from !== to) return false
  const line = selectionLine(state, from)
  if (!isTableRow(line.text)) return false
  const cp = from - line.from
  const pipes = cellStarts(line.text)
  if (pipes.length < 2) return false
  let np = -1
  for (let i = 0; i < pipes.length; i++) {
    if (pipes[i] > cp) { np = pipes[i]; break }
  }
  if (np >= 0) {
    const after = line.text.slice(np + 1)
    const sp = after.match(/^\s+/)
    const target = line.from + np + 1 + (sp ? sp[0].length : 0)
    view.dispatch({ selection: EditorSelection.cursor(target) })
    return true
  }
  // Last cell: next row's first cell, or a new row with same columns.
  const lineEnd = line.to
  const nextStart = lineEnd + 1
  if (nextStart < state.doc.length) {
    const next = state.doc.lineAt(nextStart)
    if (isTableRow(next.text)) {
      const after2 = next.text.slice(pipes[0] + 1)
      const sp2 = after2.match(/^\s+/)
      view.dispatch({ selection: EditorSelection.cursor(next.from + pipes[0] + 1 + (sp2 ? sp2[0].length : 0)) })
      return true
    }
  }
  const cols = pipes.length - 1
  const newRow = '\n| ' + Array(cols).fill('Cell').join(' | ') + ' |'
  const insertAt = lineEnd
  view.dispatch({
    changes: { from: insertAt, to: insertAt, insert: newRow },
    selection: EditorSelection.cursor(insertAt + 3),
  })
  return true
}

/** Move to the previous table cell, or the previous row's last cell. */
function tablePrevCell(view) {
  const { state } = view
  const { from, to } = state.selection.main
  if (from !== to) return false
  const line = selectionLine(state, from)
  if (!isTableRow(line.text)) return false
  const cp = from - line.from
  const pipes = cellStarts(line.text)
  if (pipes.length < 2) return false
  let pp = -1
  for (let i = pipes.length - 1; i >= 0; i--) {
    if (pipes[i] < cp - 1) { pp = pipes[i]; break }
  }
  if (pp >= 0) {
    const after = line.text.slice(pp + 1)
    const sp = after.match(/^\s+/)
    view.dispatch({ selection: EditorSelection.cursor(line.from + pp + 1 + (sp ? sp[0].length : 0)) })
    return true
  }
  // First cell: previous row's last cell.
  const prevEnd = line.from - 1
  if (prevEnd <= 0) return false
  const prev = state.doc.lineAt(prevEnd)
  if (isTableRow(prev.text)) {
    const p2 = cellStarts(prev.text)
    if (p2.length >= 2) {
      const lk = p2[p2.length - 2]
      const after2 = prev.text.slice(lk + 1)
      const sp2 = after2.match(/^\s+/)
      view.dispatch({ selection: EditorSelection.cursor(prev.from + lk + 1 + (sp2 ? sp2[0].length : 0)) })
      return true
    }
  }
  return false
}

/** Enter in a table row inserts a new row with the same column count. */
function tableEnter(view) {
  const { state } = view
  const { from, to } = state.selection.main
  if (from !== to) return false
  const line = selectionLine(state, from)
  if (!isTableRow(line.text)) return false
  const pipes = cellStarts(line.text)
  if (pipes.length < 2) return false
  const insertAt = line.to
  const cols = pipes.length - 1
  const newRow = '\n| ' + Array(cols).fill('Cell').join(' | ') + ' |'
  view.dispatch({
    changes: { from: insertAt, to: insertAt, insert: newRow },
    selection: EditorSelection.cursor(insertAt + 3),
  })
  return true
}

/** Backspace removes a full tab-width of trailing spaces at once. */
function smartBackspace(view, prefsRef) {
  const { state } = view
  const { from, to } = state.selection.main
  if (from !== to) return false
  if (from <= 0) return false
  const tw = tabWidth(prefsRef.current)
  const before = state.doc.sliceString(0, from)
  const lineStart = before.lastIndexOf('\n') + 1
  const lineIndent = from - lineStart
  if (lineIndent === 0) return false
  // Only when the chars immediately before the cursor are spaces.
  const line = state.doc.sliceString(lineStart, from)
  const trail = line.length - line.trimEnd().length
  if (trail <= 0) return false
  if (trail % tw !== 0) return false
  const cutTo = from - tw
  view.dispatch({
    changes: { from: cutTo, to: from, insert: '' },
    selection: EditorSelection.cursor(cutTo),
  })
  return true
}

/** Tab: table navigation first, then indent. */
function tabAction(view, prefsRef) {
  if (tableNextCell(view)) return true
  return indentMore(view)
}

/** Shift+Tab: previous table cell, then outdent. */
function shiftTabAction(view, prefsRef) {
  if (tablePrevCell(view)) return true
  return indentLess(view)
}

function bold(view) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected) {
    view.dispatch({
      changes: { from, to, insert: `**${selected}**` },
      selection: EditorSelection.cursor(from + 2 + selected.length),
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: '****' },
      selection: EditorSelection.cursor(from + 2),
    })
  }
  return true
}

function italic(view) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected) {
    view.dispatch({
      changes: { from, to, insert: `*${selected}*` },
      selection: EditorSelection.cursor(from + 1 + selected.length),
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: '**' },
      selection: EditorSelection.cursor(from + 1),
    })
  }
  return true
}

function link(view) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected) {
    view.dispatch({
      changes: { from, to, insert: `[${selected}](url)` },
      selection: EditorSelection.cursor(from + selected.length + 3),
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: '[text](url)' },
      selection: EditorSelection.cursor(from + 1 + 4 + 1),
    })
  }
  return true
}

/**
 * Build the glean keymap. callbacks.openImage is invoked for Ctrl+Shift+I
 * so the shell can open its hidden file picker.
 */
export function gleanKeymaps(prefsRef, callbacks) {
  return keymap.of([
    { key: 'Backspace', run: (view) => smartBackspace(view, prefsRef) },
    { key: 'Tab', run: (view) => tabAction(view, prefsRef) },
    { key: 'Shift-Tab', run: (view) => shiftTabAction(view, prefsRef) },
    { key: 'Enter', run: tableEnter },
    { key: 'Mod-b', run: bold, preventDefault: true },
    { key: 'Mod-i', run: italic, preventDefault: true },
    { key: 'Mod-k', run: link, preventDefault: true },
    {
      key: 'Mod-Shift-i',
      run: () => { callbacks?.openImage?.(); return true },
      preventDefault: true,
    },
    { key: 'Mod-s', run: () => { callbacks?.save?.(); return true }, preventDefault: true },
    { key: 'Mod-f', run: () => { callbacks?.openFind?.(); return true }, preventDefault: true },
    { key: 'Mod-h', run: () => { callbacks?.openReplace?.(); return true }, preventDefault: true },
  ])
}