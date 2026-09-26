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

const TABLE = '| a | b |\n| --- | ---: |\n| 1 | 2 |\n'

describe('table grid', () => {
  it('renders a grid widget over the table away from the caret', async () => {
    const ctx = mount('before\n\n' + TABLE + '\nafter\n')
    await settle()
    const grid = ctx.view.dom.querySelector('.glean-table')
    const ths = [...(grid ? grid.querySelectorAll('th') : [])]
    const tds = [...(grid ? grid.querySelectorAll('td') : [])]
    destroy(ctx)
    expect(grid).not.toBeNull()
    expect(ths.map((t) => t.textContent)).toEqual(['a', 'b'])
    expect(tds.map((t) => t.textContent)).toEqual(['1', '2'])
    // alignment from the delimiter row rides the cells
    expect(ths[1].style.textAlign).toBe('right')
  })

  it('dissolves to raw pipes when the caret is inside the table', async () => {
    const ctx = mount('before\n\n' + TABLE + '\nafter\n')
    await settle()
    expect(ctx.view.dom.querySelector('.glean-table')).not.toBeNull()
    const at = ctx.view.state.doc.toString().indexOf('| 1 |')
    ctx.view.dispatch({ selection: EditorSelection.cursor(at + 2) })
    await settle()
    const grid = ctx.view.dom.querySelector('.glean-table')
    const raw = ctx.view.dom.textContent.includes('| 1 | 2 |')
    destroy(ctx)
    expect(grid).toBeNull()
    expect(raw).toBe(true)
  })

  it('clicking a cell drops the caret into that cell and dissolves the grid', async () => {
    const ctx = mount('before\n\n' + TABLE + '\nafter\n')
    await settle()
    const td = ctx.view.dom.querySelector('.glean-table td')
    const cell = td.textContent
    td.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await settle()
    const pos = ctx.view.state.selection.main.head
    const line = ctx.view.state.doc.lineAt(pos)
    const grid = ctx.view.dom.querySelector('.glean-table')
    destroy(ctx)
    expect(cell).toBe('1')
    expect(line.text).toBe('| 1 | 2 |')
    expect(grid).toBeNull()
  })

  it('stays byte-true with a table present', async () => {
    const ctx = mount('before\n\n' + TABLE + '\nafter\n')
    await settle()
    const out = emitMarkdown(ctx.view)
    destroy(ctx)
    expect(out).toBe('before\n\n' + TABLE + '\nafter\n')
  })
})
