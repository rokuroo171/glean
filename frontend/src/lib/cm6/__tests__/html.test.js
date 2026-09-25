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

describe('html pair layer', () => {
  it('styles the content between raw visible tags', async () => {
    const ctx = mount('plain\n\n<em>soft</em> tail\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const styled = ctx.view.dom.querySelectorAll('.glean-html-em')
    const line = [...ctx.view.dom.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('soft'))
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(styled.length).toBe(1)
    expect(line.textContent).toContain('<em>')
    expect(doc).toContain('<em>')
  })

  it('nesting stacks: a sub inside a sup both style', async () => {
    const ctx = mount('x<sup>2<sub>n</sub></sup>\n')
    await settle()
    caret(ctx, 0)
    await settle()
    destroy(ctx)
    const sup = ctx.view.dom.querySelectorAll('.glean-html-sup').length
    const sub = ctx.view.dom.querySelectorAll('.glean-html-sub').length
    expect(sup).toBe(1)
    expect(sub).toBe(1)
  })

  it('an unpaired tag decorates nothing', async () => {
    const ctx = mount('<em>never closed\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const styled = ctx.view.dom.querySelectorAll('.glean-html-em').length
    destroy(ctx)
    expect(styled).toBe(0)
  })

  it('tags inside fenced code stay untouched', async () => {
    const ctx = mount('```\n<em>x</em>\n```\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const styled = ctx.view.dom.querySelectorAll('.glean-html-em').length
    destroy(ctx)
    expect(styled).toBe(0)
  })

  it('buffer stays byte-true', async () => {
    const doc0 = '<u>line</u> and <mark>hl</mark>\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, 0)
    await settle()
    caret(ctx, 5)
    await settle()
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe(doc0)
  })
})
