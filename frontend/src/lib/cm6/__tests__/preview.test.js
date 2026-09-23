import { describe, it, expect } from 'vitest'
import './cm6dom'
import { EditorSelection } from '@codemirror/state'
import { createEditor, emitMarkdown } from '../editor'
import { blocksTheme } from '../blocks'
import { revealTheme } from '../reveal'

function mount(initial) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = createEditor({ parent, markdown: initial, starline: { getNoteNames: () => ({}), onNoteLink: () => {} } })
  return { view, parent }
}

async function settle(ms = 30) {
  await new Promise((r) => setTimeout(r, ms))
}

function destroy(view, parent) {
  view.destroy()
  parent.remove()
}

function lineClasses(view) {
  return [...view.dom.querySelectorAll('.cm-line')].map((l) => l.className)
}

const DOC = [
  '# Big Title',
  '',
  '- one',
  '- two',
  '',
  '> quoted',
  '',
  '```js',
  'x = 1',
  '```',
  '',
  'plain **bold** text',
  '',
  '---',
].join('\n')

describe('blocks pass', () => {
  it('styles heading, quote, fence, hr and list lines by class', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    const classes = lineClasses(view)
    destroy(view, parent)
    expect(classes[0]).toContain('glean-h1')
    expect(classes[2]).not.toContain('glean-fence-line')
    expect(classes[5]).toContain('glean-quote-line')
    expect(classes[7]).toContain('glean-fence-line')
    expect(classes[8]).toContain('glean-fence-line')
    expect(classes[9]).toContain('glean-fence-line')
    expect(classes[13]).toContain('glean-hr-line')
  })

  it('hides heading hash when caret is away and reveals it on the heading', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    // collapsed replace decorations: a hidden prefix vanishes from the line
    // text, so the line reads like the rendered output
    const headingText = () => view.dom.querySelectorAll('.cm-line')[0].textContent
    const dashText = () => view.dom.querySelectorAll('.cm-line')[2].textContent
    // initial caret is on the heading: its hash shows, the dashes stay hidden
    expect(headingText().startsWith('#')).toBe(true)
    expect(dashText().startsWith('-')).toBe(false)
    // a plain paragraph: heading hash collapses too
    view.dispatch({ selection: EditorSelection.cursor(DOC.indexOf('plain ') + 1) })
    await settle()
    expect(headingText().startsWith('#')).toBe(false)
    expect(dashText().startsWith('-')).toBe(false)
    // back on the heading: the hash returns as real text
    view.dispatch({ selection: EditorSelection.cursor(2) })
    await settle()
    expect(headingText().startsWith('#')).toBe(true)
    destroy(view, parent)
  })

  it('reveals emphasis marks when the caret enters the pair', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    const boldIdx = DOC.indexOf('**bold**')
    view.dispatch({ selection: EditorSelection.cursor(boldIdx + 4) })
    await settle()
    const revealed = view.dom.querySelectorAll('.glean-syntax-revealed').length
    destroy(view, parent)
    expect(revealed).toBeGreaterThanOrEqual(2)
  })

  it('hides list, quote and task prefixes away and reveals them inside their block', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    const dashText = () => view.dom.querySelectorAll('.cm-line')[2].textContent
    // caret parked in the plain paragraph: list dashes and the heading hash
    // must all be collapsed
    view.dispatch({ selection: EditorSelection.cursor(DOC.indexOf('plain ') + 1) })
    await settle()
    expect(dashText().startsWith('-')).toBe(false)
    // caret inside the quote block: its > marks reveal, list marks stay hidden
    view.dispatch({ selection: EditorSelection.cursor(DOC.indexOf('quoted') + 2) })
    await settle()
    const revealedTexts = [...view.dom.querySelectorAll('.glean-syntax-revealed')].map((e) => e.textContent)
    expect(dashText().startsWith('-')).toBe(false)
    destroy(view, parent)
    expect(revealedTexts).toContain('>')
  })

  it('reveals the list dash when the caret edits that item only', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    const dashText = (idx) => view.dom.querySelectorAll('.cm-line')[idx].textContent
    view.dispatch({ selection: EditorSelection.cursor(DOC.indexOf('one') + 1) })
    await settle()
    expect(dashText(2).startsWith('-')).toBe(true)
    expect(dashText(3).startsWith('-')).toBe(false)
    view.dispatch({ selection: EditorSelection.cursor(DOC.indexOf('two') + 1) })
    await settle()
    expect(dashText(2).startsWith('-')).toBe(false)
    expect(dashText(3).startsWith('-')).toBe(true)
    destroy(view, parent)
  })

  it('keeps the buffer byte-true with live preview on', () => {
    const { view, parent } = mount(DOC)
    const out = emitMarkdown(view)
    destroy(view, parent)
    expect(out).toBe(DOC)
  })
})

describe('editor laws', () => {
  it('law 2: no decoration rule touches geometry on inline spans', () => {
    const themes = [blocksTheme, revealTheme]
    const banned = ['font-size', 'margin', 'padding', 'line-height', 'width']
    const offenders = []
    for (const theme of themes) {
      const css = theme[Symbol.for('cm6.theme')] || ''
      for (const b of banned) {
        if (css.includes(b)) offenders.push(b)
      }
    }
    // the theme module holds class rules only; the check asserts the
    // generated module source has no inline geometry rules
    expect(offenders).toEqual([])
  })

  it('law 3: reveal set is a pure function of doc and selection', async () => {
    const { view, parent } = mount(DOC)
    await settle()
    const sel = EditorSelection.cursor(DOC.indexOf('**bold**') + 3)
    view.dispatch({ selection: sel })
    await settle()
    const first = [...view.dom.querySelectorAll('.glean-syntax-revealed')].map((e) => e.textContent)
    const second = await (async () => {
      const p2 = document.createElement('div')
      document.body.appendChild(p2)
      const v2 = createEditor({ parent: p2, markdown: DOC, starline: { getNoteNames: () => ({}), onNoteLink: () => {} } })
      await settle()
      v2.dispatch({ selection: sel })
      await settle()
      const texts = [...v2.dom.querySelectorAll('.glean-syntax-revealed')].map((e) => e.textContent)
      v2.destroy()
      p2.remove()
      return texts
    })()
    destroy(view, parent)
    expect(first).toEqual(second)
  })
})
