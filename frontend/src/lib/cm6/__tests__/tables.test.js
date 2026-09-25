import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'
import { cellOffset } from '../tables'

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

const TABLE = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n'

describe('table cell navigation', () => {
  it('Tab moves to the start of the next cell across rows', async () => {
    const ctx = mount('intro\n\n' + TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(3).from + 2) // cell a
    expect(cellOffset(ctx.view, 1)).toBe(true)
    const first = ctx.view.state.selection.main.head
    expect(ctx.view.state.doc.lineAt(first).text).toBe('| a | b | c |')
    expect(first).toBe(ctx.view.state.doc.line(3).from + 6) // cell b start
    destroy(ctx)
  })

  it('Tab skips separator rows and lands on body cells', async () => {
    const ctx = mount(TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).from + 2)
    expect(cellOffset(ctx.view, 1)).toBe(true)
    const at = ctx.view.state.selection.main.head
    expect(ctx.view.state.doc.lineAt(at).number).toBe(1)
    expect(at).toBe(ctx.view.state.doc.line(1).from + 6)
    destroy(ctx)
  })

  it('Tab on the last cell falls through', async () => {
    const ctx = mount(TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(3).from + 4) // last body cell
    const r = cellOffset(ctx.view, 1)
    const head = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(r).toBe(false)
    expect(head).toBe(ctx.view.state.doc.line(3).from + 4)
  })

  it('Shift-Tab goes back a cell, then to the current cell start', async () => {
    const ctx = mount(TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).from + 7) // inside cell b
    expect(cellOffset(ctx.view, -1)).toBe(true)
    const backOne = ctx.view.state.selection.main.head
    expect(backOne).toBe(ctx.view.state.doc.line(1).from + 6)
    destroy(ctx)
  })

  it('Shift-Tab on the first cell start falls through', async () => {
    const ctx = mount(TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).from + 2)
    const r = cellOffset(ctx.view, -1)
    destroy(ctx)
    expect(r).toBe(false)
  })

  it('the caret outside a table is left alone', async () => {
    const ctx = mount('plain\n\n' + TABLE)
    await settle()
    caret(ctx, 3)
    const r = cellOffset(ctx.view, 1)
    const head = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(r).toBe(false)
    expect(head).toBe(3)
  })

  it('navigation never touches the buffer', async () => {
    const ctx = mount(TABLE)
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).from + 2)
    const before = emitMarkdown(ctx.view)
    cellOffset(ctx.view, 1)
    cellOffset(ctx.view, 1)
    cellOffset(ctx.view, -1)
    const after = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(before).toBe(after)
  })
})
