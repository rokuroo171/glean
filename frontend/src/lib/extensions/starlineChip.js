import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

// Starlines render as clickable chips, Obsidian-style: away from the caret
// the [[ ]] glyphs are hidden and the title is styled as a chip, so it reads
// and navigates like an atomic link while the text underneath stays real
// (no replaced ranges, no caret mapping hazards); move the caret into the
// range and the raw brackets return dim for editing. A click on the chip
// opens the target note through the same handleNoteLink path the picker and
// preview use
export const starlineChipKey = new PluginKey('glean-starline-chip')

const STARLINE = /\[\[([^\[\]\n]+)\]\]/g

// Atom inline nodes (math, images) shift positions away from textContent
// offsets, which would misplace every chip after one; skip those paragraphs
function hasAtomInlines(paragraph) {
  let atom = false
  paragraph.forEach((child) => {
    if (child.isLeaf && !child.isText) atom = true
  })
  return atom
}

function decorationsFor(state, refs) {
  const head = state.selection ? (state.selection.head ?? state.selection.from) : null
  if (head == null || !refs.onNoteLinkRef.current) return DecorationSet.empty
  const noteNames = refs.noteNamesRef.current || {}

  const decos = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph' || hasAtomInlines(node)) return
    const base = pos + 1
    const text = node.textContent
    STARLINE.lastIndex = 0
    for (let m; (m = STARLINE.exec(text)); ) {
      const openStart = base + m.index
      const closeEnd = openStart + m[0].length
      // strict interior: the caret sitting on a bracket edge (right after
      // the closing ]] from typing, right before the open from arrowing)
      // shows the chip; only a caret between the brackets reveals the raw
      if (head > openStart && head < closeEnd) {
        decos.push(Decoration.inline(openStart, openStart + 2, { class: 'glean-starline-raw' }))
        decos.push(Decoration.inline(closeEnd - 2, closeEnd, { class: 'glean-starline-raw' }))
      } else {
        const exists = noteNames[m[1]] != null
        // opacity (not display or visibility) is the only hide that keeps
        // both the glyphs' layout width and Chromium caret navigability:
        // the browser's caret motion must reach past the close for the chip
        // to show again; the other hides make End stop short of the hidden
        // brackets and pin the caret in the reveal range forever
        decos.push(Decoration.inline(openStart, openStart + 2, { style: 'opacity:0' }))
        decos.push(Decoration.inline(closeEnd - 2, closeEnd, { style: 'opacity:0' }))
        decos.push(Decoration.inline(openStart + 2, closeEnd - 2, {
          class: `glean-starline${exists ? '' : ' missing'}`,
          title: exists ? `Open ${m[1]}` : `Create ${m[1]}`,
        }))
      }
    }
  })
  if (decos.length === 0) return DecorationSet.empty
  return DecorationSet.create(state.doc, decos)
}

export function starlineChip(refs) {
  function handleClick(view, pos, event) {
    const chip = event.target?.closest?.('.glean-starline')
    if (!chip || !view.dom.contains(chip)) return false
    const $pos = view.state.doc.resolve(pos)
    if ($pos.parent.type.name !== 'paragraph') return false
    const offset = pos - $pos.start()
    const text = $pos.parent.textContent
    STARLINE.lastIndex = 0
    for (let m; (m = STARLINE.exec(text)); ) {
      if (offset < m.index || offset > m.index + m[0].length) continue
      const title = m[1]
      const onOpen = refs.onNoteLinkRef.current
      if (title && onOpen) {
        event.preventDefault()
        onOpen(title, refs.noteNamesRef.current?.[title] ?? null)
      }
      return true
    }
    return false
  }

  return new Plugin({
    key: starlineChipKey,
    state: {
      init(_, state) { return decorationsFor(state, refs) },
      apply(tr, _old, _o, newState) {
        if (!tr.docChanged && !tr.selectionSet) return _old
        return decorationsFor(newState, refs)
      },
    },
    props: {
      decorations(state) { return this.getState(state) },
      handleClick,
    },
  })
}
