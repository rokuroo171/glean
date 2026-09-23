import { describe, it, expect, vi } from 'vitest'
import './cm6dom'
import { createEditor, emitMarkdown } from '../editor'
import { starlineAt, chipClick } from '../starline'

function mount(initial, opts = {}) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = createEditor({
    parent,
    markdown: initial,
    starline: { getNoteNames: opts.getNoteNames || (() => ({ 'Known Note': 'n1' })), onNoteLink: opts.onNoteLink || (() => {}) },
  })
  return { view, parent }
}

function destroy(view, parent) {
  view.destroy()
  parent.remove()
}

function marks(view) {
  const out = []
  const set = view.dom.querySelectorAll('.glean-starline')
  return set
}

describe('starline chips', () => {
  it('hides brackets and marks the title when the caret is away', () => {
    const { view, parent } = mount('See [[Known Note]] now.\n')
    const chips = [...marks(view)]
    destroy(view, parent)
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('Known Note')
    expect(chips[0].className).not.toContain('missing')
  })

  it('shows the raw glyphs when the caret sits strictly inside', () => {
    const { view, parent } = mount('See [[Known Note]] now.\n')
    view.dispatch({ selection: { anchor: 9 } }) // between [[ and the title
    const chips = [...marks(view)]
    const raw = view.dom.querySelectorAll('.glean-starline-raw')
    destroy(view, parent)
    expect(chips.length).toBe(0)
    expect(raw.length).toBe(2)
  })

  it('keeps the chip when the caret rests on the closing edge', () => {
    const { view, parent } = mount('See [[Known Note]] now.\n')
    const closeEnd = 'See [[Known Note]]'.length
    view.dispatch({ selection: { anchor: closeEnd } })
    const chips = [...marks(view)]
    destroy(view, parent)
    expect(chips.length).toBe(1)
  })

  it('flags a missing target with the missing class and a create tip', () => {
    const { view, parent } = mount('See [[Ghost]] now.\n')
    const chip = marks(view)[0]
    destroy(view, parent)
    expect(chip.className).toContain('missing')
    expect(chip.getAttribute('data-tip')).toBe('Create note Ghost')
  })

  it('leaves the buffer byte-true through every state', () => {
    const { view, parent } = mount('A [[Known Note]] and a [[Ghost]] in one line.\n')
    const afterLoad = emitMarkdown(view)
    view.dispatch({ selection: { anchor: 12 } })
    const afterPark = emitMarkdown(view)
    destroy(view, parent)
    expect(afterLoad).toBe('A [[Known Note]] and a [[Ghost]] in one line.\n')
    expect(afterPark).toBe(afterLoad)
  })

  it('recomputes when noteNames drift', () => {
    let names = {}
    const { view, parent } = mount('See [[Flip]] now.\n', { getNoteNames: () => names })
    const before = marks(view)[0]
    names = { Flip: 'n9' }
    view.dispatch({ selection: { anchor: 0 } })
    const after = marks(view)[0]
    destroy(view, parent)
    expect(before.className).toContain('missing')
    expect(after.className).not.toContain('missing')
    expect(after.getAttribute('data-tip')).toBe('Open Flip')
  })

  it('clicks a chip through onNoteLink with resolved id', () => {
    const onNoteLink = vi.fn()
    const doc = 'See [[Known Note]] now.\n'
    expect(starlineAt(doc, 12)).toBe('Known Note')
    expect(starlineAt(doc, 3)).toBeNull()
    const event = { target: { closest: () => ({}) }, preventDefault: vi.fn(), clientX: 0, clientY: 0 }
    const view = { state: { doc: { toString: () => doc } }, posAtCoords: () => 12 }
    const handled = chipClick(view, event, { getNoteNames: () => ({ 'Known Note': 'n1' }), onNoteLink })
    expect(handled).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(onNoteLink).toHaveBeenCalledWith('Known Note', 'n1')
  })

  it('ignores brackets across lines', () => {
    const { view, parent } = mount('A [[one\nline]] here.\n')
    const chips = marks(view).length
    destroy(view, parent)
    expect(chips).toBe(0)
  })
})
