import { Plugin, PluginKey } from 'prosemirror-state'

// Selection wrapping for markdown pairs: with text selected, typing * _ ` ~ $
// or = wraps the selection in that pair and keeps the content selected, so
// layers stack (bold then italic) the way hybrid markdown editors do it.
// Typing the char when the selection is already exactly wrapped strips the
// pair instead. With no selection, a char squeezed against both sides of the
// caret dissolves, so leftover empty pairs clear on the first keystroke
export const wrapSelectionKey = new PluginKey('glean-wrap-selection')

const WRAPS = [
  { char: '*', open: '*', close: '*', blockWith: '**' },
  { char: '_', open: '_', close: '_', blockWith: '__' },
  { char: '`', open: '`', close: '`' },
  { char: '~', open: '~~', close: '~~' },
  { char: '$', open: '$', close: '$' },
  { char: '=', open: '==', close: '==' },
]

const ALL_CHARS = WRAPS.map((w) => w.char).join('')

function applyWrap(view, char, from, to) {
  const { state } = view
  const wrap = WRAPS.find((w) => w.char === char)
  if (!wrap) return false
  const $from = state.doc.resolve(from)
  if ($from.parent.type.spec.code) return false
  const docEnd = state.doc.content.size
  const before = state.doc.textBetween(Math.max(0, from - wrap.open.length), from)
  const after = state.doc.textBetween(to, Math.min(to + wrap.close.length, docEnd))
  const empty = from === to

  if (!empty) {
    const tr = state.tr
    if (before === wrap.open && after === wrap.close) {
      // already wrapped: Obsidian-style toggle. Only when the selection is
      // exactly the wrapped content, so partial ranges extend the layers
      const selText = state.doc.textBetween(from, to)
      if (selText && !selText.startsWith(wrap.open) && !selText.endsWith(wrap.close)) {
        tr.delete(to, to + wrap.close.length).delete(from - wrap.open.length, from)
        view.dispatch(tr.setSelection(
          state.selection.constructor.near(tr.doc.resolve(from - wrap.open.length)),
        ).scrollIntoView())
        return true
      }
    }
    tr.insertText(wrap.close, to, to).insertText(wrap.open, from, from)
    // keep the wrapped content selected so another wrap stacks a layer
    view.dispatch(tr.setSelection(
      state.selection.constructor.create(tr.doc, from + wrap.open.length, to + wrap.open.length),
    ).scrollIntoView())
    return true
  }

  if ($cursorless(state)) return false
  const { $cursor } = state.selection
  const inside = state.doc.textBetween(Math.max(0, $cursor.pos - 1), $cursor.pos)
  const ahead = state.doc.textBetween($cursor.pos, Math.min($cursor.pos + 1, docEnd))
  if (inside !== char || ahead !== char) return false
  view.dispatch(state.tr.delete($cursor.pos, $cursor.pos + 1).delete($cursor.pos - 1, $cursor.pos))
  return true
}

function $cursorless(state) {
  return !state.selection.$cursor
}

export const wrapSelection = () => new Plugin({
  key: wrapSelectionKey,
  props: {
    handleTextInput(view, from, to, text) {
      if (!ALL_CHARS.includes(text)) return false
      return applyWrap(view, text, from, to)
    },
  },
})
