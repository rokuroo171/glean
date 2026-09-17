import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { atomicRanges } from '../atomicRanges'
import { schema } from './helpers/testSchema'

function makeView(docText) {
  const pmDoc = schema.node('doc', null, [schema.node('paragraph', null, docText ? [schema.text(docText)] : [])])
  const state = EditorState.create({
    doc: pmDoc,
    selection: TextSelection.create(pmDoc, 1),
    plugins: [atomicRanges()],
  })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, { state })
}

function pos(view) {
  return view.state.selection.from
}

function setPos(view, p) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, p)))
}

// someProp returns undefined for an unhandled key; treat it as false
function press(view, key) {
  return view.someProp('handleKeyDown', (f) => f(view, { key, preventDefault() {} })) === true
}

// 'a [[Starlines]] b': free stops are the outer edges (OPEN, CLOSE_END) and
// the title boundaries (OPEN_END, CLOSE_START); the glyph interiors are not
const DOC = 'a [[Starlines]] b'
const OPEN = 3         // before the first [
const OPEN_END = 5     // first title char
const CLOSE_START = 14 // first ]
const CLOSE_END = 16   // just past the last ]

describe('atomicRanges: starline', () => {
  it('marks the two bracket runs as atomic decorations', () => {
    const view = makeView(DOC)
    const decos = view.someProp('decorations', (f) => f(view.state)).find()
    expect(decos.length).toBe(2)
    expect(decos.map((d) => d.from)).toEqual([OPEN, CLOSE_START])
    expect(decos.map((d) => d.to)).toEqual([OPEN_END, CLOSE_END])
    view.destroy()
  })

  it('ArrowRight crosses the open run in one press', () => {
    const view = makeView(DOC)
    setPos(view, OPEN)
    expect(press(view, 'ArrowRight')).toBe(true)
    expect(pos(view)).toBe(OPEN_END)
    view.destroy()
  })

  it('ArrowRight crosses the close run in one press', () => {
    const view = makeView(DOC)
    setPos(view, CLOSE_START)
    expect(press(view, 'ArrowRight')).toBe(true)
    expect(pos(view)).toBe(CLOSE_END)
    view.destroy()
  })

  it('ArrowLeft crosses the close run in one press', () => {
    const view = makeView(DOC)
    setPos(view, CLOSE_END)
    expect(press(view, 'ArrowLeft')).toBe(true)
    expect(pos(view)).toBe(CLOSE_START)
    view.destroy()
  })

  it('ArrowLeft crosses the open run in one press', () => {
    const view = makeView(DOC)
    setPos(view, OPEN_END)
    expect(press(view, 'ArrowLeft')).toBe(true)
    expect(pos(view)).toBe(OPEN)
    view.destroy()
  })

  it('the title text between the brackets stays editable', () => {
    const view = makeView(DOC)
    setPos(view, OPEN_END)
    expect(press(view, 'x')).toBe(false)
    view.dispatch(view.state.tr.insertText('x'))
    expect(view.state.doc.textContent).toBe('a [[xStarlines]] b')
    view.destroy()
  })

  it('backspace at the open run inner edge deletes the run as a unit', () => {
    const view = makeView(DOC)
    setPos(view, OPEN_END)
    expect(press(view, 'Backspace')).toBe(true)
    expect(view.state.doc.textContent).toBe('a Starlines]] b')
    view.destroy()
  })

  it('backspace at the close run inner edge deletes the run as a unit', () => {
    const view = makeView(DOC)
    setPos(view, CLOSE_END)
    expect(press(view, 'Backspace')).toBe(true)
    expect(view.state.doc.textContent).toBe('a [[Starlines b')
    view.destroy()
  })

  it('backspace mid-title is not intercepted', () => {
    const view = makeView(DOC)
    setPos(view, OPEN_END + 1)
    expect(press(view, 'Backspace')).toBe(false)
    view.destroy()
  })

  it('delete at the close run outer edge removes the run as a unit', () => {
    const view = makeView(DOC)
    setPos(view, CLOSE_START)
    expect(press(view, 'Delete')).toBe(true)
    expect(view.state.doc.textContent).toBe('a [[Starlines b')
    view.destroy()
  })

  it('a selection dispatched inside a run snaps out to a boundary', () => {
    const view = makeView(DOC)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, OPEN + 1)))
    const p = pos(view)
    expect(p === OPEN || p === OPEN_END).toBe(true)
    view.destroy()
  })

  it('clicks map to the near boundary and never rest inside', () => {
    const view = makeView(DOC)
    const handled = view.someProp('handleClick', (f) => f(view, CLOSE_START + 1, { target: document.createElement('span') }))
    expect(handled).toBe(true)
    const p = pos(view)
    expect(p === CLOSE_START || p === CLOSE_END).toBe(true)
    view.destroy()
  })

  it('leaves plain text alone', () => {
    const view = makeView('hello world')
    setPos(view, 4)
    expect(press(view, 'ArrowRight')).toBe(false)
    expect(press(view, 'Backspace')).toBe(false)
    expect(press(view, 'x')).toBe(false)
    expect(view.state.doc.textContent).toBe('hello world')
    view.destroy()
  })

  it('ignores an unclosed [[ pair so autoPair keeps owning it', () => {
    const view = makeView('a [[x] b')
    setPos(view, 4)
    expect(press(view, 'ArrowRight')).toBe(false)
    expect(press(view, 'Backspace')).toBe(false)
    view.destroy()
  })
})
