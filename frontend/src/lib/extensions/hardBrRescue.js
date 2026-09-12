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

// Stock html schema renders every tag as literal text, which stays right for
// tags like <strong>. Br-shaped values become a real break instead
export const htmlNodeOverride = $nodeSchema('html', () => ({
  atom: true,
  group: 'inline',
  inline: true,
  attrs: { value: { default: '' } },
  toDOM: (node) => {
    const value = node.attrs.value || ''
    if (BR_NODE_RE.test(value.trim())) return ['br', { 'data-hardbreak': '' }]
    return ['span', { 'data-value': value, 'data-type': 'html' }, value]
  },
  parseDOM: [
    {
      tag: 'br[data-hardbreak]',
      getAttrs: () => ({ value: '<br data-glean>' })
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
