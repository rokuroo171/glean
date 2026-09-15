import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

// Reveals markdown syntax marks around the caret, Typora-style: a muted
// prefix (or inline pair) appears while the text keeps its rendered style
// Marks follow the caret, so `#` shows when the cursor enters a heading
// and hides again when it leaves
export const syntaxRevealKey = new PluginKey('glean-syntax-reveal')

const BLOCK_NODES = ['heading', 'blockquote', 'list_item', 'code_block']
const INLINE_MARKS = ['strong', 'emphasis', 'inlineCode', 'strike_through', 'link']

// Inline marks render as a pair around their content
const INLINE_PAIR = {
  strong: ['**', '**'],
  emphasis: ['*', '*'],
  inlineCode: ['`', '`'],
  strike_through: ['~~', '~~'],
}

function markWidget(text) {
  return () => {
    const span = document.createElement('span')
    span.className = 'glean-syntax-mark'
    span.textContent = text
    span.setAttribute('aria-hidden', 'true')
    return span
  }
}

function pushInlineMark(decos, from, to, mark) {
  const type = mark.type.name
  if (type === 'link') {
    decos.push(Decoration.widget(from, markWidget('['), { side: -1 }))
    decos.push(Decoration.widget(to, markWidget(`](${mark.attrs.href ?? ''})`), { side: 1 }))
    return
  }
  if (type === 'emphasis') {
    // honor the mark's stored * or _ so the raw syntax matches the file
    const m = mark.attrs.marker === '_' ? '_' : '*'
    decos.push(Decoration.widget(from, markWidget(m), { side: -1 }))
    decos.push(Decoration.widget(to, markWidget(m), { side: 1 }))
    return
  }
  const [open, close] = INLINE_PAIR[type] || []
  if (!open) return
  decos.push(Decoration.widget(from, markWidget(open), { side: -1 }))
  decos.push(Decoration.widget(to, markWidget(close), { side: 1 }))
}

function blockPrefix(node, $pos, depth) {
  switch (node.type.name) {
    case 'heading': return '#'.repeat(node.attrs.level || 1) + ' '
    case 'blockquote': return '> '
    case 'code_block': return '```'
    case 'list_item': {
      // ResolvedPos nodes have no parent backlink, walk the resolve path
      const list = depth > 0 ? $pos.node(depth - 1) : null
      if (list?.type.name === 'ordered_list') return `${list.attrs.order ?? 1}. `
      return '- '
    }
    default: return ''
  }
}

function decorationsFor(state) {
  const sel = state.selection
  const head = sel ? (sel.head ?? sel.from) : null
  if (head == null) return DecorationSet.empty
  const $pos = state.doc.resolve(head)
  const decos = []

  // Block ancestors at the caret get prefix marks, rendered inside the
  // caret's own textblock so the marks share its line and font size
  // (heading hashes inherit the heading size). Nested quotes stack their
  // markers, so a caret three quotes deep shows '> > > '
  const markPos = $pos.parent.isTextblock ? $pos.start($pos.depth) : null
  const prefixes = []
  let listDepth = null
  for (let d = 0; d <= $pos.depth; d++) {
    const node = $pos.node(d)
    if (!BLOCK_NODES.includes(node.type.name)) continue
    if (node.type.name === 'blockquote') prefixes.push('> ')
    else if (node.type.name === 'heading') prefixes.push('#'.repeat(node.attrs.level || 1) + ' ')
    else if (node.type.name === 'code_block') prefixes.push('```')
    else if (node.type.name === 'list_item') {
      listDepth = d
      const list = $pos.node(d - 1)
      prefixes.push(list?.type.name === 'ordered_list' ? `${list.attrs.order ?? 1}. ` : '- ')
    }
  }
  if (prefixes.length && markPos != null) {
    decos.push(Decoration.widget(markPos, markWidget(prefixes.join('')), { side: -1 }))
  }
  if (listDepth != null) {
    // the raw dash becomes the marker, so hide the native bullet meanwhile
    decos.push(Decoration.node($pos.before(listDepth), $pos.after(listDepth), { class: 'glean-list-reveal' }))
  }
  const codeDepth = (() => {
    for (let d = $pos.depth; d >= 0; d--) if ($pos.node(d).type.name === 'code_block') return d
    return null
  })()
  if (codeDepth != null) {
    decos.push(Decoration.widget($pos.end(codeDepth), markWidget('```'), { side: 1 }))
  }

  // Inline marks whose range touches the caret get a pair around it
  // ProseMirror nodes carry no from/to, the callback pos is the node start
  state.doc.descendants((node, pos) => {
    const to = pos + node.nodeSize
    for (const mark of node.marks) {
      if (!INLINE_MARKS.includes(mark.type.name)) continue
      if (head < pos || head > to) continue
      pushInlineMark(decos, pos, to, mark)
    }
  })

  // Clicking an hr makes a NodeSelection; reveal its raw mark above the
  // rule in the same language as the caret-revealed prefixes, and the
  // mark disappears when the selection moves back into text
  if (sel?.node?.type?.name === 'hr') {
    decos.push(Decoration.node(sel.from, sel.to, { class: 'glean-hr-selected' }))
  }

  // A caret inside a footnote definition reveals its raw [^label]: syntax
  // around the dt label (the CSS pulls the label from data-label)
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'footnote_definition') {
      decos.push(Decoration.node($pos.before(d), $pos.after(d), { class: 'glean-fn-def-active' }))
      break
    }
  }

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
