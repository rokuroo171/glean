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
