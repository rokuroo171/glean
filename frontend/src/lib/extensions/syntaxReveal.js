import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

// Reveals markdown syntax marks around the caret, Typora-style: a muted
// prefix (or inline pair) appears while the text keeps its rendered style
// Marks follow the caret, so `#` shows when the cursor enters a heading
// and hides again when it leaves
export const syntaxRevealKey = new PluginKey('glean-syntax-reveal')

const BLOCK_NODES = ['heading', 'blockquote', 'list_item', 'code_block']
const INLINE_MARKS = ['strong', 'emphasis', 'inline_code', 'strike_through', 'link']

// Inline marks render as a pair around their content
const INLINE_PAIR = {
  strong: ['**', '**'],
  emphasis: ['*', '*'],
  inline_code: ['`', '`'],
  strike_through: ['~~', '~~'],
}

function markWidget(text, side) {
  return () => {
    const span = document.createElement('span')
    span.className = 'glean-syntax-mark'
    span.textContent = text
    span.setAttribute('aria-hidden', 'true')
    return span
  }
}

function pushInlineMark(decos, node, mark) {
  const type = mark.type.name
  if (type === 'link') {
    decos.push(Decoration.widget(node.from, markWidget('['), { side: -1 }))
    decos.push(Decoration.widget(node.to, markWidget(`](${mark.attrs.href ?? ''})`), { side: 1 }))
    return
  }
  const [open, close] = INLINE_PAIR[type] || []
  if (!open) return
  decos.push(Decoration.widget(node.from, markWidget(open), { side: -1 }))
  decos.push(Decoration.widget(node.to, markWidget(close), { side: 1 }))
}

function blockPrefix(node) {
  switch (node.type.name) {
    case 'heading': return '#'.repeat(node.attrs.level || 1) + ' '
    case 'blockquote': return '> '
    case 'code_block': return '```'
    case 'list_item': {
      const list = node.parent
      if (list?.type.name === 'ordered_list') return `${list.attrs.order ?? 1}. `
      return '- '
    }
    default: return ''
  }
}

function decorationsFor(state) {
  const head = state.selection.main.head
  const $pos = state.doc.resolve(head)
  const decos = []

  // Deepest block ancestor at the caret gets a prefix mark
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d)
    if (!BLOCK_NODES.includes(node.type.name)) continue
    const prefix = blockPrefix(node)
    if (prefix) {
      decos.push(Decoration.widget(node.from, markWidget(prefix), { side: -1 }))
    }
    if (node.type.name === 'code_block') {
      decos.push(Decoration.widget(node.to, markWidget('```'), { side: 1 }))
    }
    break
  }

  // Inline marks whose range touches the caret get a pair around it
  state.doc.descendants(node => {
    for (const mark of node.marks) {
      if (!INLINE_MARKS.includes(mark.type.name)) continue
      if (head < node.from || head > node.to) continue
      pushInlineMark(decos, node, mark)
    }
  })

  if (decos.length === 0) return DecorationSet.empty
  return DecorationSet.create(state.doc, decos)
}

export function syntaxReveal() {
  return new Plugin({
    key: syntaxRevealKey,
    state: {
      init(_, state) { return decorationsFor(state) },
      apply(tr, old, _o, newState) {
        if (!tr.docChanged && !tr.selectionSet) return old
        return decorationsFor(newState)
      },
    },
    props: {
      decorations(state) { return this.getState(state) },
    },
  })
}
