import { describe, it, expect } from 'vitest'
import { filterCommands } from '../commands'

const cmds = [
  { id: 'settings', label: 'Open Settings', group: 'Navigate', icon: 'settings' },
  { id: 'new-note', label: 'New Note', group: 'Notes', icon: 'file-plus', keywords: ['create'] },
  { id: 'outline', label: 'Toggle Outline', group: 'Panes', icon: 'list' },
  { id: 'fnote', label: 'Footnote Legend', group: 'Notes', icon: 'file-text' },
]

describe('filterCommands', () => {
  it('returns items in order for an empty query', () => {
    expect(filterCommands(cmds, '').map(c => c.id)).toEqual(['settings', 'new-note', 'outline', 'fnote'])
  })

  it('matches case-insensitively', () => {
    expect(filterCommands(cmds, 'SETTINGS').map(c => c.id)).toEqual(['settings'])
  })

  it('ranks prefix above word start above mid substring', () => {
    expect(filterCommands(cmds, 'note').map(c => c.id)).toEqual(['new-note', 'fnote'])
  })

  it('matches keywords', () => {
    expect(filterCommands(cmds, 'create').map(c => c.id)).toEqual(['new-note'])
  })

  it('matches in-order subsequences', () => {
    expect(filterCommands(cmds, 'sttngs').map(c => c.id)).toEqual(['settings'])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(cmds, 'mermaid')).toEqual([])
  })
})
