import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'

function mount(initial) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = createEditor({ parent, markdown: initial, starline: null })
  return { view, parent }
}

function destroy(ctx) {
  ctx.view.destroy()
  ctx.parent.remove()
}

function caret(ctx, pos) {
  ctx.view.dispatch({ selection: EditorSelection.cursor(pos) })
}

function type(ctx, text) {
  for (const ch of text) {
    const event = new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })
    ctx.view.contentDOM.dispatchEvent(event)
    if (!event.defaultPrevented) ctx.view.dispatch(ctx.view.state.replaceSelection(ch))
  }
}

function key(ctx, k) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  ctx.view.contentDOM.dispatchEvent(event)
  return !event.defaultPrevented ? 'default' : 'handled'
}

describe('dollar pairing', () => {
  it('pairs on the first keystroke with the caret inside', () => {
    const ctx = mount('')
    caret(ctx, 0)
    type(ctx, '$')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(doc).toBe('$$')
    expect(pos).toBe(1)
  })

  it('closes by typing the dollar inside, currency dollar pairs fresh', () => {
    const ctx = mount('')
    type(ctx, '$')
    type(ctx, 'x')
    type(ctx, '$')
    const closed = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    caret(ctx, ctx.view.state.doc.length)
    type(ctx, ' and 5$')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(closed).toBe('$x$')
    expect(pos).toBe(3)
    expect(doc).toBe('$x$ and 5$$')
  })

  it('dollar after a closed math span flows literal', () => {
    const ctx = mount('$x$')
    caret(ctx, 3)
    type(ctx, '$')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('$x$$')
  })

  it('backspace between a fresh dollar pair deletes both halves', () => {
    const ctx = mount('')
    type(ctx, '$')
    const before = emitMarkdown(ctx.view)
    key(ctx, 'Backspace')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(before).toBe('$$')
    expect(doc).toBe('')
  })
})

describe('highlight pairing', () => {
  it('one equals completes the doubled pair with the caret inside', () => {
    const ctx = mount('hi ')
    caret(ctx, 3)
    type(ctx, '=')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(doc).toBe('hi ====')
    expect(pos).toBe(5)
  })

  it('typed content closes the highlight span with a single keystroke', () => {
    const ctx = mount('hi ')
    caret(ctx, 3)
    type(ctx, '=')
    type(ctx, 'note')
    type(ctx, '=')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(doc).toBe('hi ==note==')
    expect(pos).toBe(11)
  })

  it('a third equals after a closed highlight flows literal', () => {
    const ctx = mount('==hl==')
    caret(ctx, 6)
    type(ctx, '=')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('==hl===')
  })
})

describe('selection wrap parity', () => {
  it('a selection wraps in dollars and stays selected', () => {
    const ctx = mount('x+y')
    ctx.view.dispatch({ selection: EditorSelection.range(0, 3) })
    type(ctx, '$')
    const doc = emitMarkdown(ctx.view)
    const sel = ctx.view.state.selection.main
    destroy(ctx)
    expect(doc).toBe('$x+y$')
    expect(sel.from).toBe(1)
    expect(sel.to).toBe(4)
  })

  it('an equals keystroke on a selection inserts the doubled pair', () => {
    const ctx = mount('hl')
    ctx.view.dispatch({ selection: EditorSelection.range(0, 2) })
    type(ctx, '=')
    const doc = emitMarkdown(ctx.view)
    const sel = ctx.view.state.selection.main
    destroy(ctx)
    expect(doc).toBe('==hl==')
    expect(sel.from).toBe(2)
    expect(sel.to).toBe(4)
  })

  it('wrapping layers stack: bold then highlight', () => {
    const ctx = mount('word')
    ctx.view.dispatch({ selection: EditorSelection.range(0, 4) })
    type(ctx, '*')
    type(ctx, '=')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('*==word==*')
  })
})
