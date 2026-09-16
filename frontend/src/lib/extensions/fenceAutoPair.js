import { Plugin, PluginKey } from 'prosemirror-state'

// Typing ``` into an empty paragraph opens a fenced code block Obsidian-style:
// the caret lands inside the block ready for a language tag or code, and the
// closing fence is implicit (markdown serialization always writes one).
// Escape from the block's end exits to a paragraph after it
export const fenceAutoPairKey = new PluginKey('glean-fence-autopair')

const FENCE = '```'

function handleTextInput(view, from, to, text) {
  const { state } = view
  const $from = state.doc.resolve(from)
  if (to !== from || $from.parent.type.spec.code) return false
  if (state.doc.nodeAt(from - 1)?.type.name === 'code_block') return false
  // Browsers deliver one char per input event and may batch fast typing, so
  // the fence is matched by the text ending at the caret, never by the
  // event text alone
  const fenceStart = $from.parentOffset - (FENCE.length - text.length)
  if (fenceStart !== 0) return false
  const tail = $from.parent.textBetween(Math.max(0, fenceStart), $from.parentOffset) + text
  if (tail !== FENCE) return false
  // caret must end the paragraph, so the block replacement cannot swallow
  // trailing text; fenceStart === 0 above pins the fence to the start
  if ($from.parentOffset !== $from.parent.content.size) return false

  const codeBlock = state.schema.nodes.code_block.create({ language: '' })
  const para = state.schema.nodes.paragraph.create()
  const blockEnd = $from.after($from.depth)
  const tr = state.tr.replaceWith($from.before($from.depth), blockEnd, [codeBlock, para])
  // caret inside the code block, ready for a language tag or code
  tr.setSelection(state.selection.constructor.near(tr.doc.resolve($from.before($from.depth) + 1), -1))
  view.dispatch(tr.scrollIntoView())
  return true
}

// Escape pressed at a code block's end: exit into the paragraph after it
function handleKeyDown(view, event) {
  if (event.key !== 'Escape') return false
  const { state } = view
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'code_block') continue
    const after = $from.after(d)
    if (after >= state.doc.content.size) return false
    view.dispatch(state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(after + 1))))
    view.focus()
    return true
  }
  return false
}

// A leaf block at the end of the document is a caret dead end: ArrowDown
// and Escape have no destination below it and the closing fence is not real
// text to click. Milkdown's own fence input rule creates the block without
// a trailing node, so keep the invariant here: the doc never ends on one.
// The autopair path below still adds its own paragraph so its behavior is
// testable without appendTransaction
const DEAD_ENDS = ['code_block', 'horizontal_rule']

function appendExitNode(transactions, _oldState, newState) {
  if (!transactions.some((tr) => tr.docChanged)) return null
  const last = newState.doc.lastChild
  if (!last || !DEAD_ENDS.includes(last.type.name)) return null
  return newState.tr.insert(newState.doc.content.size, newState.schema.nodes.paragraph.create())
}

export const fenceAutoPair = () => new Plugin({
  key: fenceAutoPairKey,
  appendTransaction: appendExitNode,
  props: {
    handleTextInput,
    handleKeyDown,
  },
})
