import { Plugin, PluginKey } from 'prosemirror-state'

// Heading syntax is live, not just a revealed decoration: typing # at a
// heading's first character bumps its level (capped at 6), Backspace at the
// start demotes one level and drops a level-1 heading back to a paragraph.
// This is the editable path behind the revealed ## prefix, mirroring how
// hybrid markdown editors let the fence itself do the work
export const headingEditKey = new PluginKey('glean-heading-edit')

function bumpLevel(view, from) {
  const { state } = view
  const $from = state.doc.resolve(from)
  const parent = $from.parent
  if (parent.type.name !== 'heading' || $from.parentOffset !== 0) return false
  const level = parent.attrs.level ?? 1
  if (level >= 6) return false
  const pos = $from.before($from.depth)
  view.dispatch(state.tr.setNodeMarkup(pos, null, { ...parent.attrs, level: level + 1 }).scrollIntoView())
  return true
}

function demote(view) {
  const { state } = view
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset !== 0) return false
  const parent = $from.parent
  if (parent.type.name !== 'heading') return false
  const pos = $from.before($from.depth)
  const level = parent.attrs.level ?? 1
  const tr = state.tr
  if (level > 1) tr.setNodeMarkup(pos, null, { ...parent.attrs, level: level - 1 })
  else tr.setNodeMarkup(pos, state.schema.nodes.paragraph, null)
  view.dispatch(tr.scrollIntoView())
  return true
}

export const headingEdit = () => new Plugin({
  key: headingEditKey,
  props: {
    handleTextInput(view, from, to, text) {
      if (text !== '#' || to !== from) return false
      return bumpLevel(view, from)
    },
    handleKeyDown(view, event) {
      if (event.key !== 'Backspace') return false
      return demote(view)
    },
  },
})
