import { TextSelection } from 'prosemirror-state'

const MAX_MATCHES = 2000

export function findMatches(doc, query, caseSensitive = false) {
  if (!query) return []
  const flags = caseSensitive ? 'g' : 'gi'
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, flags)
  const found = []
  doc.descendants((node, pos) => {
    if (found.length >= MAX_MATCHES) return false
    // containers must be descended into or their text is never reached
    if (!node.isText) return true
    regex.lastIndex = 0
    let m
    while ((m = regex.exec(node.text)) !== null) {
      found.push({ from: pos + m.index, to: pos + m.index + m[0].length })
      if (found.length >= MAX_MATCHES) break
      if (m[0].length === 0) regex.lastIndex++
    }
    return false
  })
  return found
}

export function selectMatch(view, match, { focus = true } = {}) {
  if (!view || !match) return
  const { state } = view
  view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, match.from, match.to)).scrollIntoView()
  )
  if (focus) view.focus()
}

export function replaceMatch(view, match, replacement) {
  if (!view || !match) return
  const tr = view.state.tr.insertText(replacement, match.from, match.to)
  tr.setSelection(TextSelection.create(tr.doc, match.from + replacement.length))
  view.dispatch(tr)
  view.focus()
}

// Matches are replaced from the last position backward in a single
// transaction: a change never shifts positions below it, so no mapping is
// needed and stale from/to coordinates stay valid
export function replaceAllMatches(view, matches, replacement) {
  if (!view || matches.length === 0) return 0
  const { state } = view
  let tr = state.tr
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    tr.insertText(replacement, m.from, m.to)
  }
  view.dispatch(tr)
  view.focus()
  return matches.length
}
