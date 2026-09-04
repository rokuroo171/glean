import { describe, it, expect } from 'vitest'
import { parseHeadings } from '../../components/EditorPane'

describe('parseHeadings', () => {
  it('extracts ATX headings', () => {
    const md = '# Hello\n\nSome text\n\n## World'
    const headings = parseHeadings(md)
    expect(headings).toEqual([
      { level: 1, text: 'Hello', offset: 0 },
      { level: 2, text: 'World', offset: 20 },
    ])
  })

  it('ignores headings inside code fences', () => {
    const md = '```\n# Not a heading\n```\n\n# Real heading'
    const headings = parseHeadings(md)
    expect(headings).toEqual([
      { level: 1, text: 'Real heading', offset: 25 },
    ])
  })

  it('returns empty array for no headings', () => {
    const headings = parseHeadings('just some text\nno headings here')
    expect(headings).toEqual([])
  })

  it('strips trailing hashes from ATX headings', () => {
    const headings = parseHeadings('# Title ##')
    expect(headings[0].text).toBe('Title')
  })
})
