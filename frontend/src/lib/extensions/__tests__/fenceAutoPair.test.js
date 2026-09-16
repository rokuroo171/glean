import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema } from 'prosemirror-model'
import { fenceAutoPair } from '../fenceAutoPair'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
    heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } }, toDOM: (n) => [`h${n.attrs.level}`, 0] },
    code_block: {
      group: 'block',
      content: 'text*',
      attrs: { language: { default: null } },
      toDOM: () => ['pre', 0],
    },
    text: {},
  },
})

function makeView(doc) {
  const state = EditorState.create({ doc, plugins: [fenceAutoPair()] })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, { state })
}

function typeText(view, text) {
  const { from, to } = view.state.selection
  if (!view.someProp('handleTextInput', (f) => f(view, from, to, text))) {
    view.dispatch(view.state.tr.insertText(text))
  }
}

describe('fenceAutoPair', () => {
  it('typing ``` in an empty paragraph creates a code block with a trailing paragraph', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '```')
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    expect(view.state.selection.$from.parent.type.name).toBe('code_block')
  })

  it('caret lands inside the code block ready for code', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '```')
    typeText(view, 'js')
    expect(view.state.doc.firstChild.textContent).toBe('js')
    expect(view.state.selection.from).toBe(3)
  })

  it('typing text between fences does not retrigger', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '```')
    typeText(view, 'code here')
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    expect(view.state.doc.firstChild.textContent).toBe('code here')
  })

  it('typing ``` one keystroke at a time creates a code block, like a real browser', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    for (const ch of '```') typeText(view, ch)
    const children = []
    view.state.doc.forEach((n) => children.push(n.type.name))
    expect(children).toEqual(['code_block', 'paragraph'])
    expect(view.state.selection.$from.parent.type.name).toBe('code_block')
  })

  it('a fence with text before the caret does not convert the paragraph', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, 'no')
    for (const ch of '```') typeText(view, ch)
    expect(view.state.doc.firstChild.type.name).toBe('paragraph')
    expect(view.state.doc.textContent).toBe('no```')
  })

  it('escape at block end exits to the paragraph after', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph')]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '```')
    typeText(view, 'x')
    const insideEnd = view.state.doc.firstChild.content.size + 1
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, insideEnd)))
    const handled = view.someProp('handleKeyDown', (f) => f(view, { key: 'Escape', preventDefault() {} }))
    expect(handled).toBe(true)
    expect(view.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('does not trigger inside an existing code block', () => {
    const view = makeView(schema.node('doc', null, [schema.node('code_block', { language: null })]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '```')
    expect(view.state.doc.firstChild.type.name).toBe('code_block')
    expect(view.state.doc.textContent).toBe('```')
  })
})
