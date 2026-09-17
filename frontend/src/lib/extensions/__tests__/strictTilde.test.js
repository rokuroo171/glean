import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'

// The singleTilde contract shared by the editor and Reading view:
// with singleTilde:false, single tildes are literal text everywhere, and
// only double tildes create delete nodes. This is what keeps the three
// view states in agreement on the same file.
const opts = { singleTilde: false, bullet: '-' }
const proc = () => unified().use(remarkParse).use(remarkGfm, opts).use(remarkStringify, opts)

function hasDelete(tree) {
  let found = false
  tree.descendants?.()
  return JSON.stringify(tree).includes('"delete"')
}

describe('strict GFM tilde (singleTilde:false)', () => {
  it('does not strike single tildes', () => {
    const tree = proc().parse('Water is H~2~O and ~single~ stays')
    expect(hasDelete(tree)).toBe(false)
  })

  it('strikes double tildes', () => {
    const tree = proc().parse('~~real~~ strike')
    expect(hasDelete(tree)).toBe(true)
  })

  it('round-trips single tildes byte-true after unescape', () => {
    // serializer defensively escapes ~ (safe), the emit layer strips it,
    // so the composed pipeline must return the input verbatim
    const out = String(proc().processSync('Water is H~2~O and ~single~ stays')).trimEnd()
    expect(out.replace(/\\~/g, '~')).toBe('Water is H~2~O and ~single~ stays')
  })

  it('preserves real strikethrough through the same pipeline', () => {
    const out = String(proc().processSync('~~strike~~ kept')).trimEnd()
    expect(out).toBe('~~strike~~ kept')
  })
})

// Bracket escape strip shares the pipeline: doubled-bracket escapes vanish,
// single escapes guarding real link syntax stay
import { stripDefensiveEscapes } from '../hardBrRescue'

describe('stripDefensiveEscapes', () => {
  it('un-escapes doubled brackets that cannot parse as markup', () => {
    expect(stripDefensiveEscapes('\\[\\[Page Name]]')).toBe('[[Page Name]]')
  })

  it('leaves single bracket escapes that guard link syntax', () => {
    expect(stripDefensiveEscapes('\\[solo] \\[1]')).toBe('\\[solo] \\[1]')
  })

  it('strips tildes outside fences but not inside', () => {
    const md = 'H~2~O\n\n```\nraw \\~ stays\n```'
    expect(stripDefensiveEscapes(md)).toBe('H~2~O\n\n```\nraw \\~ stays\n```')
  })

  it('is idempotent', () => {
    const once = stripDefensiveEscapes('\\[\\[x]] H~2~O')
    expect(stripDefensiveEscapes(once)).toBe(once)
  })
})
