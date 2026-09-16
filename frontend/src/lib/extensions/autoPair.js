import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'

// Auto-pairing for every markdown pair syntax glean renders, on bare
// keystrokes, no selection needed. One keystroke for chars that are never
// valid syntax alone (` $ ~ =), two consecutive keystrokes for * and _
// where the single char means emphasis (Milkdown's own input rule converts
// typed *text* literals). [[ completes to the starline pair on the second
// bracket, reusing a lone ] ahead as the close. Typing the closer skips
// over it, and completing a tracked pair with content converts the
// literals to the real schema mark, so files serialize true markdown
// instead of stray asterisks. [[ ]] and $ $ stay literal on purpose:
// starline has no schema node and math_inline is an atom that parsing
// creates on reload
export const autoPairKey = new PluginKey('glean-auto-pair')

const FENCE = '```'

const PAIRS = [
  { char: '`', open: '`', close: '`', markName: 'inlineCode', tier: 1 },
  { char: '$', open: '$', close: '$', markName: null, tier: 1 },
  { char: '~', open: '~~', close: '~~', markName: 'strike_through', tier: 1 },
  { char: '=', open: '==', close: '==', markName: null, tier: 1 },
  { char: '*', open: '**', close: '**', markName: 'strong', tier: 2 },
  { char: '_', open: '__', close: '__', markName: 'strong', tier: 2 },
  { char: '[', open: '[[', close: ']]', markName: null, tier: 2, literal: true },
]

const DISSOLVERS = [...PAIRS].sort((a, b) => b.open.length - a.open.length)
const WORD_CHAR = /[A-Za-z0-9]/

function snippet(doc, pos, len) {
  return doc.textBetween(Math.max(0, pos), Math.min(pos + len, doc.content.size))
}

// True when the tracked pair holds a non-empty run of its own char:
// typing the char again is extending a run (```, ~~~), not completing the
// pair. An empty interior must fall through so the overtype skip can
// punch past the closer, which is what keeps the ``` fence reachable
function isCharRun(doc, region, char) {
  const content = doc.textBetween(region.openEnd, region.closeStart)
  return content.length > 0 && content === char.repeat(content.length)
}

function handleFence(view, from, text) {
  const { state } = view
  const $from = state.doc.resolve(from)
  if ($from.parent.type.spec.code) return false
  const fenceStart = $from.parentOffset - (FENCE.length - text.length)
  if (fenceStart !== 0) return false
  const tail = $from.parent.textBetween(Math.max(0, fenceStart), $from.parentOffset) + text
  if (tail !== FENCE) return false
  if ($from.parentOffset !== $from.parent.content.size) return false

  const codeBlock = state.schema.nodes.code_block.create({ language: '' })
  const para = state.schema.nodes.paragraph.create()
  const blockEnd = $from.after($from.depth)
  const tr = state.tr.replaceWith($from.before($from.depth), blockEnd, [codeBlock, para])
  tr.setSelection(TextSelection.near(tr.doc.resolve($from.before($from.depth) + 1), -1))
  view.dispatch(tr.scrollIntoView())
  return true
}

function regionFor(pair, from, kind) {
  if (kind === 'inner') {
    // the open started at from-1; the typed char plus close follow
    return { openStart: from - 1, openEnd: from + 1, closeStart: from + 1, closeEnd: from + 1 + pair.close.length, pair }
  }
  return { openStart: from, openEnd: from + pair.open.length, closeStart: from + pair.open.length, closeEnd: from + pair.open.length + pair.close.length, pair }
}

function insertPair(view, state, pair, from, kind) {
  const tr = state.tr
  if (kind === 'grown') {
    tr.insertText(pair.char, from, from)
    tr.insertText(pair.close, from + 1, from + 1)
  } else if (kind === 'reuse') {
    // a lone ] ahead is the close's first half; add the typed [ and the
    // missing second ]
    tr.insertText(pair.char + pair.close.slice(-1), from, from)
  } else if (kind === 'literal') {
    // the existing [ is the open's first half; add the typed one plus the close
    tr.insertText(pair.char + pair.close, from, from)
  } else {
    tr.insertText(pair.open + pair.close, from, from)
  }
  // every kind but fresh puts the caret right after the open's first half
  const caret = kind === 'fresh' ? from + pair.open.length : from + 1
  tr.setSelection(TextSelection.create(tr.doc, caret))
  tr.setMeta(autoPairKey, { region: regionFor(pair, from, kind === 'fresh' ? 'fresh' : 'inner') })
  view.dispatch(tr.scrollIntoView())
  return true
}

// Strip the tracked pair and mark the content, so `x` becomes real
// inlineCode and **x** real strong
function convertRegion(state, region) {
  const tr = state.tr
  if (region.pair.markName && region.closeStart - region.openEnd > 0) {
    tr.addMark(region.openEnd, region.closeStart, state.schema.marks[region.pair.markName].create())
  }
  tr.delete(region.closeStart, region.closeEnd)
  tr.delete(region.openStart, region.openEnd)
  return tr
}

function handleTextInput(view, from, to, text) {
  const { state } = view
  if (to !== from) return false
  if (handleFence(view, from, text)) return true

  const $from = state.doc.resolve(from)
  const doc = state.doc
  if ($from.parent.type.spec.code) return false
  const ahead = snippet(doc, from, 2)
  const before = snippet(doc, from - 1, 1)
  const pair = PAIRS.find((p) => p.char === text)
  const region = autoPairKey.getState(state)

  // typing the pair char while the tracked pair holds only a run of that
  // char extends the run (```, ~~~, ***); the fence trigger above catches
  // the third backtick
  if (region && text === region.pair.char && isCharRun(doc, region, region.pair.char)) return false

  // overtype: the closer (or its first char) is directly ahead, skip over
  // it instead of doubling. Completing a tracked pair with content
  // converts it to its mark in the same stroke
  if (ahead.startsWith(text) && PAIRS.some((p) => p.close.startsWith(text))) {
    if (region && from === region.closeStart && region.pair.close.startsWith(text)) {
      const interior = region.closeStart - region.openEnd
      if (region.pair.markName && interior > 0 && !isCharRun(doc, region, region.pair.char)) {
        const tr = convertRegion(state, region)
        tr.setSelection(TextSelection.create(tr.doc, region.openStart + interior))
        view.dispatch(tr.scrollIntoView())
        return true
      }
      // multi-char close: skipping one char would strand the caret inside
      // the closer, so the run extends instead. Single-char closes skip
      // through, which is what keeps the ``` fence trigger reachable
      if (region.pair.char === text && region.pair.close.length > 1) return false
    }
    view.dispatch(state.tr.setSelection(TextSelection.create(doc, from + text.length)).scrollIntoView())
    return true
  }
  if (!pair) return false
  if (ahead.length && WORD_CHAR.test(ahead[0])) return false

  if (pair.literal) {
    if (before !== pair.char) return false
    // reuse a lone ] ahead as the close's first half; a full ]] means the
    // pair is already open
    if (ahead.startsWith(']]')) return false
    return insertPair(view, state, pair, from, ahead.startsWith(']') ? 'reuse' : 'literal')
  }
  if (before === pair.char) {
    // tier 1 chars never pair against themselves (typing $$ or ~~~ stays
    // literal); tier 2 grows the run into the strong pair on this stroke
    if (pair.tier === 1) return false
    if (snippet(doc, from - 2, 1) === pair.char) return false
    return insertPair(view, state, pair, from, 'grown')
  }
  if (pair.tier === 2) return false
  return insertPair(view, state, pair, from, 'fresh')
}

// Backspace inside an empty pair deletes both halves
function handleKeyDown(view, event) {
  if (event.key === 'Escape') return exitFence(view)
  if (event.key !== 'Backspace') return false
  const { state } = view
  if (!state.selection.empty) return false
  const pos = state.selection.from
  if (state.doc.resolve(pos).parent.type.spec.code) return false
  for (const pair of DISSOLVERS) {
    if (snippet(state.doc, pos - pair.open.length, pair.open.length) === pair.open
      && snippet(state.doc, pos, pair.close.length) === pair.close) {
      view.dispatch(state.tr.delete(pos - pair.open.length, pos + pair.close.length))
      return true
    }
  }
  return false
}

// Escape pressed at a code block's end: exit into the paragraph after it
function exitFence(view) {
  const { state } = view
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'code_block') continue
    const after = $from.after(d)
    if (after >= state.doc.content.size) return false
    view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(after + 1))))
    view.focus()
    return true
  }
  return false
}

// A leaf block at the end of the document is a caret dead end: ArrowDown
// and Escape have no destination below it and the closing fence is not real
// text to click. Milkdown's own fence input rule creates the block without
// a trailing node, so keep the invariant here: the doc never ends on one
const DEAD_ENDS = ['code_block', 'horizontal_rule']

function mapRegion(tr, region) {
  const m = tr.mapping
  // open boundaries stay tight to the left of insertions, close boundaries
  // to the right, so text typed inside shifts only the close side
  return {
    ...region,
    openStart: m.map(region.openStart, -1),
    openEnd: m.map(region.openEnd, -1),
    closeStart: m.map(region.closeStart, 1),
    closeEnd: m.map(region.closeEnd, 1),
  }
}

// A pure caret move out of a tracked literal pair converts it to its mark.
// Doc changes keep the region mapped instead, so typing inside never
// cancels a pending pair
function appendTransactions(trs, oldState, newState) {
  const moved = !oldState.selection.eq(newState.selection)
    && trs.every((tr) => !tr.docChanged)
  if (moved) {
    const region = autoPairKey.getState(newState)
    if (region && region.pair.markName && region.closeStart - region.openEnd > 0) {
      const head = newState.selection.head
      if (head < region.openStart || head >= region.closeEnd) {
        const mark = newState.schema.marks[region.pair.markName]
        if (mark && !newState.doc.resolve(head).parent.type.spec.code) {
          const tr = convertRegion(newState, region)
          tr.setMeta(autoPairKey, { region: null })
          return tr
        }
      }
    }
  }
  const last = newState.doc.lastChild
  if (trs.some((tr) => tr.docChanged) && last && DEAD_ENDS.includes(last.type.name)) {
    return newState.tr.insert(newState.doc.content.size, newState.schema.nodes.paragraph.create())
  }
  return null
}

export const autoPair = () => new Plugin({
  key: autoPairKey,
  state: {
    init: () => null,
    apply(tr, region) {
      const meta = tr.getMeta(autoPairKey)
      if (meta) return meta.region || null
      if (tr.selection?.$from?.parent.type.spec.code) return null
      if (tr.docChanged) {
        if (!region) return null
        const mapped = mapRegion(tr, region)
        if (mapped.closeStart <= mapped.openEnd) return null
        return mapped
      }
      return region
    },
  },
  appendTransaction: appendTransactions,
  props: {
    handleTextInput,
    handleKeyDown,
  },
})
