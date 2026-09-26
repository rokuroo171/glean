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

async function settle(ms = 40) {
  await new Promise((r) => setTimeout(r, ms))
}

function caret(ctx, pos) {
  ctx.view.dispatch({ selection: EditorSelection.cursor(pos) })
}

const settleMs = (ms = 30) => new Promise((r) => setTimeout(r, ms))

describe('task checkboxes', () => {
  it('renders a checked box for [x] and unchecked for [ ]', async () => {
    const ctx = mount('- [x] done\n- [ ] not done\n')
    await settle()
    const boxes = [...ctx.view.dom.querySelectorAll('.glean-taskbox [role=checkbox]')]
    destroy(ctx)
    expect(boxes.length).toBe(2)
    expect(boxes[0].getAttribute('aria-checked')).toBe('true')
    expect(boxes[1].getAttribute('aria-checked')).toBe('false')
  })

  it('click toggles the buffer x to space and back', async () => {
    const ctx = mount('- [x] done\n')
    await settle()
    const box = ctx.view.dom.querySelector('.glean-taskbox [role=checkbox]')
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settleMs()
    const afterToggle = emitMarkdown(ctx.view)
    const box2 = ctx.view.dom.querySelector('.glean-taskbox [role=checkbox]')
    box2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await settleMs()
    const afterTwice = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(afterToggle).toBe('- [ ] done\n')
    expect(afterTwice).toBe('- [x] done\n')
  })

  it('stays byte-true with tasks present', async () => {
    const ctx = mount('- [x] a\n- [ ] b\n')
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe('- [x] a\n- [ ] b\n')
  })

  it('marks exactly the checked task lines as done', async () => {
    const ctx = mount('- [x] done\n- [X] capital\n- [ ] open\n  - [x] nested done\n')
    await settle()
    // the strike itself is computed-style cascading, which jsdom does not
    // do for CM6 theme classes; the class carries the style and is what
    // the live probe measured line-through on
    const rows = [...ctx.view.dom.querySelectorAll('.cm-line')]
      .filter((l) => l.querySelector('.glean-taskbox'))
      .map((l) => l.className.includes('glean-task-done'))
    destroy(ctx)
    expect(rows).toEqual([true, true, false, true])
  })

  it('strikes a checked task inside a blockquote', async () => {
    const ctx = mount('> - [x] quoted\n> - [ ] open\n')
    await settle()
    const rows = [...ctx.view.dom.querySelectorAll('.cm-line')]
      .filter((l) => l.querySelector('.glean-taskbox'))
      .map((l) => l.className.includes('glean-task-done'))
    destroy(ctx)
    expect(rows).toEqual([true, false])
  })
})

describe('alerts', () => {
  it('tints the callout and adds the header widget away from the caret', async () => {
    const ctx = mount('> [!NOTE]\n> useful text\n\n> plain quote\n')
    await settle()
    const alertLines = ctx.view.dom.querySelectorAll('.cm-line.glean-alert-line')
    const headers = ctx.view.dom.querySelectorAll('.glean-alert-head')
    destroy(ctx)
    expect(alertLines.length).toBe(1)
    expect(alertLines[0].getAttribute('data-kind')).toBe('note')
    expect(headers.length).toBe(1)
    expect(headers[0].textContent).toBe('Note')
  })

  it('plain quotes get no alert chrome', async () => {
    const ctx = mount('> plain\n')
    await settle()
    const headers = ctx.view.dom.querySelectorAll('.glean-alert-head')
    destroy(ctx)
    expect(headers.length).toBe(0)
  })

  it('caret on the declaration reveals the raw marker and hides the widget', async () => {
    const ctx = mount('> [!WARNING]\n> text\n')
    await settle()
    caret(ctx, 4)
    await settleMs()
    const headers = ctx.view.dom.querySelectorAll('.glean-alert-head')
    destroy(ctx)
    expect(headers.length).toBe(0)
  })

  it('stays byte-true with alerts present', async () => {
    const ctx = mount('> [!TIP]\n> advice\n')
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe('> [!TIP]\n> advice\n')
  })
})

describe('fence chips', () => {
  it('collapses the marks and chips the language away from the caret', async () => {
    const ctx = mount('```js\nlet x = 1\n```\n')
    await settle()
    const chips = ctx.view.dom.querySelectorAll('.glean-fence-chip')
    destroy(ctx)
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('js')
  })

  it('caret on the info word shows the raw language', async () => {
    const ctx = mount('```js\nlet x = 1\n```\n')
    await settle()
    caret(ctx, 4)
    await settleMs()
    const chips = ctx.view.dom.querySelectorAll('.glean-fence-chip')
    destroy(ctx)
    expect(chips.length).toBe(0)
  })

  it('stays byte-true with fences present', async () => {
    const src = '```python\nprint(1)\n```\n'
    const ctx = mount(src)
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe(src)
  })
})

describe('math', () => {
  it('renders display math away from the caret', async () => {
    const ctx = mount('$$\nE = mc^2\n$$\n')
    await settle()
    await settleMs(120)
    caret(ctx, ctx.view.state.doc.length)
    await settleMs(40)
    const blocks = ctx.view.dom.querySelectorAll('.glean-math-block')
    destroy(ctx)
    expect(blocks.length).toBe(1)
  })

  it('renders inline math and leaves currency literal', async () => {
    const ctx = mount('Energy: $E=mc^2$ and 5$ and 6$ dollars\n')
    await settle()
    await settleMs(120)
    const inline = [...ctx.view.dom.querySelectorAll('.glean-math-inline')]
    destroy(ctx)
    expect(inline.length).toBe(1)
  })

  it('caret inside shows the raw tex', async () => {
    const ctx = mount('$E=mc^2$ rest\n')
    await settle()
    caret(ctx, 3)
    await settleMs()
    const inline = ctx.view.dom.querySelectorAll('.glean-math-inline')
    destroy(ctx)
    expect(inline.length).toBe(0)
  })

  it('stays byte-true with math present', async () => {
    const src = '$$\\int x dx$$ and $a+b$\n'
    const ctx = mount(src)
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe(src)
  })
})

describe('mermaid', () => {
  it('mounts a diagram box under the fence', async () => {
    const ctx = mount('```mermaid\ngraph TD\nA-->B\n```\n')
    await settle()
    const boxes = ctx.view.dom.querySelectorAll('.glean-mermaid')
    destroy(ctx)
    expect(boxes.length).toBe(1)
  })

  it('non-mermaid fences get none', async () => {
    const ctx = mount('```js\nconst a = 1\n```\n')
    await settle()
    const boxes = ctx.view.dom.querySelectorAll('.glean-mermaid')
    destroy(ctx)
    expect(boxes.length).toBe(0)
  })

  it('stays byte-true with a mermaid fence', async () => {
    const src = '```mermaid\ngraph TD\nA-->B\n```\n'
    const ctx = mount(src)
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe(src)
  })
})
