import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

// Animated typing: freshly inserted characters carry a short-lived
// animation class, and backspace triggers sparkles. The ranges are
// tracked in a state field so they map through later edits; a sweep
// effect prunes ranges past their lifetime.

export const FADE_MS = 350

const clearFresh = StateEffect.define()

// Tracks fresh insert ranges: [{from, to, ts}]. Newly typed (non-undo,
// non-redo, single-line) insertions are recorded; the sweep effect
// prunes them once past their lifetime.
export const freshField = StateField.define({
  create() { return [] },
  update(ranges, tr) {
    for (const e of tr.effects) {
      if (e.is(clearFresh)) {
        const now = Date.now()
        ranges = ranges.filter(r => now - r.ts < FADE_MS)
        continue
      }
    }
    if (tr.docChanged && !tr.isUserEvent('undo') && !tr.isUserEvent('redo')) {
      const now = Date.now()
      const next = ranges
        .map(r => ({ from: tr.changes.mapPos(r.from), to: tr.changes.mapPos(r.to), ts: r.ts }))
        .filter(r => r.from < r.to && now - r.ts < FADE_MS)
      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const len = toB - fromB
        if (len > 0 && len <= 400 && !inserted.sliceString(0).includes('\n')) {
          next.push({ from: fromB, to: toB, ts: now })
        }
      })
      if (next.length > 200) next.splice(0, next.length - 200)
      return next
    }
    return ranges
  },
})

const animMark = Decoration.mark({ class: 'glean-anim' })

// Derives the animation decorations from the fresh ranges.
export const animField = StateField.define({
  create(state) {
    const fresh = state.field(freshField, false)
    return buildSet(fresh)
  },
  update(deco, tr) {
    const fresh = tr.state.field(freshField, false)
    return buildSet(fresh)
  },
  provide: f => EditorView.decorations.from(f),
})

function buildSet(fresh) {
  if (!fresh || fresh.length === 0) return Decoration.none
  const builder = new RangeSetBuilder()
  for (const r of fresh) builder.add(r.from, r.to, animMark)
  return builder.finish()
}

// Sweeps expired ranges with a timer so animations end even when the
// user stops typing.
export const animSweeper = ViewPlugin.fromClass(class {
  constructor(view) {
    this.timer = setInterval(() => {
      const fresh = view.state.field(freshField, false)
      if (fresh && fresh.length > 0) {
        view.dispatch({ effects: clearFresh.of(null) })
      }
    }, 120)
  }
  destroy() { clearInterval(this.timer) }
})