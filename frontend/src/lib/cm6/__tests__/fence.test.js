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

function settle(ms = 30) {
  return new Promise((r) => setTimeout(r, ms))
}

function key(ctx, k) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  ctx.view.contentDOM.dispatchEvent(event)
  return !event.defaultPrevented ? 'default' : 'handled'
}

describe('fence exit', () => {
  it('Enter on the empty line of a closed fence lands below the closing fence', async () => {
    const ctx = mount('```js\nlet x\n\n```\nafter\n')
    await settle()
    const lines = ctx.view.state.doc.toString().split('\n')
    const emptyAt = lines.indexOf('') // line 3 (index 2)
    caret(ctx, ctx.view.state.doc.line(3).from)
    const r = key(ctx, 'Enter')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(emptyAt).toBe(2)
    expect(r).toBe('handled')
    expect(doc).toBe('```js\nlet x\n\n```\n\nafter\n')
    expect(pos).toBe(ctx.view.state.doc.line(5).from)
  })

  it('Enter on a fence body line keeps the newline normal', async () => {
    const ctx = mount('```js\nlet x\n```\n')
    await settle()
    caret(ctx, ctx.view.state.doc.line(2).to)
    const r = key(ctx, 'Enter')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(r).toBe('handled')
    expect(doc).toBe('```js\nlet x\n\n```\n')
  })

  it('Enter on the empty line of a doc-end fence closes the fence and lands below', async () => {
    const ctx = mount('```\ncode')
    await settle()
    caret(ctx, ctx.view.state.doc.length)
    key(ctx, 'Enter')
    // caret now on the new empty last line inside the fence
    const r = key(ctx, 'Enter')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(r).toBe('handled')
    expect(doc).toBe('```\ncode\n```\n')
    expect(pos).toBe(doc.length)
  })

  it('Enter outside fences falls through untouched', async () => {
    const ctx = mount('plain text\n')
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).to)
    const r = key(ctx, 'Enter')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(r).toBe('handled')
    expect(doc).toBe('plain text\n\n')
  })
})
