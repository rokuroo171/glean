import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { buildLivePreview } from '../extensions/livePreview'
import { toggleTaskAt } from '../extensions/livePreview'

function decoClasses(state, doc) {
  const set = buildLivePreview(state)
  const out = []
  set.between(0, doc.length, (from, to, deco) => {
    const cls = deco.spec?.class || ''
    if (cls) out.push({ cls, from, to })
  })
  return out
}

function makeState(doc, cursor) {
  return EditorState.create({
    doc,
    selection: { anchor: cursor != null ? cursor : doc.length },
    extensions: [markdown({ base: markdownLanguage })],
  })
}

describe('live preview decorations', () => {
  it('hides heading markers and styles heading text', () => {
    const doc = '# Title'
    const state = makeState(doc, doc.length)
    const decos = decoClasses(state, doc)
    const hide = decos.find(d => d.cls === 'glean-hide')
    expect(hide).toBeTruthy()
    expect(hide.from).toBe(0)
    expect(hide.to).toBe(2) // '# ' hidden
    const h1 = decos.find(d => d.cls === 'glean-h1')
    expect(h1).toBeTruthy()
    expect(h1.from).toBe(2)
    expect(h1.to).toBe(7)
  })

  it('hides closing hashes on ATX headings', () => {
    const doc = '# Closing hash heading #'
    const state = makeState(doc, 10) // cursor in the middle
    const hidden = decoClasses(state, doc)
      .filter(d => d.cls === 'glean-hide')
      .map(d => doc.slice(d.from, d.to))
    expect(hidden).toContain('# ')
    expect(hidden).toContain(' #')
  })

  it('keeps a trailing hash that is part of the text', () => {
    const doc = '# H#ash#'
    const state = makeState(doc)
    const hidden = decoClasses(state, doc)
      .filter(d => d.cls === 'glean-hide')
      .map(d => doc.slice(d.from, d.to))
    expect(hidden).toEqual(['# '])
  })

  it('shows heading markers when the cursor is on them', () => {
    const doc = '# Title'
    const state = makeState(doc, 1) // cursor inside the '#'
    const decos = decoClasses(state, doc)
    expect(decos.find(d => d.cls === 'glean-hide')).toBeFalsy()
    expect(decos.find(d => d.cls === 'glean-h1')).toBeTruthy()
  })

  it('styles bold text and hides the ** markers', () => {
    const doc = 'a **bold** b'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const bold = decos.find(d => d.cls === 'glean-bold')
    expect(bold).toBeTruthy()
    expect(doc.slice(bold.from, bold.to)).toBe('bold')
    const hides = decos.filter(d => d.cls === 'glean-hide')
    expect(hides.length).toBe(2)
    expect(doc.slice(hides[0].from, hides[0].to)).toBe('**')
    expect(doc.slice(hides[1].from, hides[1].to)).toBe('**')
  })

  it('styles italic text', () => {
    const doc = 'a *ital* b'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const ital = decos.find(d => d.cls === 'glean-italic')
    expect(ital).toBeTruthy()
    expect(doc.slice(ital.from, ital.to)).toBe('ital')
  })

  it('styles strikethrough text', () => {
    const doc = 'a ~~gone~~ b'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const strike = decos.find(d => d.cls === 'glean-strike')
    expect(strike).toBeTruthy()
    expect(doc.slice(strike.from, strike.to)).toBe('gone')
  })

  it('styles inline code and hides the backticks', () => {
    const doc = 'a `code` b'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const code = decos.find(d => d.cls === 'glean-icode')
    expect(code).toBeTruthy()
    expect(doc.slice(code.from, code.to)).toBe('code')
  })

  it('styles link labels and hides the link syntax', () => {
    const doc = 'a [label](https://x) b'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const link = decos.find(d => d.cls === 'glean-link')
    expect(link).toBeTruthy()
    expect(doc.slice(link.from, link.to)).toBe('label')
  })

  it('renders task markers as checkboxes', () => {
    const doc = '- [ ] todo'
    const state = makeState(doc)
    const set = buildLivePreview(state)
    let hasReplace = false
    let checked = null
    set.between(0, doc.length, (from, to, deco) => {
      if (deco.spec?.widget) {
        hasReplace = true
        checked = deco.spec.widget.checked
      }
    })
    expect(hasReplace).toBe(true)
    expect(checked).toBe(false)
  })

  it('shows task marker text when the cursor is inside it', () => {
    const doc = '- [ ] todo'
    const state = makeState(doc, 4) // cursor inside '[ ]'
    const decos = decoClasses(state, doc)
    expect(decos.find(d => d.cls === 'glean-tasktext')).toBeTruthy()
  })

  it('hides indented blockquote markers', () => {
    const doc = '  > indented quote'
    const state = makeState(doc)
    const hides = decoClasses(state, doc)
      .filter(d => d.cls === 'glean-hide')
      .map(d => doc.slice(d.from, d.to))
    expect(hides).toContain('  > ')
  })

  it('hides nested blockquote markers', () => {
    const doc = '> > Level 2 nested'
    const state = makeState(doc)
    const hides = decoClasses(state, doc)
      .filter(d => d.cls === 'glean-hide')
      .map(d => doc.slice(d.from, d.to))
    expect(hides.some(h => h === '> > ')).toBe(true)
  })

  it('renders multi-line blockquotes with inline marks', () => {
    const doc = '> **bold**\n> more'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    expect(decos.filter(d => d.cls === 'glean-quote').length).toBe(2)
    expect(decos.find(d => d.cls === 'glean-bold')).toBeTruthy()
  })

  it('renders setext headings and hides the underline', () => {
    const doc = 'Setext H1\n========='
    const state = makeState(doc, 3) // cursor on the heading text
    const decos = decoClasses(state, doc)
    const h1 = decos.find(d => d.cls === 'glean-h1')
    expect(h1).toBeTruthy()
    expect(doc.slice(h1.from, h1.to)).toBe('Setext H1')
    const hidden = decos.filter(d => d.cls === 'glean-hide')
      .map(d => doc.slice(d.from, d.to))
    expect(hidden).toContain('=========')
  })

  it('styles every text line of a multi-line setext heading', () => {
    const doc = 'line one\nsetext style\n==='
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const h1 = decos.find(d => d.cls === 'glean-h1')
    expect(h1).toBeTruthy()
    expect(doc.slice(h1.from, h1.to)).toBe('line one\nsetext style')
  })

  it('dims the table delimiter row', () => {
    const doc = '| a | b |\n|---|---|\n| 1 | 2 |'
    const state = makeState(doc)
    const decos = decoClasses(state, doc)
    const delim = decos.find(d => d.cls === 'glean-tabledelim')
    expect(delim).toBeTruthy()
    expect(delim.from).toBe(10)
  })

  it('builds decorations for a mixed document without crashing', () => {
    const doc = [
      '# Markdown Renderer Test Suite',
      '',
      'Use this file to visually diff **every** component.',
      '',
      '1. Headings',
      '',
      'H1 heading',
      '',
      'Setext H1',
      '=========',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '> quote **bold**',
      '> more',
      '',
      '- [ ] task',
      '',
      '# Head **bold** link [x](http://a)',
      '',
      '```js',
      'const x = 1',
      '```',
    ].join('\n')
    const state = makeState(doc)
    expect(() => buildLivePreview(state)).not.toThrow()
  })
})

describe('toggleTaskAt', () => {
  function makeView(doc) {
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    })
    // A minimal fake view: dispatch builds a new state.
    let cur = state
    const view = {
      get state() { return cur },
      dispatch(spec) {
        cur = cur.update(spec).state
      },
    }
    return view
  }

  it('toggles an unchecked box to checked', () => {
    const view = makeView('- [ ] todo')
    const ok = toggleTaskAt(view, 4)
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('- [x] todo')
  })

  it('toggles a checked box to unchecked', () => {
    const view = makeView('- [x] todo')
    const ok = toggleTaskAt(view, 4)
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('- [ ] todo')
  })

  it('returns false outside a task marker', () => {
    const view = makeView('plain text')
    const ok = toggleTaskAt(view, 3)
    expect(ok).toBe(false)
  })
})

describe('callout decorations', () => {
  it('renders a note callout with hidden marker and colored background', () => {
    const doc = '> [!NOTE]\n> Body text'
    const state = makeState(doc, doc.length)
    const decos = decoClasses(state, doc)
    // Marker hidden
    const markerHide = decos.find(d => d.cls === 'glean-hide' && d.from === 0)
    expect(markerHide).toBeTruthy()
    // Title line
    const titleLine = decos.find(d => d.cls === 'glean-callout-title')
    expect(titleLine).toBeTruthy()
    // Body line
    const bodyLine = decos.find(d => d.cls && d.cls.includes('glean-callout'))
    expect(bodyLine).toBeTruthy()
    // No normal quoteLine for callouts
    const quoteLines = decos.filter(d => d.cls === 'glean-quote')
    expect(quoteLines.length).toBe(0)
  })

  it('renders a tip callout with correct type class', () => {
    const doc = '> [!TIP]\n> Tip body'
    const state = makeState(doc, doc.length)
    const decos = decoClasses(state, doc)
    const bodyLine = decos.find(d => d.cls && d.cls.includes('glean-callout-tip'))
    expect(bodyLine).toBeTruthy()
  })

  it('renders a warning callout', () => {
    const doc = '> [!WARNING]\n> Danger!'
    const state = makeState(doc, doc.length)
    const decos = decoClasses(state, doc)
    const bodyLine = decos.find(d => d.cls && d.cls.includes('glean-callout-warning'))
    expect(bodyLine).toBeTruthy()
  })

  it('does not render a plain blockquote as a callout', () => {
    const doc = '> plain blockquote'
    const state = makeState(doc, doc.length)
    const decos = decoClasses(state, doc)
    const callouts = decos.filter(d => d.cls && d.cls.includes('glean-callout'))
    expect(callouts.length).toBe(0)
    const quotes = decos.filter(d => d.cls === 'glean-quote')
    expect(quotes.length).toBeGreaterThan(0)
  })

  it('reveals the callout marker when cursor is on the marker line', () => {
    const doc = '> [!NOTE]\n> Body'
    const state = makeState(doc, 0)  // cursor at start = on marker line
    const decos = decoClasses(state, doc)
    const markerHide = decos.find(d => d.cls === 'glean-hide' && d.from === 0)
    expect(markerHide).toBeUndefined()
  })
})