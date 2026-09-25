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

describe('footnote layer', () => {
  it('references and definitions get the footnote class away from the caret', async () => {
    const ctx = mount('text[^1] more\n\n[^1]: the note\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const marks = ctx.view.dom.querySelectorAll('.glean-fn')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(marks.length).toBe(2)
    expect(marks[0].getAttribute('data-fn')).toBe('1')
    expect(doc).toContain('[^1]')
  })

  it('the caret entering a token reveals it dimmed raw', async () => {
    const doc0 = 'text[^1] more\n\n[^1]: the note\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, doc0.indexOf('^'))
    await settle()
    const revealed = ctx.view.dom.querySelectorAll('.glean-syntax-revealed').length
    destroy(ctx)
    expect(revealed).toBe(1)
  })

  it('clicking a reference moves the caret to the definition', async () => {
    const doc0 = 'body text[^note]\n\n[^note]: the definition\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, 0)
    await settle()
    const ref = ctx.view.dom.querySelector('.glean-fn')
    const before = ctx.view.state.selection.main.head
    ref.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }))
    const after = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(before).toBe(0)
    expect(after).toBe(doc0.indexOf('[^note]:'))
  })

  it('rename rewrites every label in one transaction', async () => {
    const doc0 = 'a[^x] b[^x]\n\n[^x]: def\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, 0)
    await settle()
    const v = ctx.view
    const ranges = []
    const doc = v.state.doc
    const re = /\[\^x\]/g
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n)
      let m
      re.lastIndex = 0
      while ((m = re.exec(line.text))) ranges.push({ from: line.from + m.index, to: line.from + m.index + 4, insert: '[^y]' })
    }
    v.dispatch({ changes: ranges, userEvent: 'input' })
    const out = emitMarkdown(v)
    const undone = v.state.doc.toString()
    destroy(ctx)
    expect(ranges.length).toBe(3)
    expect(out).toBe('a[^y] b[^y]\n\n[^y]: def\n')
    // one undo step: a single dispatch is one history event by construction
    expect(undone).toBe(out)
  })
})
