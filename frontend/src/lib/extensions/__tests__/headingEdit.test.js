import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema } from 'prosemirror-model'
import { headingEdit } from '../headingEdit'
import { wrapSelection } from '../wrapSelection'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
    heading: {
      group: 'block',
      content: 'text*',
      attrs: { level: { default: 1 } },
      parseDOM: [1, 2, 3, 4, 5, 6].map((l) => ({ tag: `h${l}`, attrs: { level: l } })),
      toDOM: (n) => [`h${n.attrs.level}`, 0],
    },
    text: {},
  },
  marks: {
    emphasis: {
      parseDOM: [{ tag: 'em' }],
      toDOM: () => ['em', 0],
    },
  },
})

const NodeType = (name) => schema.node(name)

function makeView(doc) {
  const state = EditorState.create({ doc, plugins: [headingEdit(), wrapSelection()] })
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

function pressBackspace(view) {
  return view.someProp('handleKeyDown', (f) => f(view, { key: 'Backspace', preventDefault() {} }))
}

describe('headingEdit', () => {
  it('bumps H1 to H2 when # is typed at the start', () => {
    const view = makeView(schema.node('doc', null, [schema.node('heading', { level: 1 }, [schema.text('Title')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '#')
    expect(view.state.doc.firstChild.attrs.level).toBe(2)
    expect(view.state.doc.firstChild.textContent).toBe('Title')
  })

  it('does not bump past level 6', () => {
    const view = makeView(schema.node('doc', null, [schema.node('heading', { level: 6 }, [schema.text('Deep')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    typeText(view, '#')
    expect(view.state.doc.firstChild.attrs.level).toBe(6)
  })

  it('demotes H2 to H1 on Backspace at start', () => {
    const view = makeView(schema.node('doc', null, [schema.node('heading', { level: 2 }, [schema.text('Mid')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    pressBackspace(view)
    expect(view.state.doc.firstChild.attrs.level).toBe(1)
    expect(view.state.doc.firstChild.textContent).toBe('Mid')
  })

  it('turns H1 into a paragraph on Backspace at start', () => {
    const view = makeView(schema.node('doc', null, [schema.node('heading', { level: 1 }, [schema.text('Top')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
    pressBackspace(view)
    expect(view.state.doc.firstChild.type.name).toBe('paragraph')
    expect(view.state.doc.firstChild.textContent).toBe('Top')
  })

  it('ignores # typed mid-heading', () => {
    const view = makeView(schema.node('doc', null, [schema.node('heading', { level: 1 }, [schema.text('Ti')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)))
    typeText(view, '#')
    expect(view.state.doc.firstChild.attrs.level).toBe(1)
    expect(view.state.doc.firstChild.textContent).toBe('Ti#')
  })
})

describe('wrapSelection', () => {
  it('wraps a selection in * pair and keeps it selected', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hello world')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)))
    typeText(view, '*')
    expect(view.state.doc.textContent).toBe('*hello* world')
    expect(view.state.selection.from).toBe(2)
    expect(view.state.selection.to).toBe(7)
  })

  it('toggles off when the same char wraps twice', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hi')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 3)))
    typeText(view, '*')
    typeText(view, '*')
    expect(view.state.doc.textContent).toBe('hi')
  })

  it('stacks a different pair around an existing one', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hi')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 3)))
    typeText(view, '*')
    typeText(view, '_')
    expect(view.state.doc.textContent).toBe('*_hi_*')
  })

  it('wraps a selection in ~~~~ when ~ is typed', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('gone')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5)))
    typeText(view, '~')
    expect(view.state.doc.textContent).toBe('~~gone~~')
  })

  it('strips the pair when selection is already wrapped', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('*hello*')])]))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 7)))
    typeText(view, '*')
    expect(view.state.doc.textContent).toBe('hello')
  })

  it('dissolves an empty pair around the caret', () => {
    const view = makeView(schema.node('doc', null, [schema.node('paragraph', null, [schema.text('*')])]))
    const tr = view.state.tr.insertText('*', 2)
    tr.setSelection(TextSelection.create(tr.doc, 2))
    view.dispatch(tr)
    typeText(view, '*')
    expect(view.state.doc.textContent).toBe('')
  })
})
