import { $markSchema, $remark } from '@milkdown/kit/utils'
import { visit } from 'unist-util-visit'

const CONTAINS_HL = /==([^=]+)==/g

function splitHighlights(node, index, parent) {
  if (!node.value.includes('==')) return
  const parts = node.value.split(CONTAINS_HL)
  if (parts.length === 1) return
  const children = []
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part) children.push({ type: 'text', value: part })
    } else {
      children.push({ type: 'gleanHighlight', children: [{ type: 'text', value: part }] })
    }
  })
  parent.children.splice(index, 1, ...children)
}

// remark-gfm has no ==mark== extension, so the parser delivers the equals
// pairs as literal text. The transformer below splits them into custom
// nodes, and the toMarkdown extension teaches the serializer the same node
// so ==...== round-trips byte-true into saves
function remarkHighlightPlugin() {
  const data = this.data()
  data.toMarkdownExtensions = (data.toMarkdownExtensions || []).concat([{
    handlers: {
      gleanHighlight(node, _, state, info) {
        return '==' + state.containerPhrasing(node, info) + '=='
      }
    }
  }])
  return (tree) => {
    visit(tree, 'text', splitHighlights)
  }
}

export const remarkHighlight = $remark('remarkHighlight', () => remarkHighlightPlugin)

export const highlightSchema = $markSchema('glean_highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', 0],
  parseMarkdown: {
    match: (node) => node.type === 'gleanHighlight',
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'glean_highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'gleanHighlight')
    }
  }
}))
