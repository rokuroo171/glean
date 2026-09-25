import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'
import { highlightTheme } from '../highlight'

function themeCss(theme) {
  return theme[1].value.rules
}

const INLINE_MARK_CLASSES = ['glean-syntax-revealed', 'glean-hl']
const BANNED = ['font-size', 'margin', 'padding', 'line-height', 'width']

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

// all replace-decorated ranges currently in the view, from the DOM
function hiddenRanges(view) {
  return [...view.dom.querySelectorAll('.cm-replace')].map((w) => {
    const r = document.createRange()
    r.selectNodeContents(w)
    return null
  })
}

describe('highlight layer', () => {
  it('delimiters collapse away from the caret and the content is marked', async () => {
    const ctx = mount('text ==hl== more\n')
    await settle()
    caret(ctx, 0)
    await settle()
    const away = emitMarkdown(ctx.view)
    const line = ctx.view.dom.querySelector('.cm-line')
    const marked = ctx.view.dom.querySelectorAll('.glean-hl').length
    destroy(ctx)
    expect(away).toBe('text ==hl== more\n') // buffer untouched
    expect(line.textContent).toBe('text hl more')
    expect(marked).toBe(1)
  })

  it('the caret entering the line reveals the raw delimiters dimmed', async () => {
    const ctx = mount('text ==hl== more\n')
    await settle()
    caret(ctx, 6) // inside the span
    await settle()
    const revealed = ctx.view.dom.querySelectorAll('.glean-syntax-revealed').length
    const marked = ctx.view.dom.querySelectorAll('.glean-hl').length
    const replaces = ctx.view.dom.querySelectorAll('.cm-replace').length
    destroy(ctx)
    expect(revealed).toBeGreaterThanOrEqual(2)
    expect(marked).toBe(0)
    expect(replaces).toBe(0)
  })

  it('a caret on a neighboring line keeps the delimiters collapsed', async () => {
    const ctx = mount('==a==\nplain\n==b==\n')
    await settle()
    caret(ctx, ctx.view.state.doc.line(2).from)
    await settle()
    const lines = [...ctx.view.dom.querySelectorAll('.cm-line')].map((l) => l.textContent).slice(0, 3)
    const marked = ctx.view.dom.querySelectorAll('.glean-hl').length
    destroy(ctx)
    expect(lines).toEqual(['a', 'plain', 'b'])
    expect(marked).toBe(2)
  })

  it('multiple spans on one line pair in order', async () => {
    const ctx = mount('==a== b ==c==\n')
    await settle()
    caret(ctx, ctx.view.state.doc.length)
    await settle()
    const marked = ctx.view.dom.querySelectorAll('.glean-hl').length
    destroy(ctx)
    expect(marked).toBe(2)
  })

  it('buffer stays byte-true through every reveal flip', async () => {
    const ctx = mount('a ==x== b\n==y==\n')
    await settle()
    const original = emitMarkdown(ctx.view)
    caret(ctx, 0)
    await settle()
    caret(ctx, 3)
    await settle()
    caret(ctx, ctx.view.state.doc.length)
    await settle()
    const doc = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(original).toBe('a ==x== b\n==y==\n')
    expect(doc).toBe(original)
  })

  it('the highlight mark styles color only, no inline geometry', () => {
    const rules = themeCss(highlightTheme)
    const offenders = []
    for (const rule of rules) {
      const brace = rule.indexOf('{')
      if (brace < 0) continue
      const sel = rule.slice(0, brace)
      if (!INLINE_MARK_CLASSES.some((c) => sel.includes(c))) continue
      const body = rule.slice(brace)
      for (const b of BANNED) {
        if (body.includes(b)) offenders.push(`${sel.trim()}: ${b}`)
        if (b === 'padding' && body.includes('padding: 0')) continue
      }
    }
    expect(offenders).toEqual([])
  })
})
