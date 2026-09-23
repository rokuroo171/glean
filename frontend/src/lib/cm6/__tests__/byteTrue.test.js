import { describe, it, expect, vi } from 'vitest'
import { undoDepth } from '@codemirror/commands'
import { createEditor, loadMarkdown, emitMarkdown, editorTheme, styleCompartment, wrapCompartment } from '../editor'

function mount(initial) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = createEditor({ parent, markdown: initial })
  return { view, parent }
}

function destroy(view, parent) {
  view.destroy()
  parent.remove()
}

const CR = '\r\n'

const FIXTURES = [
  ['empty', ''],
  ['plain paragraph', 'Just a plain note body.\n'],
  ['crlf line endings', `First${CR}Second${CR}Third${CR}`],
  ['lf no trailing newline', 'No newline at the end'],
  ['trailing spaces', 'Keeps trailing spaces   \nSecond line\t\n'],
  ['bullet star', '* star list\n* second item\n'],
  ['bullet dash', '- dash list\n- second item\n'],
  ['ordered list', '1. first\n2. second\n10. tenth\n'],
  ['setext heading', 'Setext Title\n=============\n'],
  ['reference link definitions', 'See [the docs][docs] today.\n\n[docs]: https://example.com "Docs"\n'],
  ['raw html block', '<div class="note">\n  <p>inside</p>\n</div>\n'],
  ['html comment block', '<!-- a note to no one -->\n'],
  ['single tilde chemistry', 'Water is H~2~O and stays that way.\n'],
  ['double tilde strike', 'This is ~~gone~~ text.\n'],
  ['highlight mark', 'This is ==lit up== text.\n'],
  ['starline', 'See [[Morning Pages]] when you wake.\n'],
  ['footnote', 'A claim.[^1]\n\n[^1]: The support.\n'],
  ['fenced code crlf inside', '```js' + CR + 'const a = 1;' + CR + '```' + CR],
  ['blockquote with alert', '> [!NOTE]\n> useful text\n'],
  ['table with alignment', '| a | b |\n| :-- | --: |\n| 1 | 2 |\n'],
  ['task list', '- [x] done\n- [ ] todo\n'],
]

describe('byte-true load and emit', () => {
  for (const [name, md] of FIXTURES) {
    it(`round-trips ${name}`, () => {
      const { view, parent } = mount(md)
      const out = emitMarkdown(view)
      destroy(view, parent)
      expect(out).toBe(md)
    })
  }

  it('reloads a new note outside undo history', () => {
    const { view, parent } = mount('First note\n')
    view.dispatch({ changes: { from: 0, insert: 'typed ' } })
    expect(undoDepth(view.state)).toBeGreaterThan(0)
    loadMarkdown(view, 'Second note\n')
    expect(undoDepth(view.state)).toBe(0)
    expect(emitMarkdown(view)).toBe('Second note\n')
    destroy(view, parent)
  })

  it('emits once per user edit and never on style reconfigure', () => {
    const onMarkdownChange = vi.fn()
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = createEditor({ parent, markdown: 'A\n', onMarkdownChange })
    view.dispatch({ changes: { from: 1, insert: 'B' } })
    expect(onMarkdownChange).toHaveBeenCalledWith('AB\n')
    onMarkdownChange.mockClear()
    view.dispatch({ effects: styleCompartment.reconfigure(editorTheme('serif', 18, 2)) })
    view.dispatch({ effects: wrapCompartment.reconfigure([]) })
    expect(onMarkdownChange).not.toHaveBeenCalled()
    expect(emitMarkdown(view)).toBe('AB\n')
    destroy(view, parent)
  })
})
