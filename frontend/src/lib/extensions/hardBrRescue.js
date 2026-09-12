import { $nodeSchema } from '@milkdown/kit/utils'

// Milkdown's remark pipeline deletes every <br> variant from the parse tree,
// treating <br> purely as an empty-line marker for its serializer. Real line
// breaks in prose and table cells then vanish (stock 7.22.x, still unfixed).
// Fix strategy: rewrite <br> to <br data-glean> in the markdown source before
// it reaches the parser, which the delete list does not match. The schema
// override below renders that value as a real line break and the serializer
// normalizes it back to the author's original form, so files stay untouched
const BR_RE = /<br\s*\/?>/gi

// Fenced blocks and inline code keep their <br> text literal; only prose and
// table cells get the rescued form
export function rescueSourceBrs(md) {
  if (!md || md.indexOf('<br') === -1) return md
  const parts = md.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g)
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(BR_RE, '<br data-glean>')
  }
  return parts.join('')
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
