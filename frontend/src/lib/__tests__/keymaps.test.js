import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap as keymapFacet } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { gleanKeymaps } from '../extensions/keymaps'
import { history } from '@codemirror/commands'

function makeView(doc, cursor, prefs = {}) {
  const prefsRef = { current: { editor: { tab_width: 2, ...prefs } } }
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor != null ? cursor : doc.length },
    extensions: [
      history(),
      markdown({ base: markdownLanguage }),
      gleanKeymaps(prefsRef, {}),
    ],
  })
  return new EditorView({ state, parent: document.body })
}

// CM6 scans bindings in order and runs the first whose key matches and
// whose run returns true. Mirror that so markdownKeymap's Backspace
// (deleteMarkupBackward) falls through to glean's smart backspace.
function runKey(view, key) {
  for (const map of view.state.facet(keymapFacet)) {
    for (const binding of map) {
      if (binding.key !== key) continue
      if (binding.scope && !binding.scope(view.state)) continue
      if (binding.run(view)) return true
    }
  }
  return false
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('glean keymaps', () => {
  it('backspace removes a full tab-width of spaces at once', () => {
    const view = makeView('hello    world', 9, { tab_width: 4 })
    const ok = runKey(view, 'Backspace')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('helloworld')
    expect(view.state.selection.main.head).toBe(5)
  })

  it('backspace leaves single spaces alone', () => {
    const view = makeView('a  b', 3) // two spaces, tab_width 2
    const ok = runKey(view, 'Backspace')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('ab')
  })

  it('backspace does not touch a non-space char', () => {
    const view = makeView('ab', 1)
    const ok = runKey(view, 'Backspace')
    expect(ok).toBe(false) // falls through to default delete
  })

  it('tab indents the current line', () => {
    const view = makeView('hello', 2)
    const ok = runKey(view, 'Tab')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('  hello')
  })

  it('shift-tab outdents an indented line', () => {
    const view = makeView('    hello', 6)
    const ok = runKey(view, 'Shift-Tab')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('  hello')
  })

  it('tab navigates to the next table cell', () => {
    const view = makeView('| a | b |', 1)
    const ok = runKey(view, 'Tab')
    expect(ok).toBe(true)
    expect(view.state.selection.main.head).toBe(6) // start of 'b' cell
  })

  it('enter in a table inserts a new row', () => {
    const view = makeView('| a | b |', 1)
    const ok = runKey(view, 'Enter')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('| a | b |\n| Cell | Cell |')
  })
})