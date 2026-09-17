import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const atomicRangesKey = new PluginKey('glean-atomic-ranges')

// Makes raw markdown syntax glyphs atomic decoration: uneditable, unclickable,
// and crossed by the caret in one press. PoC scope: starline brackets [[ ]]
// and the alert [!NOTE] marker, the only syntax still reachable as real text.
// Everything else (heading hashes, fence glyphs, mark pairs, link syntax) is
// already widget or attribute decoration with no caret path into it.
//
// Only the syntax runs are atomic; the content between them (a starline's
// title) stays editable, the way Obsidian keeps link text editable while its
// brackets are furniture. The doc text never changes: serialization stays
// byte-true. The plugin only redirects selections and intercepts a few keys.

const STARLINE = /\[\[([^\[\]\n]+)\]\]/g
const ALERT_MARKER = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

// Starline open/close bracket runs in every paragraph. Mirrors
// starlineChip's paragraph scan (including the atom-inline skip: leaf
// non-text children shift textContent offsets away from doc positions)
function starlineRanges(doc) {
  const ranges = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph' || node.type.spec.code) return
    let hasAtom = false
    node.forEach((child) => {
      if (child.isLeaf && !child.isText) hasAtom = true
    })
    if (hasAtom) return
    const base = pos + 1
    const text = node.textContent
    STARLINE.lastIndex = 0
    for (let m; (m = STARLINE.exec(text)); ) {
      const openStart = base + m.index
      const closeEnd = openStart + m[0].length
      ranges.push({ from: openStart, to: openStart + 2 })
      ranges.push({ from: closeEnd - 2, to: closeEnd })
    }
  })
  return ranges
}

// The alert marker range, re-derived the same way alerts.js does: the marker
// sits at the start of a blockquote's first paragraph. The whole marker is
// syntax (no editable content inside), so it is one atomic range
function alertRanges(doc) {
  const ranges = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return
    const first = node.maybeChild(0)
    if (!first || !first.isTextblock) return
    const m = first.textContent.match(ALERT_MARKER)
    if (!m) return
    ranges.push({ from: pos + 2, to: pos + 2 + m[0].length })
  })
  return ranges
}

function collectRanges(doc) {
  return [...starlineRanges(doc), ...alertRanges(doc)]
}

// The atomic range strictly containing pos, or null when pos is free
function inRange(doc, pos) {
  for (const r of collectRanges(doc)) {
    if (pos > r.from && pos < r.to) return r
  }
  return null
}

function handleKeyDown(view, event) {
  const { state } = view
  const { selection } = state
  if (!selection.empty) return false
  const pos = selection.from

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const target = event.key === 'ArrowRight' ? pos + 1 : pos - 1
    if (target <= 0 || target >= state.doc.content.size) return false
    // step over the whole run in one press, never resting on a glyph
    let exit = null
    for (const r of collectRanges(state.doc)) {
      const enters = event.key === 'ArrowRight'
        ? target >= r.from && target < r.to
        : target > r.from && target <= r.to
      if (enters) {
        exit = event.key === 'ArrowRight' ? r.to : r.from
        break
      }
    }
    if (exit == null) return false
    event.preventDefault()
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, exit)))
    return true
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    // probe the char the key would remove; only a full run at the inner
    // edge dies as a unit, content around it is untouched
    const probe = event.key === 'Backspace' ? pos - 1 : pos + 1
    const r = inRange(state.doc, probe)
    if (!r) return false
    const atInner = event.key === 'Backspace' ? pos === r.to : pos === r.from
    if (!atInner) return false
    event.preventDefault()
    view.dispatch(state.tr.delete(r.from, r.to))
    return true
  }

  // printable keys never land inside a run: snap to the near boundary first.
  // Selection snapping below makes this nearly unreachable; it is the
  // backstop for IME or programmatic paths that bypass appendTransaction
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const hit = inRange(state.doc, pos)
    if (!hit) return false
    event.preventDefault()
    const near = pos - hit.from < hit.to - pos ? hit.from : hit.to
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, near)))
    return true
  }

  return false
}

// Any selection landing strictly inside an atomic run snaps out to the near
// boundary, covering clicks, double-clicks, Home/End, and programmatic
// selections. Runs as appendTransaction so every dispatch path is covered
function snapSelections(trs, oldState, newState) {
  if (trs.some((tr) => tr.getMeta(atomicRangesKey))) return null
  const sel = newState.selection
  if (!sel || !sel.empty) return null
  const snapped = snapOut(newState.doc, sel.from)
  if (snapped == null || snapped === sel.from) return null
  return newState.tr.setSelection(TextSelection.create(newState.doc, snapped))
    .setMeta(atomicRangesKey, {})
}

// Nearest boundary of the run strictly containing pos, or null when free
function snapOut(doc, pos) {
  const r = inRange(doc, pos)
  if (!r) return null
  return pos - r.from < r.to - pos ? r.from : r.to
}

export const atomicRanges = () => new Plugin({
  key: atomicRangesKey,
  props: {
    decorations(state) {
      const decos = collectRanges(state.doc).map((r) =>
        Decoration.inline(r.from, r.to, { class: 'glean-atomic' }))
      return decos.length ? DecorationSet.create(state.doc, decos) : DecorationSet.empty
    },
    handleKeyDown,
    handleClick(view, pos) {
      const snapped = snapOut(view.state.doc, pos)
      if (snapped == null || snapped === pos) return false
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, snapped)))
      return true
    },
  },
  appendTransaction: snapSelections,
})
