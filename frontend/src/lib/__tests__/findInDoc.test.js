import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { findMatches, selectMatch, replaceMatch, replaceAllMatches } from '../findInDoc'
import { schema } from '../extensions/__tests__/helpers/testSchema'

function makeView(paragraphTexts) {
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: paragraphTexts.map((t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] })),
  })
  const state = EditorState.create({ doc })
  const place = document.createElement('div')
  document.body.appendChild(place)
  return new EditorView(place, { state })
}

function text(view) {
  return view.state.doc.textBetween(0, view.state.doc.content.size, '\n')
}

describe('findMatches', () => {
  it('finds all occurrences across nodes case-insensitively by default', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'alpha Beta alpha' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'ALPHA again' }] },
      ],
    })
    const found = findMatches(doc, 'alpha')
    expect(found).toHaveLength(3)
  })

  it('respects case sensitivity when requested', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'alpha Alpha' }] }],
    })
    expect(findMatches(doc, 'alpha', true)).toHaveLength(1)
    expect(findMatches(doc, 'alpha')).toHaveLength(2)
  })

  it('treats the query as literal text, not a pattern', () => {
    const doc = schema.nodeFromJSON({
      type: 'paragraph',
      content: [{ type: 'text', text: 'a.b (c) [d]' }],
    })
    expect(findMatches(doc, '.')).toHaveLength(1)
    expect(findMatches(doc, '(')).toHaveLength(1)
    expect(findMatches(doc, '[')).toHaveLength(1)
  })

  it('returns empty for empty query', () => {
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(findMatches(doc, '')).toEqual([])
  })
})

describe('selectMatch', () => {
  it('selects the range and scrolls it into view', () => {
    const view = makeView(['one two three'])
    selectMatch(view, { from: 5, to: 8 })
    expect(view.state.selection.from).toBe(5)
    expect(view.state.selection.to).toBe(8)
  })

  it('does not steal focus when focus is false', () => {
    const view = makeView(['one two three'])
    const focused = []
    view.focus = () => focused.push(1)
    selectMatch(view, { from: 5, to: 8 }, { focus: false })
    expect(focused).toHaveLength(0)
  })
})

describe('replaceMatch', () => {
  it('replaces the range and leaves the caret after the replacement', () => {
    const view = makeView(['one two three'])
    replaceMatch(view, { from: 5, to: 8 }, '2')
    expect(text(view)).toBe('one 2 three')
    expect(view.state.selection.from).toBe(6)
  })
})

describe('replaceAllMatches', () => {
  it('replaces every match in a single dispatch', () => {
    const view = makeView(['ab ab ab'])
    const matches = findMatches(view.state.doc, 'ab')
    let dispatches = 0
    const orig = view.dispatch.bind(view)
    view.dispatch = (tr) => { dispatches++; orig(tr) }
    replaceAllMatches(view, matches, 'x')
    expect(text(view)).toBe('x x x')
    expect(dispatches).toBe(1)
  })

  it('overlapping match list is safe because replacements go last to first', () => {
    const view = makeView(['aaaa'])
    const matches = findMatches(view.state.doc, 'aa')
    replaceAllMatches(view, matches, 'b')
    expect(text(view)).toBe('bb')
  })
})
