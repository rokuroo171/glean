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

describe('image layer', () => {
  it('renders a widget away from the caret with the buffer untouched', async () => {
    const ctx = mount('before\n\n![alt text](https://example.com/cat.png)\n\nafter\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const img = ctx.view.dom.querySelector('.glean-image')
    const missing = ctx.view.dom.querySelector('.glean-image-missing')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(img).toBeTruthy()
    expect(img.src).toContain('cat.png')
    expect(missing).toBeNull()
    expect(doc).toContain('![alt text](https://example.com/cat.png)')
  })

  it('the caret entering the token reveals the raw syntax', async () => {
    const doc0 = 'before\n\n![alt](https://example.com/cat.png)\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, 0)
    await settle()
    const tokenFrom = doc0.indexOf('![')
    caret(ctx, tokenFrom + 4)
    await settle()
    const revealed = ctx.view.dom.querySelectorAll('.glean-syntax-revealed').length
    const img = ctx.view.dom.querySelector('.glean-image')
    const text = [...ctx.view.dom.querySelectorAll('.cm-line')].map((l) => l.textContent).join('\n')
    destroy(ctx)
    expect(revealed).toBeGreaterThanOrEqual(1)
    expect(img).toBeNull()
    expect(text).toContain('![alt](https://example.com/cat.png)')
  })

  it('an empty src renders the missing state, not a broken image', async () => {
    const ctx = mount('text\n\n![label]()\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const missing = ctx.view.dom.querySelector('.glean-image-missing')
    destroy(ctx)
    expect(missing).toBeTruthy()
    expect(missing.textContent).toBe('label')
  })

  it('non-image links stay untouched', async () => {
    const ctx = mount('[a link](https://example.com)\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const img = ctx.view.dom.querySelector('.glean-image')
    destroy(ctx)
    expect(img).toBeNull()
  })

  it('buffer stays byte-true through reveal flips', async () => {
    const doc0 = '![a](s.png)\nplain\n'
    const ctx = mount(doc0)
    await settle()
    caret(ctx, 0)
    await settle()
    caret(ctx, 4)
    await settle()
    caret(ctx, doc0.length)
    await settle()
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe(doc0)
  })
})
