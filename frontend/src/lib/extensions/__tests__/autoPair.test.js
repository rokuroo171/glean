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

function typeText(view, text) {
  for (const ch of text) {
    const pos = view.state.selection.from
    if (!view.someProp('handleTextInput', (f) => f(view, pos, pos, ch))) {
      view.dispatch(view.state.tr.insertText(ch))
    }
  }
}

function pressBackspace(view) {
  return view.someProp('handleKeyDown', (f) => f(view, { key: 'Backspace', preventDefault() {} }))
}

const para = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const docOf = (...blocks) => ({ type: 'doc', content: blocks })
const body = (view) => view.state.doc.textBetween(1, view.state.doc.content.size - 1)

describe('autoPair', () => {
  it('pairs one-keystroke chars with the caret inside', () => {
    const cases = [
      ['`', '``', 2],
      ['$', '$$', 2],
      ['~', '~~~~', 3],
      ['=', '====', 3],
    ]
    for (const [ch, text, caret] of cases) {
      const view = makeView(docOf(para('')), 1)
      typeText(view, ch)
      expect(body(view)).toBe(text)
      expect(view.state.selection.from).toBe(caret)
      view.destroy()
    }
  })

  it('keeps the first * literal and grows the second into a strong pair', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '*')
    expect(body(view)).toBe('*')
    typeText(view, '*')
    expect(body(view)).toBe('****')
    expect(view.state.selection.from).toBe(3)
    view.destroy()
  })

  it('extends a ** run instead of re-pairing (triple star stays literal)', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '**')
    expect(body(view)).toBe('****')
    typeText(view, '*')
    expect(body(view)).toBe('*****')
    view.destroy()
  })

  it('blocks pairing before a word character', () => {
    const view = makeView(docOf(para('abc')), 1)
    typeText(view, '`')
    expect(body(view)).toBe('`abc')
    view.destroy()
  })

  it('completes the starline pair on the second bracket', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '[[')
    expect(body(view)).toBe('[[]]')
    expect(view.state.selection.from).toBe(3)
    view.destroy()
  })

  it('reuses a lone close bracket ahead of the starline', () => {
    const view = makeView(docOf(para('[]')), 2)
    typeText(view, '[')
    expect(body(view)).toBe('[[]]')
    view.destroy()
  })

  it('dissolves an empty pair on backspace', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '`')
    expect(body(view)).toBe('``')
    expect(view.state.selection.from).toBe(2)
    expect(pressBackspace(view)).toBe(true)
    expect(body(view)).toBe('')
    view.destroy()
  })

  it('converts the pair to its mark when the close is typed', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '`x`')
    expect(body(view)).toBe('x')
    expect(view.state.selection.from).toBe(2)
    const marks = []
    view.state.doc.nodesBetween(0, view.state.doc.content.size, (node) => {
      if (node.marks.length) marks.push(node.marks.map((m) => m.type.name).join(','))
    })
    expect(marks).toEqual(['inlineCode'])
    view.destroy()
  })

  it('converts the pair to its mark when the caret exits by movement', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '`x')
    expect(body(view)).toBe('`x`')
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 4)))
    expect(body(view)).toBe('x')
    const marks = []
    view.state.doc.nodesBetween(0, view.state.doc.content.size, (node) => {
      if (node.marks.length) marks.push(node.marks.map((m) => m.type.name).join(','))
    })
    expect(marks).toEqual(['inlineCode'])
    view.destroy()
  })

  it('opens a fenced code block from triple backticks', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '```')
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    expect(view.state.selection.from).toBe(1)
    view.destroy()
  })

  it('accepts a language tag and code inside the opened block', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '```')
    typeText(view, 'js')
    expect(view.state.doc.firstChild.type.name).toBe('code_block')
    expect(view.state.doc.firstChild.textContent).toBe('js')
    expect(view.state.selection.from).toBe(3)
    view.destroy()
  })

  it('typing text inside the block does not retrigger the fence', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '```')
    typeText(view, 'code here')
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    expect(view.state.doc.firstChild.textContent).toBe('code here')
    view.destroy()
  })

  it('a fence with text before the caret stays a paragraph', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, 'no')
    typeText(view, '```')
    expect(view.state.doc.firstChild.type.name).toBe('paragraph')
    expect(view.state.doc.textContent).toBe('no```')
    view.destroy()
  })

  it('a document ending on a code block gains a trailing paragraph', () => {
    const view = makeView(docOf(para('')), 1)
    const block = schema.node('code_block', { language: '' }, [schema.text('x')])
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, block))
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    view.destroy()
  })

  it('escape at block end exits to the paragraph after', () => {
    const view = makeView(docOf(para('')), 1)
    typeText(view, '```')
    typeText(view, 'x')
    const insideEnd = view.state.doc.firstChild.content.size + 1
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, insideEnd)))
    const handled = view.someProp('handleKeyDown', (f) => f(view, { key: 'Escape', preventDefault() {} }))
    expect(handled).toBe(true)
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph')
    view.destroy()
  })

  it('does not trigger the fence inside an existing code block', () => {
    const view = makeView(docOf({ type: 'code_block', attrs: { language: '' }, content: [] }), 1)
    typeText(view, '```')
    expect(view.state.doc.firstChild.type.name).toBe('code_block')
    expect(view.state.doc.textContent).toBe('```')
    view.destroy()
  })
})
