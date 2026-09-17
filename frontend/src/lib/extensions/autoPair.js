import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'

// Auto-pairing for the markdown pair syntax glean renders, on bare
// keystrokes, no selection needed. Pair chars are intercepted in
// handleKeyDown with preventDefault, so the browser never inserts them and
// every decision runs on the pre-insert doc: Chromium inserts shifted
// characters through a composition path that cannot be prevented, so a
// handleTextInput-based plugin only ever saw part of the input and fought
// the browser over the caret. One keystroke for chars that are never valid
// syntax alone ($ ~ =), two consecutive keystrokes for * and _ where the
// single char means emphasis (Milkdown's own input rules convert typed
// *text* and _x_ literals). [[ completes to the starline pair on the second
// bracket. Typing a close char skips over the tracked close instead of
// doubling; when the pair holds content and a mark, the skip converts the
// literals to the real schema mark on the caret exit. Backtick is not a
// pair: it conflicts with the ``` fence and Milkdown converts `x` natively.
// [[ ]] and $ $ stay literal on purpose: starline has no schema node and
// math_inline is an atom that parsing creates on reload
export const autoPairKey = new PluginKey('glean-auto-pair')

const FENCE = '```'

const PAIRS = [
  { char: '$', open: '$', close: '$', markName: null, tier: 1 },
  { char: '~', open: '~~', close: '~~', markName: 'strike_through', tier: 1 },
  { char: '=', open: '==', close: '==', markName: 'glean_highlight', tier: 1 },
  { char: '*', open: '**', close: '**', markName: 'strong', tier: 2 },
  { char: '_', open: '__', close: '__', markName: 'strong', tier: 2 },
  { char: '[', open: '[[', close: ']]', markName: null, tier: 2, literal: true },
]

const DISSOLVERS = [...PAIRS].sort((a, b) => b.open.length - a.open.length)
const WORD_CHAR = /[A-Za-z0-9]/

function snippet(doc, pos, len) {
  return doc.textBetween(Math.max(0, pos), Math.min(pos + len, doc.content.size))
}

// True when the content between the open and the close is a non-empty run
// of the pair's own char: the keystroke extends the run (***, ~~~) and must
// flow through normally instead of interacting with the close
function isCharRun(doc, region) {
  const mid = snippet(doc, region.openEnd, region.closeStart - region.openEnd)
  return mid.length > 0 && mid === region.pair.char.repeat(mid.length)
}

// Strip a completed pair and mark its content, so **x** becomes real strong
// Deletes run before the addMark on purpose: Milkdown's hardbreak plugin
// reads the first step's bounds against the final doc, so an AddMarkStep
// holding pre-delete positions crashes the whole dispatch
function convertRegion(state, region) {
  const tr = state.tr
  const interior = region.closeStart - region.openEnd
  tr.delete(region.closeStart, region.closeEnd)
  tr.delete(region.openStart, region.openEnd)
  if (region.pair.markName && interior > 0) {
    tr.addMark(region.openStart, region.openStart + interior, state.schema.marks[region.pair.markName].create())
  }
  return tr
}

// Decide what a pair-char keystroke means on the pre-insert doc. Returns
// { tr, session } to intercept the key, or null to let it flow normally
function decide(state, session, key) {
  const doc = state.doc
  const pos = state.selection.from
  const caret = doc.resolve(pos)
  if (!caret.parent.type.spec.code) {
    const region = session?.region

    // remaining close chars after a conversion are swallowed, so the user
    // can finish typing ~~ without re-pairing after the marked text
    if (session?.absorb && pos === session.absorb.pos && key === session.absorb.char) {
      const tr = state.tr.setSelection(TextSelection.create(doc, pos))
      const count = session.absorb.count - 1
      const next = count > 0 ? { ...session, absorb: { ...session.absorb, count } } : null
      tr.setMeta(autoPairKey, { session: next })
      return { tr }
    }

    if (region && key === region.pair.close[0] && pos >= region.closeStart && pos < region.closeEnd) {
      if (pos === region.closeStart && isCharRun(doc, region)) return null
      const mid = snippet(doc, region.openEnd, region.closeStart - region.openEnd)
      // real content and a mark: complete the pair now, swallow the rest
      // of the close on the following keystrokes
      if (pos === region.closeStart && mid.length > 0 && region.pair.markName) {
        const tr = convertRegion(state, region)
        const caretPos = region.openStart + mid.length
        tr.setSelection(TextSelection.create(tr.doc, caretPos))
        tr.setMeta(autoPairKey, {
          session: { region: null, absorb: { count: region.pair.close.length - 1, pos: caretPos, char: key } },
        })
        return { tr }
      }
      // empty interior or markless pair: skip over the whole close in one
      // keystroke, the caret exit drops or converts the region
      const tr = state.tr.setSelection(TextSelection.create(doc, region.closeEnd))
      tr.setMeta(autoPairKey, { session })
      return { tr }
    }

    const pair = PAIRS.find((p) => p.char === key)
    if (pair) {
      const ahead = snippet(doc, pos, 2)
      const before = pos > 0 ? snippet(doc, pos - 1, 1) : ''
      if (!ahead.length || !WORD_CHAR.test(ahead[0])) {
        if (pair.literal) {
          if (before === pair.char && !ahead.startsWith(']]')) {
            // the typed [ must land too, or the open never completes
            const closeText = ahead.startsWith(']') ? pair.close.slice(-1) : pair.close
            const tr = state.tr.insertText('[' + closeText, pos)
            tr.setSelection(TextSelection.create(tr.doc, pos + 1))
            const next = {
              region: { openStart: pos - 1, openEnd: pos + 1, closeStart: pos + 1, closeEnd: pos + 1 + closeText.length, pair },
              absorb: null,
            }
            tr.setMeta(autoPairKey, { session: next })
            return { tr }
          }
        } else if (before === pair.char) {
          if (pair.tier === 1) return null
          const prev = pos > 1 ? snippet(doc, pos - 2, 1) : ''
          if (prev !== pair.char) {
            // tier 2: the typed char lands first, the close is added after
            const tr = state.tr.insertText(pair.char + pair.close, pos)
            tr.setSelection(TextSelection.create(tr.doc, pos + 1))
            const next = {
              region: { openStart: pos - 1, openEnd: pos + 1, closeStart: pos + 1, closeEnd: pos + 1 + pair.close.length, pair },
              absorb: null,
            }
            tr.setMeta(autoPairKey, { session: next })
            return { tr }
          }
        } else if (pair.tier === 1) {
          // fresh pair: the typed char is part of the open
          const tr = state.tr.insertText(pair.open + pair.close, pos)
          tr.setSelection(TextSelection.create(tr.doc, pos + pair.open.length))
          const next = {
            region: {
              openStart: pos,
              openEnd: pos + pair.open.length,
              closeStart: pos + pair.open.length,
              closeEnd: pos + pair.open.length + pair.close.length,
              pair,
            },
            absorb: null,
          }
          tr.setMeta(autoPairKey, { session: next })
          return { tr }
        }
      }
    }
  }
  return null
}

// Enter inside a code block: after code it inserts a newline like any
// editor, but on an empty line it exits into the paragraph below. Without
// this the caret can never leave the block using only Enter, which is the
// muscle memory every markdown editor trains
function enterInCode(view) {
  const { state } = view
  if (!state.selection.empty) return false
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'code_block') continue
    const before = $from.parent.textBetween(0, $from.parentOffset)
    if (before && !before.endsWith('\n')) return false
    const after = $from.after(d)
    const tr = state.tr
    const next = after >= state.doc.content.size ? null : state.doc.nodeAt(after)
    if (!next || next.type.name !== 'paragraph') tr.insert(after, state.schema.nodes.paragraph.create())
    view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1))))
    view.focus()
    return true
  }
  return false
}

// Backspace inside an empty pair deletes both halves. Backspace on a
// selected html chip dissolves it into its literal tag text instead of
// deleting the node, so a half-deleted pair leaves recoverable raw syntax
// rather than an orphaned chip
function handleKeyDown(view, event) {
  if (event.key === 'Escape') return exitFence(view)
  if (event.key === 'Enter' && !event.shiftKey && enterInCode(view)) return true
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.key.length === 1) {
    const out = decide(view.state, autoPairKey.getState(view.state), event.key)
    if (out) {
      view.dispatch(out.tr.scrollIntoView())
      return true
    }
    return false
  }
  if (event.key !== 'Backspace') return false
  const { state } = view
  const { selection } = state
  if (selection.node?.type?.name === 'html') {
    const value = selection.node.attrs.value || ''
    view.dispatch(state.tr.replaceSelectionWith(state.schema.text(value)).scrollIntoView())
    view.focus()
    return true
  }
  if (!selection.empty) return false
  const pos = selection.from
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
  // inner boundaries move with insertions so text typed inside shifts the
  // sides outward (openEnd -1, closeStart +1); outer boundaries hold (typing
  // before the open or after the close keeps the region tracked)
  return {
    ...region,
    openStart: m.map(region.openStart, 1),
    openEnd: m.map(region.openEnd, -1),
    closeStart: m.map(region.closeStart, 1),
    closeEnd: m.map(region.closeEnd, -1),
  }
}

function appendTransactions(trs, oldState, newState) {
  if (trs.some((tr) => tr.getMeta(autoPairKey))) return null

  if (trs.some((tr) => tr.docChanged)) {
    // a paragraph whose entire content is ``` becomes a code block, whether
    // the backticks came from normal typing, paste, or IME input
    const fenceNode = findFence(newState.doc)
    if (fenceNode) {
      const tr = newState.tr
      const after = fenceNode.pos + fenceNode.node.nodeSize
      const nodes = [newState.schema.nodes.code_block.create({ language: '' })]
      const next = newState.doc.nodeAt(after)
      if (!next || next.type.name !== 'paragraph') nodes.push(newState.schema.nodes.paragraph.create())
      tr.replaceWith(fenceNode.pos, after, nodes)
      tr.setSelection(TextSelection.near(tr.doc.resolve(fenceNode.pos + 1), -1))
      tr.setMeta(autoPairKey, {})
      return tr.scrollIntoView()
    }
    const last = newState.doc.lastChild
    if (last && DEAD_ENDS.includes(last.type.name)) {
      const t = newState.tr.insert(newState.doc.content.size, newState.schema.nodes.paragraph.create())
      t.setMeta(autoPairKey, {})
      return t
    }
    return null
  }

  // a caret move out of a tracked literal pair converts it to its mark.
  // Doc changes keep the region mapped instead, so typing inside never
  // cancels a pending pair
  const session = autoPairKey.getState(newState)
  const region = session?.region
  if (!region || !region.pair.markName) return null
  if (oldState.selection.eq(newState.selection)) return null
  if (region.closeStart - region.openEnd <= 0) return null
  const head = newState.selection.head
  if (head >= region.openStart && head < region.closeEnd) return null
  const mark = newState.schema.marks[region.pair.markName]
  if (!mark || newState.doc.resolve(head).parent.type.spec.code) return null
  const tr = convertRegion(newState, region)
  tr.setMeta(autoPairKey, {})
  return tr
}

function findFence(doc) {
  let found = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'paragraph' && node.textContent === FENCE) {
      found = { node, pos }
      return false
    }
    return true
  })
  return found
}

export const autoPair = () => new Plugin({
  key: autoPairKey,
  state: {
    init: () => null,
    apply(tr, session) {
      const meta = tr.getMeta(autoPairKey)
      if (meta) return meta.session !== undefined ? meta.session : session
      if (tr.selection?.$from?.parent.type.spec.code) return null
      if (tr.docChanged) {
        if (!session?.region) return session
        const mapped = mapRegion(tr, session.region)
        if (mapped.closeStart <= mapped.openEnd) return null
        // the region is only real if the doc still holds the literal pair
        // text at the mapped bounds; anything else (a clear-all, a foreign
        // input rule, a note switch) must drop the tracking, or the next
        // keystrokes interact with a phantom pair
        if (tr.doc.textBetween(mapped.openStart, mapped.openEnd) !== session.region.pair.open) return null
        if (tr.doc.textBetween(mapped.closeStart, mapped.closeEnd) !== session.region.pair.close) return null
        return { ...session, region: mapped }
      }
      return session
    },
  },
  appendTransaction: appendTransactions,
  props: {
    handleKeyDown,
  },
})
