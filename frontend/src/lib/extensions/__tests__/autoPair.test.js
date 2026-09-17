import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { autoPair } from '../autoPair'
import { schema } from './helpers/testSchema'

function makeView(doc, cursor) {
  const pmDoc = schema.nodeFromJSON(doc)
  const state = EditorState.create({
    doc: pmDoc,
    selection: TextSelection.create(pmDoc, cursor),
    plugins: [autoPair()],
  })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, { state })
}

// Mirrors a real browser keystroke: single chars go through handleKeyDown,
// where the plugin intercepts pair chars; everything else falls through to
// the DOM insert, which appendTransaction sees exactly like real typing
function typeChar(view, ch) {
  const handled = view.someProp('handleKeyDown', (f) => f(view, { key: ch, preventDefault() {} }))
  if (!handled) view.dispatch(view.state.tr.insertText(ch))
}

function pressKey(view, key) {
  return view.someProp('handleKeyDown', (f) => f(view, { key, preventDefault() {} }))
}

function moveCaret(view, pos) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

const para = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const docOf = (...blocks) => ({ type: 'doc', content: blocks })
const body = (view) => view.state.doc.textBetween(1, view.state.doc.content.size - 1)

function markNames(view) {
  const marks = []
  view.state.doc.nodesBetween(1, view.state.doc.content.size - 1, (node) => {
    if (node.marks.length) marks.push(node.marks.map((m) => m.type.name).join(','))
  })
  return marks
}

describe('autoPair', () => {
  it('pairs one-keystroke chars with the caret inside', () => {
    const cases = [
      ['$', '$$', 2],
      ['~', '~~~~', 3],
      ['=', '====', 3],
    ]
    for (const [key, expectText, expectCaret] of cases) {
      const view = makeView(docOf(para('')), 1)
      expect(typeChar(view, key)).toBeUndefined()
      expect(body(view)).toBe(expectText)
      expect(view.state.selection.from).toBe(expectCaret)
      view.destroy()
    }
  })

  it('keeps the first * literal and grows it on the second keystroke', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '*')
    expect(body(view)).toBe('*')
    expect(view.state.selection.from).toBe(2)
    typeChar(view, '*')
    expect(body(view)).toBe('****')
    expect(view.state.selection.from).toBe(3)
    view.destroy()
  })

  it('completes the starline on the second bracket and feeds the picker text', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '[')
    expect(body(view)).toBe('[')
    expect(view.state.selection.from).toBe(2)
    typeChar(view, '[')
    expect(body(view)).toBe('[[]]')
    expect(view.state.selection.from).toBe(3)
    view.destroy()
  })

  it('typing content then the closer converts a marked pair to its mark', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '~')
    typeChar(view, 'h')
    typeChar(view, 'i')
    expect(body(view)).toBe('~~hi~~')
    expect(view.state.selection.from).toBe(5)
    typeChar(view, '~')
    expect(body(view)).toBe('hi')
    expect(view.state.selection.from).toBe(3)
    expect(markNames(view)).toEqual(['strike_through'])
    view.destroy()
  })

  it('skips over the close of an empty pair instead of doubling', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '=')
    typeChar(view, '=')
    expect(body(view)).toBe('====')
    expect(view.state.selection.from).toBe(5)
    view.destroy()
  })

  it('a markless pair skips over and stays literal', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '[')
    typeChar(view, '[')
    typeChar(view, 'x')
    expect(body(view)).toBe('[[x]]')
    expect(view.state.selection.from).toBe(4)
    expect(markNames(view)).toEqual([])
    typeChar(view, ']')
    expect(body(view)).toBe('[[x]]')
    expect(view.state.selection.from).toBe(6)
    view.destroy()
  })

  it('converting on caret exit marks the pair content', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '*')
    typeChar(view, '*')
    typeChar(view, 'b')
    expect(body(view)).toBe('**b**')
    expect(view.state.selection.from).toBe(4)
    moveCaret(view, 6)
    expect(markNames(view)).toEqual(['strong'])
    expect(body(view)).toBe('b')
    view.destroy()
  })

  it('backspace inside an empty pair dissolves both halves', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '$')
    expect(body(view)).toBe('$$')
    expect(pressKey(view, 'Backspace')).toBe(true)
    expect(body(view)).toBe('')
    view.destroy()
  })

  it('does not pair when a word character is ahead', () => {
    const view = makeView(docOf(para('foo')), 1)
    typeChar(view, '~')
    expect(body(view)).toBe('~foo')
    expect(markNames(view)).toEqual([])
    view.destroy()
  })

  it('backtick is not a pair: one keystroke stays a single literal', () => {
    const view = makeView(docOf(para('')), 1)
    typeChar(view, '`')
    expect(body(view)).toBe('`')
    expect(view.state.selection.from).toBe(2)
    typeChar(view, '`')
    expect(body(view)).toBe('``')
    expect(view.state.doc.firstChild.type.name).toBe('paragraph')
    view.destroy()
  })

  it('converts a paragraph of exactly ``` into a code block plus paragraph', () => {
    const view = makeView(docOf(para('')), 1)
    for (const ch of '```') typeChar(view, ch)
    const first = view.state.doc.firstChild
    expect(first.type.name).toBe('code_block')
    expect(view.state.doc.childCount).toBe(2)
    expect(view.state.doc.lastChild.type.name).toBe('paragraph')
    view.destroy()
  })

  it('escape exits a code block into the paragraph after it', () => {
    const view = makeView(docOf(para(''), para('')), 1)
    for (const ch of '```') typeChar(view, ch)
    typeChar(view, 'x')
    expect(pressKey(view, 'Escape')).toBe(true)
    expect(view.state.doc.childCount).toBe(2)
    expect(view.state.selection.from).toBeGreaterThanOrEqual(4)
    view.destroy()
  })

  it('does not pair inside a code block', () => {
    const view = makeView(docOf(para(''), para('')), 1)
    for (const ch of '```') typeChar(view, ch)
    typeChar(view, 'x')
    typeChar(view, '$')
    const code = view.state.doc.firstChild
    expect(code.textContent).toBe('x$')
    view.destroy()
  })
})
