import { $nodeSchema } from '@milkdown/kit/utils'

// Milkdown's remark pipeline deletes every <br> variant from the parse tree,
// treating <br> purely as an empty-line marker for its serializer. Real line
// breaks in prose and table cells then vanish (stock 7.22.x, still unfixed).
// Fix strategy: rewrite <br> to <br data-glean> in the markdown source before
// it reaches the parser, which the delete list does not match. The schema
// override below renders that value as a real line break and the serializer
// normalizes it back to the author's original form, so files stay untouched
const BR_RE = /<br\s*\/?>/gi

// Line-based scan: fenced blocks (including inside blockquotes) keep their <br>
// text literal; prose lines rescue <br> variants except inside inline code
// spans, which the backreference pattern matches even when the code contains
// backticks (the `` ```js `` case that breaks naive fence pairing)
const FENCE_LINE_RE = /^\s{0,3}(?:>\s?)*(```|~~~)/
const INLINE_CODE_OR_BR_RE = /(`+)[\s\S]*?\1(?!`)|<br\s*\/?>/gi

// With singleTilde:false, '~' can never open a delete node in our parse,
// so every backslash-tilde the serializer emits is defensive over-escaping
// (H~2~O -> H\~2\~O) that renders identically but pollutes Source view and
// drifts files away from what the author typed. Same story for doubled
// brackets: [[x]] has no schema node, parses as literal text, yet the
// serializer escapes to \[\[x]]. Stripping both is provably safe: the
// unescaped text re-parses to the identical tree (a bare '~' cannot open
// a delete, a doubled '[' cannot open a link), while single-escapes like
// \[solo] that guard real link syntax are left alone. Fenced blocks are
// untouched to keep code samples byte-true
export function stripDefensiveEscapes(md) {
  if (!md) return md
  const BS = String.fromCharCode(92)
  if (md.indexOf(BS + '~') === -1 && md.indexOf(BS + '[') === -1) return md
  let inFence = false
  return md
    .split('\n')
    .map((line) => {
      if (FENCE_LINE_RE.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      // \[\[ (each bracket escaped separately) is the doubled-bracket
      // defensive form; a single \[ guarding link syntax is left alone
      return line.replace(/\\~/g, '~').replace(/\\\[\\\[/g, '[[')
    })
    .join('\n')
}

// Backward-compatible alias: the tilde strip predates the bracket strip
export const stripDefensiveTildeEscapes = stripDefensiveEscapes

export function rescueSourceBrs(md) {
  if (!md || md.indexOf('<br') === -1) return md
  let inFence = false
  return md
    .split('\n')
    .map((line) => {
      if (FENCE_LINE_RE.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return line.replace(INLINE_CODE_OR_BR_RE, (m, fenceRun) =>
        fenceRun !== undefined ? m : '<br data-glean>'
      )
    })
    .join('\n')
}

const BR_NODE_RE = /^<br(\s[^>]*)?>$/i

// Safe inline tags whose open/close pairs render with real styling, the way
// Typora and Obsidian do. Values are exact lowercase tag names; anything not
// listed keeps the raw literal look
const RENDERED_TAGS = new Set(['strong', 'em', 'sub', 'sup', 'kbd', 'ins', 'u', 'mark'])

function tagOf(value) {
  const m = /^<\/?([a-z]+)\s*\/?>$/i.exec((value || '').trim())
  return m ? m[1].toLowerCase() : null
}

const COMMENT_RE = /^<!--[\s\S]*-->$/

// Stock html schema renders every tag as literal text. Keep that for unknown
// tags, but give <br> a real break and known pairs their real elements
export const htmlNodeOverride = $nodeSchema('html', () => ({
  atom: true,
  group: 'inline',
  inline: true,
  attrs: { value: { default: '' } },
  toDOM: (node) => {
    const value = node.attrs.value || ''
    const trimmed = value.trim()
    if (BR_NODE_RE.test(trimmed)) return ['br', { 'data-hardbreak': '' }]
    const tag = tagOf(trimmed)
    if (tag && RENDERED_TAGS.has(tag)) {
      if (trimmed.startsWith('</')) return ['span', { 'data-html-close': tag, contenteditable: 'false' }]
      return ['span', { 'data-html-open': tag, contenteditable: 'false' }]
    }
    if (COMMENT_RE.test(trimmed)) return ['span', { 'data-value': value, 'data-type': 'html', 'data-comment': '' }, value]
    return ['span', { 'data-value': value, 'data-type': 'html' }, value]
  },
  parseDOM: [
    {
      tag: 'br[data-hardbreak]',
      getAttrs: () => ({ value: '<br data-glean>' })
    },
    {
      tag: 'span[data-html-open], span[data-html-close]',
      getAttrs: (dom) => {
        const open = dom.getAttribute('data-html-open')
        const close = dom.getAttribute('data-html-close')
        return { value: open ? `<${open}>` : `</${close}>` }
      }
    },
    {
      tag: 'span[data-type="html"]',
      getAttrs: (dom) => ({ value: dom.dataset.value ?? '' })
    }
  ],
  parseMarkdown: {
    match: ({ type }) => type === 'html',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'html',
    runner: (state, node) => {
      state.addNode('html', undefined, (node.attrs.value || '').replace(' data-glean', ''))
    }
  }
}))
