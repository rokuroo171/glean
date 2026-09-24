import { EditorSelection } from '@codemirror/state'
import { syntaxTree, indentUnit } from '@codemirror/language'
import { indentMore, indentLess } from '@codemirror/commands'

// The typing layer over the raw buffer: markdown pair behavior, heading
// level editing, and indentation. In CM6 the text is the syntax, so these
// handlers only rearrange characters; nothing converts literals into
// schema nodes the way the PM stack had to.
//
// Pair contract (ported from the PM autoPair, its session state machine
// replaced by a stateless parity rule):
// - tier 1 (backtick): fresh keystroke pairs immediately, typing inside a
//   line with an odd count of single ticks closes or skips over, a run of
//   2+ flows literally so ``` still builds the fence
// - tier 2 (* _ ~ [): the first keystroke is literal, the second completes
//   the doubled pair with the caret inside, and typing the pair char while
//   an unclosed doubled run sits earlier on the line closes the span
//   (parity of exactly-sized runs, so H~2~O's single tildes never count)
// - a non-empty selection wraps in the pair and stays selected, so the
//   same keystroke wraps again: ** builds from two *
// - Backspace between an open and close deletes both halves

const PAIRS = [
  { char: '`', open: '`', close: '`', tier: 1 },
  { char: '*', open: '**', close: '**', tier: 2 },
  { char: '_', open: '__', close: '__', tier: 2 },
  { char: '~', open: '~~', close: '~~', tier: 2 },
  { char: '[', open: '[[', close: ']]', tier: 2 },
]

const WORD = /[A-Za-z0-9]/

function charAt(doc, pos) {
  return doc.sliceString(pos, pos + 1)
}

function runBehind(doc, pos, ch) {
  let n = 0
  while (pos - n > 0 && charAt(doc, pos - n - 1) === ch) n++
  return n
}

function runAhead(doc, pos, ch) {
  let n = 0
  while (pos + n < doc.length && charAt(doc, pos + n) === ch) n++
  return n
}

// runs of exactly `len` copies of ch in one line of text
function exactRuns(text, ch, len) {
  const runs = []
  let i = 0
  while (i < text.length) {
    if (text[i] === ch) {
      let j = i
      while (j < text.length && text[j] === ch) j++
      if (j - i === len) runs.push([i, j])
      i = j
    } else {
      i++
    }
  }
  return runs
}

// True when the line prefix before the caret ends inside an open span:
// an odd count of exactly-sized runs. Single tildes in H~2~O are runs of
// the wrong size and never count, so subscript text stays literal
function insideOpen(prefix, ch, len) {
  return exactRuns(prefix, ch, len).length % 2 === 1
}

function inCode(state, pos) {
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'CodeText' || node.name === 'InlineCode') return true
    node = node.parent
  }
  return false
}

export function handlePairChar(view, ch) {
  const pair = PAIRS.find((p) => p.char === ch)
  if (!pair) return false
  const { state } = view
  const sel = state.selection.main
  const doc = state.doc

  if (!sel.empty) {
    const [open, close] = pair.char === '[' ? ['[[', ']]'] : [pair.char, pair.char]
    view.dispatch({
      changes: [
        { from: sel.from, insert: open },
        { from: sel.to, insert: close },
      ],
      selection: { anchor: sel.from + open.length, head: sel.to + open.length },
      scrollIntoView: true,
      userEvent: 'input',
    })
    return true
  }

  const pos = sel.head
  const line = doc.lineAt(pos)
  const prefix = doc.sliceString(line.from, pos)
  const ahead = runAhead(doc, pos, pair.char)
  const closeLen = pair.close.length
  const closeAhead = exactRuns(doc.sliceString(pos, line.to), pair.char, closeLen).length > 0 && ahead >= closeLen

  // inside an open span: the keystroke skips over the close run when one
  // sits ahead, otherwise it completes the pair. Closing works inside
  // inline code too, which is how `spans` finish
  if (insideOpen(prefix, pair.char, pair.open.length)) {
    if (closeAhead) {
      view.dispatch({ selection: EditorSelection.cursor(pos + ahead), scrollIntoView: true })
    } else {
      view.dispatch({
        changes: [{ from: pos, insert: pair.close }],
        selection: EditorSelection.cursor(pos + closeLen),
        scrollIntoView: true,
        userEvent: 'input',
      })
    }
    return true
  }

  if (inCode(state, pos)) return false

  const behind = runBehind(doc, pos, pair.char)
  const next = charAt(doc, pos)

  // tier 2 second keystroke completes the doubled pair
  if (pair.tier === 2 && behind === 1 && !WORD.test(next)) {
    view.dispatch({
      changes: [{ from: pos, insert: pair.char + pair.close }],
      selection: EditorSelection.cursor(pos + 1),
      scrollIntoView: true,
      userEvent: 'input',
    })
    return true
  }

  // tier 1: a run of 2+ flows literally so ``` builds a fence
  if (pair.tier === 1 && behind >= 2) return false

  // tier 1 fresh keystroke pairs immediately
  if (pair.tier === 1 && behind === 0 && !WORD.test(next)) {
    view.dispatch({
      changes: [{ from: pos, insert: pair.open + pair.close }],
      selection: EditorSelection.cursor(pos + 1),
      scrollIntoView: true,
      userEvent: 'input',
    })
    return true
  }

  return false
}

export function handlePairBackspace(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const doc = state.doc
  const pos = sel.head
  for (const p of PAIRS) {
    if (pos >= p.open.length && doc.length - pos >= p.close.length
      && doc.sliceString(pos - p.open.length, pos) === p.open
      && doc.sliceString(pos, pos + p.close.length) === p.close) {
      view.dispatch({
        changes: { from: pos - p.open.length, to: pos + p.close.length },
        scrollIntoView: true,
        userEvent: 'delete',
      })
      return true
    }
  }
  return false
}

const HASH_LINE = /^(#{1,6})( |$)/

export function handleHeadingHash(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  const m = HASH_LINE.exec(line.text)
  if (!m || inCode(state, sel.head)) return false
  const afterMark = line.from + m[1].length + (m[2] ? 1 : 0)
  // the caret must sit right after the mark: typing # inside the heading
  // text is content, not a level change
  if (sel.head !== afterMark) return false
  view.dispatch({
    changes: [{ from: line.from, insert: '#' }],
    selection: EditorSelection.cursor(sel.head + 1),
    scrollIntoView: true,
    userEvent: 'input',
  })
  return true
}

export function handleHeadingBackspace(view) {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  const m = HASH_LINE.exec(line.text)
  if (!m || inCode(state, sel.head)) return false
  const textStart = line.from + m[1].length + (m[2] ? 1 : 0)
  if (sel.head !== textStart) return false
  if (m[1].length > 1) {
    view.dispatch({
      changes: { from: line.from, to: line.from + 1 },
      selection: EditorSelection.cursor(sel.head - 1),
      scrollIntoView: true,
      userEvent: 'delete',
    })
  } else {
    view.dispatch({
      changes: { from: line.from, to: textStart },
      selection: EditorSelection.cursor(line.from),
      scrollIntoView: true,
      userEvent: 'delete',
    })
  }
  return true
}

function pairOrHeadingBackspace(view) {
  return handlePairBackspace(view) || handleHeadingBackspace(view)
}

// wrap or unwrap the selection in a marker pair; unwrap removes the pair
// when the selection is already inside one (toggle contract)
function toggleWrap(view, open, close) {
  const { state } = view
  const sel = state.selection.main
  const doc = state.doc
  const before = doc.sliceString(Math.max(0, sel.from - open.length), sel.from)
  const after = doc.sliceString(sel.to, Math.min(doc.length, sel.to + close.length))
  if (sel.from >= open.length && before === open && after === close) {
    view.dispatch({
      changes: [
        { from: sel.from - open.length, to: sel.from },
        { from: sel.to, to: sel.to + close.length },
      ],
      selection: { anchor: sel.from - open.length, head: sel.to - open.length },
      userEvent: 'input',
    })
    return true
  }
  view.dispatch({
    changes: [
      { from: sel.from, insert: open },
      { from: sel.to, insert: close },
    ],
    selection: { anchor: sel.from + open.length, head: sel.to + open.length },
    userEvent: 'input',
  })
  return true
}

function toggleLinePrefix(view, prefix, exclusive) {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  let last = state.doc.lineAt(range.to).number
  // a selection ending exactly at a line boundary does not reach into the
  // next line, so an empty trailing line is left alone
  if (last > first) {
    const endLine = state.doc.line(last)
    if (range.to === endLine.from && endLine.text === '') last -= 1
  }
  const allHave = []
  for (let n = first; n <= last; n++) {
    const line = state.doc.line(n)
    allHave.push(line.text.startsWith(prefix) || (exclusive && HASH_LINE.test(line.text) && line.text.startsWith(prefix.replace(/ $/, ''))))
  }
  const remove = exclusive ? allHave.every(Boolean) : allHave.every((h) => h)
  const changes = []
  for (let n = first; n <= last; n++) {
    const line = state.doc.line(n)
    if (remove) {
      if (line.text.startsWith(prefix)) changes.push({ from: line.from, to: line.from + prefix.length })
    } else if (!line.text.startsWith(prefix)) {
      changes.push({ from: line.from, insert: prefix })
    }
  }
  if (changes.length === 0) return false
  view.dispatch({ changes, userEvent: 'input' })
  return true
}

// Ctrl+B/I and friends: markdown toggles over the buffer, matching the
// toolbar contract. Everything is plain text insertion so saves stay exact
export const modKeymap = [
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**', '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*', '*') },
]

export function formatToggle(view, kind, level = 1) {
  switch (kind) {
    case 'bold': return toggleWrap(view, '**', '**')
    case 'italic': return toggleWrap(view, '*', '*')
    case 'strike': return toggleWrap(view, '~~', '~~')
    case 'code': return toggleWrap(view, '`', '`')
    case 'quote': return toggleLinePrefix(view, '> ', false)
    case 'bullet': return toggleLinePrefix(view, '- ', false)
    case 'ordered': {
      const { state } = view
      const range = state.selection.main
      const first = state.doc.lineAt(range.from).number
      const last = state.doc.lineAt(range.to).number
      const lines = []
      for (let n = first; n <= last; n++) lines.push(state.doc.line(n))
      const allNumbered = lines.every((l) => /^\d+\. /.test(l.text))
      const changes = []
      lines.forEach((line, i) => {
        if (allNumbered) {
          const m = /^\d+\. /.exec(line.text)
          changes.push({ from: line.from, to: line.from + m[0].length })
        } else if (!/^\d+\. /.test(line.text)) {
          changes.push({ from: line.from, insert: `${i + 1}. ` })
        }
      })
      if (changes.length === 0) return false
      view.dispatch({ changes, userEvent: 'input' })
      return true
    }
    case 'heading': {
      const { state } = view
      const line = state.doc.lineAt(state.selection.main.head)
      const m = /^(#{1,6}) /.exec(line.text)
      if (level === 0) {
        // body text: strip the marker entirely
        if (!m) return false
        view.dispatch({
          changes: { from: line.from, to: line.from + m[0].length },
          selection: { anchor: line.from },
          userEvent: 'input',
        })
        return true
      }
      const insert = '#'.repeat(level) + ' '
      view.dispatch({
        changes: m ? [{ from: line.from, to: line.from + m[0].length, insert }] : [{ from: line.from, insert }],
        selection: { anchor: line.from + insert.length },
        userEvent: 'input',
      })
      return true
    }
    case 'codeblock': {
      const { state } = view
      const sel = state.selection.main
      if (!sel.empty) {
        // wrap the selected lines in a fence instead of replacing them
        const first = state.doc.lineAt(sel.from)
        const last = state.doc.lineAt(sel.to)
        const body = state.sliceDoc(first.from, last.to)
        view.dispatch({
          changes: { from: first.from, to: last.to, insert: '```\n' + body + '\n```' },
          selection: { anchor: first.from + 3 },
          userEvent: 'input',
        })
        return true
      }
      const line = state.doc.lineAt(sel.head)
      view.dispatch({
        changes: { from: line.from, insert: '```\n\n```\n' },
        selection: { anchor: line.from + 4 },
        userEvent: 'input',
      })
      return true
    }
    case 'hr': {
      const { state } = view
      const line = state.doc.lineAt(state.selection.main.head)
      view.dispatch({
        changes: { from: line.from, insert: '---\n' },
        userEvent: 'input',
      })
      return true
    }
    default: return false
  }
}

export const gleanKeymap = [
  { key: '#', run: handleHeadingHash },
  { key: '*', run: (v) => handlePairChar(v, '*') },
  { key: '_', run: (v) => handlePairChar(v, '_') },
  { key: '~', run: (v) => handlePairChar(v, '~') },
  { key: '[', run: (v) => handlePairChar(v, '[') },
  { key: '`', run: (v) => handlePairChar(v, '`') },
  { key: 'Backspace', run: pairOrHeadingBackspace },
  { key: 'Tab', run: indentMore },
  { key: 'Shift-Tab', run: indentLess },
]

// two spaces, the markdown nesting step; a 2-space indent on a plain
// paragraph is a lazy continuation, not an indented code block
export const gleanIndentUnit = indentUnit.of('  ')
