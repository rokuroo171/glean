import { Schema } from 'prosemirror-model'

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } }, toDOM: (n) => [`h${n.attrs.level}`, 0] },
    code_block: { group: 'block', content: 'text*', marks: '', code: true, attrs: { language: { default: '' } }, toDOM: () => ['pre', 0] },
    horizontal_rule: { group: 'block', inline: false, selectable: true, toDOM: () => ['hr'] },
    text: { inline: true, group: 'inline' },
  },
  marks: {
    strong: {},
    emphasis: {},
    inlineCode: { toDOM: () => ['code', 0] },
    strike_through: { toDOM: () => ['del', 0] },
  },
})
