import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'
import { insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'

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

// drive typing through the real keydown path: a handled binding does the
// insert, an unhandled char falls back to replaceSelection the way the
// browser's own insertion would
function type(ctx, text) {
  for (const ch of text) {
    const event = new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })
    ctx.view.contentDOM.dispatchEvent(event)
    if (!event.defaultPrevented) {
      ctx.view.dispatch(ctx.view.state.replaceSelection(ch))
    }
  }
}

function key(ctx, k) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  ctx.view.contentDOM.dispatchEvent(event)
  return !event.defaultPrevented ? 'default' : 'handled'
}

const settle = (ms = 25) => new Promise((r) => setTimeout(r, ms))

describe('pair typing', () => {
  it('backtick pairs immediately with the caret inside', () => {
    const ctx = mount('')
    caret(ctx, 0)
    type(ctx, '`')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(doc).toBe('``')
    expect(pos).toBe(1)
  })

  it('a second backtick skips over the close, a third flows for fences', () => {
    const ctx = mount('')
    caret(ctx, 0)
    type(ctx, '`')
    type(ctx, '`')
    const after2 = emitMarkdown(ctx.view)
    const pos2 = ctx.view.state.selection.main.head
    type(ctx, '`')
    const after3 = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(after2).toBe('``')
    expect(pos2).toBe(2)
    expect(after3).toBe('```')
  })

  it('content between ticks closes by skipping over', () => {
    const ctx = mount('')
    type(ctx, '`')
    type(ctx, 'code')
    const docBefore = emitMarkdown(ctx.view)
    type(ctx, '`')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(docBefore).toBe('`code`')
    expect(doc).toBe('`code`')
    expect(pos).toBe(6)
  })

  it('single asterisk is literal, doubled completes with the caret inside', () => {
    const ctx = mount('hi ')
    caret(ctx, 3)
    type(ctx, '*')
    const one = emitMarkdown(ctx.view)
    type(ctx, '*')
    const two = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(one).toBe('hi *')
    expect(two).toBe('hi ****')
    expect(pos).toBe(5)
  })

  it('selection wraps and stays selected: ** builds from two wraps', () => {
    const ctx = mount('word')
    ctx.view.dispatch({ selection: EditorSelection.range(0, 4) })
    type(ctx, '*')
    const one = emitMarkdown(ctx.view)
    const sel1 = ctx.view.state.selection.main
    type(ctx, '*')
    const two = emitMarkdown(ctx.view)
    const sel2 = ctx.view.state.selection.main
    destroy(ctx)
    expect(one).toBe('*word*')
    expect(sel1.from).toBe(1)
    expect(sel1.to).toBe(5)
    expect(two).toBe('**word**')
    expect(sel2.from).toBe(2)
    expect(sel2.to).toBe(6)
  })

  it('backspace between a fresh pair deletes both halves', () => {
    const ctx = mount('')
    type(ctx, '**')
    const before = emitMarkdown(ctx.view)
    caret(ctx, 2)
    key(ctx, 'Backspace')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(before).toBe('****')
    expect(doc).toBe('')
  })

  it('single tildes stay literal around subscript text', () => {
    const ctx = mount('H')
    caret(ctx, 1)
    type(ctx, '~2~O')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('H~2~O')
  })

  it('brackets build the starline shape across two keystrokes', () => {
    const ctx = mount('')
    type(ctx, '[')
    const one = emitMarkdown(ctx.view)
    const pos1 = ctx.view.state.selection.main.head
    type(ctx, '[')
    const two = emitMarkdown(ctx.view)
    const pos2 = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(one).toBe('[')
    expect(pos1).toBe(1)
    expect(two).toBe('[[]]')
    expect(pos2).toBe(2)
  })

  it('a pair keystroke right after a closed span flows literal', () => {
    const ctx = mount('*bold*')
    caret(ctx, 6)
    type(ctx, '*')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('*bold**')
  })

  it('underscore after a closed span flows literal too', () => {
    const ctx = mount('_ital_')
    caret(ctx, 6)
    type(ctx, '_')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('_ital__')
  })

  it('tilde after a closed strike flows literal', () => {
    const ctx = mount('~~x~~')
    caret(ctx, 5)
    type(ctx, '~')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('~~x~~~')
  })

  it('a backtick after closed inline code stays literal', () => {
    const ctx = mount('`code`')
    caret(ctx, 6)
    type(ctx, '`')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('`code``')
  })

  it('a bracket after a finished starline does not feed the old span', () => {
    const ctx = mount('[[note]]')
    caret(ctx, 8)
    type(ctx, '[')
    const one = emitMarkdown(ctx.view)
    type(ctx, '[')
    const two = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(one).toBe('[[note]][')
    expect(two).toBe('[[note]][[]]')
    expect(pos).toBe(10)
  })

  it('pair chars are inert inside fenced code', async () => {
    const ctx = mount('```\n\n```\n')
    await settle()
    caret(ctx, 4)
    type(ctx, '*')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('```\n*\n```\n')
  })
})

describe('heading editing', () => {
  it('hash after the mark bumps the level', () => {
    const ctx = mount('# Title\n')
    caret(ctx, 2)
    type(ctx, '#')
    const doc = emitMarkdown(ctx.view)
    const pos = ctx.view.state.selection.main.head
    destroy(ctx)
    expect(doc).toBe('## Title\n')
    expect(pos).toBe(3)
  })

  it('hash inside heading text is content', () => {
    const ctx = mount('# Title\n')
    caret(ctx, 4)
    type(ctx, '#')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('# Ti#tle\n')
  })

  it('backspace at the text start demotes one level', () => {
    const ctx = mount('## Title\n')
    caret(ctx, 3)
    key(ctx, 'Backspace')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('# Title\n')
  })

  it('backspace on a level-1 heading drops to a paragraph', () => {
    const ctx = mount('# Title\n')
    caret(ctx, 2)
    key(ctx, 'Backspace')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('Title\n')
  })
})

describe('list and quote continuation', () => {
  it('Enter continues a list item', async () => {
    const ctx = mount('- item one\n')
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).to)
    expect(insertNewlineContinueMarkup(ctx.view)).toBe(true)
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('- item one\n- \n')
  })

  it('Enter on an empty item exits the list', async () => {
    const ctx = mount('- \n')
    await settle()
    caret(ctx, 2)
    expect(insertNewlineContinueMarkup(ctx.view)).toBe(true)
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('\n')
  })

  it('Enter continues a quote', async () => {
    const ctx = mount('> said\n')
    await settle()
    caret(ctx, ctx.view.state.doc.line(1).to)
    expect(insertNewlineContinueMarkup(ctx.view)).toBe(true)
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('> said\n> \n')
  })

  it('Backspace at the item text start removes the marker', async () => {
    const ctx = mount('- item\n')
    await settle()
    caret(ctx, 2)
    expect(deleteMarkupBackward(ctx.view)).toBe(true)
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('item\n')
  })

  it('Tab indents a list item two spaces', async () => {
    const ctx = mount('- item\n')
    caret(ctx, 4)
    expect(key(ctx, 'Tab')).toBe('handled')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('  - item\n')
  })
})

describe('byte truth under typing', () => {
  it('the whole interaction loop leaves the buffer exact', async () => {
    const ctx = mount('# H\n')
    await settle()
    caret(ctx, 3)
    type(ctx, 'i')
    caret(ctx, ctx.view.state.doc.length)
    key(ctx, 'Enter')
    type(ctx, '- ')
    key(ctx, 'Tab')
    type(ctx, 'x')
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(doc).toBe('# Hi\n\n  - x')
  })
})
