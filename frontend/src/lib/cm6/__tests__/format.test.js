import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'
import { formatToggle } from '../keymaps'

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

function range(ctx, from, to) {
  ctx.view.dispatch({ selection: EditorSelection.range(from, to) })
}

function mod(ctx, key) {
  const e = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
  ctx.view.contentDOM.dispatchEvent(e)
  return e.defaultPrevented
}

describe('format toggles', () => {
  it('bold wraps the selection', () => {
    const ctx = mount('plain words')
    range(ctx, 6, 11)
    formatToggle(ctx.view, 'bold')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('plain **words**')
  })

  it('bold unwraps when the selection already sits inside a pair', () => {
    const ctx = mount('plain **words**')
    range(ctx, 8, 13)
    formatToggle(ctx.view, 'bold')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('plain words')
  })

  it('Mod-b and Mod-i toggle through the keymap', () => {
    const ctx = mount('word here')
    range(ctx, 0, 4)
    expect(mod(ctx, 'b')).toBe(true)
    const one = emitMarkdown(ctx.view)
    range(ctx, 2, 6)
    expect(mod(ctx, 'b')).toBe(true)
    const two = emitMarkdown(ctx.view)
    range(ctx, 0, 4)
    expect(mod(ctx, 'i')).toBe(true)
    const three = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(one).toBe('**word** here')
    expect(two).toBe('word here')
    expect(three).toBe('*word* here')
  })

  it('strike and code toggle', () => {
    const ctx = mount('text')
    range(ctx, 0, 4)
    formatToggle(ctx.view, 'strike')
    const one = emitMarkdown(ctx.view)
    range(ctx, 2, 6)
    formatToggle(ctx.view, 'code')
    const two = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(one).toBe('~~text~~')
    expect(two).toBe('~~`text`~~')
  })

  it('quote prefixes every selected line and removes one marker per line', () => {
    const ctx = mount('alpha\nbeta\n')
    range(ctx, 0, 8)
    formatToggle(ctx.view, 'quote')
    const one = emitMarkdown(ctx.view)
    // one toggle removes the > from every line in the selection
    range(ctx, 0, 14)
    formatToggle(ctx.view, 'quote')
    const two = emitMarkdown(ctx.view)
    // bullet on the second line only
    range(ctx, 7, 11)
    formatToggle(ctx.view, 'bullet')
    const three = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(one).toBe('> alpha\n> beta\n')
    expect(two).toBe('alpha\nbeta\n')
    expect(three).toBe('alpha\n- beta\n')
  })

  it('ordered lists number lines', () => {
    const ctx = mount('alpha\nbeta\n')
    range(ctx, 0, 10)
    formatToggle(ctx.view, 'ordered')
    const one = emitMarkdown(ctx.view)
    range(ctx, 0, 14)
    formatToggle(ctx.view, 'ordered')
    const two = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(one).toBe('1. alpha\n2. beta\n')
    expect(two).toBe('alpha\nbeta\n')
  })

  it('code fence wraps selected lines instead of replacing them', () => {
    const ctx = mount('keep me\nand me\n')
    range(ctx, 5, 12)
    formatToggle(ctx.view, 'codeblock')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('```\nkeep me\nand me\n```\n')
  })

  it('code fence with a caret inserts an empty block', () => {
    const ctx = mount('word\n')
    caret(ctx, 0)
    formatToggle(ctx.view, 'codeblock')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('```\n\n```\nword\n')
  })

  it('heading sets the requested level, h2 over h1 rewrites it', () => {
    const ctx = mount('Title\n')
    caret(ctx, 0)
    formatToggle(ctx.view, 'heading', 1)
    const one = emitMarkdown(ctx.view)
    caret(ctx, 2)
    formatToggle(ctx.view, 'heading', 2)
    const two = emitMarkdown(ctx.view)
    caret(ctx, 4)
    formatToggle(ctx.view, 'heading', 3)
    const three = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(one).toBe('# Title\n')
    expect(two).toBe('## Title\n')
    expect(three).toBe('### Title\n')
  })
})
