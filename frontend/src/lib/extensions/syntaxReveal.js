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

function markWidget(text, className = 'glean-syntax-mark') {
  return () => {
    const span = document.createElement('span')
    span.className = className
    span.textContent = text
    span.setAttribute('aria-hidden', 'true')
    return span
  }
}

// Scans a parent textblock for the matching sub/sup chip: forward for the
// close when fromPair is an open chip, backward for the open otherwise,
// skipping the inline content between the chips. Returns the chip's doc
// position, or null when no matching chip exists in the parent, so an
// unpaired chip reveals nothing
function findHtmlChip(doc, fromPair, forward) {
  const $from = doc.resolve(fromPair)
  if ($from.parent.type.spec.code) return null
  const tag = tagOfHtml(doc.nodeAt(fromPair))
  if (!tag) return null
  let scan = forward ? fromPair + 1 : fromPair - 1
  const end = forward ? $from.end() : $from.start()
  while (forward ? scan < end : scan > end) {
    const node = doc.nodeAt(scan)
    if (!node) break
    if (node.type.name === 'html') {
      return tagOfHtml(node) === tag ? scan : null
    }
    scan = forward ? scan + node.nodeSize : scan - 1
  }
  return null
}

function tagOfHtml(node) {
  if (!node) return null
  const m = /^<\/?([a-z]+)\s*\/?>$/i.exec((node.attrs.value || '').trim())
  return m ? m[1].toLowerCase() : null
}

// The open-fence widget for a code block: ``` plus an editable span bound
// to the language attribute, Obsidian-style. The widget is not editable so
// the caret never wanders into it, but the language span is; PM ignores
// events from inside the span (stopEvent) while the browser's own
// contenteditable machinery types into it. The change commits on blur,
// matching the leave-to-commit model of every other revealed mark
function fenceWidget(node, getPos) {
  return (view) => {
    const wrap = document.createElement('span')
    wrap.className = 'glean-syntax-mark glean-fence-open'
    wrap.setAttribute('aria-hidden', 'true')
    wrap.append('```')
    const lang = document.createElement('span')
    lang.className = 'glean-fence-lang'
    lang.contentEditable = 'true'
    lang.spellcheck = false
    lang.textContent = node.attrs.language ?? ''
    lang.addEventListener('blur', () => {
      const pos = getPos()
      if (pos == null) return
      const cur = view.state.doc.nodeAt(pos)
      if (!cur || cur.type.name !== 'code_block') return
      const next = lang.textContent.replace(/[\s`]/g, '')
      if (next === (cur.attrs.language ?? '')) return
      view.dispatch(view.state.tr.setNodeAttribute(pos, 'language', next))
    })
    wrap.append(lang)
    return wrap
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
    // the fence chip renders inside the pre, before the code text, where
    // the plain ``` prefix used to render; getPos still resolves the node's
    // document position for setNodeAttribute
    const nodePos = $pos.before(codeDepth)
    const block = $pos.node(codeDepth)
    decos.push(Decoration.widget($pos.start(codeDepth), fenceWidget(block, () => {
      const found = state.doc.resolve(head)
      for (let d = found.depth; d >= 0; d--) {
        if (found.node(d).type.name === 'code_block') return found.before(d)
      }
      return null
    }), { side: -1, stopEvent: (event) => event.target.closest?.('.glean-fence-lang') != null, key: `fence-${nodePos}-${block.attrs.language}` }))
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

  // Selecting an image reveals its raw ![alt](src "title") syntax above
  // it, same node-decoration model as the hr reveal
  if (sel?.node?.type?.name === 'image') {
    const n = sel.node
    const title = n.attrs.title ? ` "${n.attrs.title}"` : ''
    decos.push(Decoration.node(sel.from, sel.to, { class: 'glean-img-selected', 'data-glean-raw': `![${n.attrs.alt ?? ''}](${n.attrs.src ?? ''}${title})` }))
  }

  // A sub/sup html pair renders as two atom chips around a text node.
  // Caret inside the pair (or a chip NodeSelection) tints the whole raw
  // region so the group reads as one editable unit
  const htmlPair = (() => {
    if (sel?.node?.type?.name === 'html') return { pos: sel.from, value: sel.node.attrs.value ?? '' }
    const chip = state.doc.nodeAt(head - 1)
    if (chip?.type.name !== 'html') return null
    return { pos: head - 1, value: chip.attrs.value ?? '' }
  })()
  if (htmlPair) {
    const m = /^<\/?([a-z]+)\s*\/?>$/i.exec(htmlPair.value.trim())
    if (m && ['sub', 'sup'].includes(m[1].toLowerCase())) {
      const isOpen = !htmlPair.value.trim().startsWith('</')
      const openPos = isOpen ? htmlPair.pos : findHtmlChip(state.doc, htmlPair.pos, false)
      if (openPos != null) {
        const closePos = findHtmlChip(state.doc, openPos, true)
        if (closePos != null) {
          decos.push(Decoration.node(openPos, openPos + 1, { class: 'glean-html-pair-selected' }))
          decos.push(Decoration.node(closePos, closePos + 1, { class: 'glean-html-pair-selected' }))
          decos.push(Decoration.inline(openPos + 1, closePos, { class: 'glean-html-pair-selected' }))
        }
      }
    }
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
