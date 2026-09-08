import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { renderToString } from 'katex'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
})
md.enable('strikethrough')

class TaskCheckbox extends WidgetType {
  constructor(checked) { super(); this.checked = checked }
  eq(o) { return o.checked === this.checked }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.className = 'glean-taskbox'
    const box = wrap.appendChild(document.createElement('input'))
    box.type = 'checkbox'
    box.checked = this.checked
    return wrap
  }
  ignoreEvent() { return false }
}

const hiddenMark = Decoration.mark({ class: 'glean-hidden-mark' })

class MathWidget extends WidgetType {
  constructor(latex, displayMode) {
    super()
    this.latex = latex
    this.displayMode = displayMode
  }
  eq(o) { return o.latex === this.latex && o.displayMode === this.displayMode }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'glean-math'
    try {
      span.innerHTML = renderToString(this.latex, {
        displayMode: this.displayMode,
        throwOnError: false,
        trust: true,
      })
    } catch (e) {
      span.textContent = this.latex
      span.style.color = '#db4c40'
    }
    return span
  }
}

let mermaidReady = false
let mermaidInstance = null
let mermaidId = 0

async function ensureMermaid() {
  if (mermaidReady) return mermaidInstance
  const m = (await import('mermaid')).default
  m.initialize({ startOnLoad: false, theme: 'dark' })
  mermaidInstance = m
  mermaidReady = true
  return m
}

class MermaidWidget extends WidgetType {
  constructor(code) {
    super()
    this.code = code
  }
  eq(o) { return o.code === this.code }
  toDOM(view) {
    const container = document.createElement('div')
    container.className = 'glean-mermaid'
    const id = `mermaid-${++mermaidId}`
    container.textContent = 'Loading diagram...'
    ensureMermaid().then(m => {
      m.render(id, this.code).then(({ svg }) => {
        container.innerHTML = svg
      }).catch(e => {
        container.style.color = '#db4c40'
        container.textContent = `Mermaid error: ${e.message}`
      })
    })
    return container
  }
}

function extractCells(state, rowNode) {
  const cells = []
  let c = rowNode.firstChild
  while (c) {
    if (c.name === 'TableCell') {
      cells.push({ text: state.doc.sliceString(c.from, c.to).trim(), from: c.from, to: c.to })
    }
    c = c.nextSibling
  }
  return cells
}

class TableWidget extends WidgetType {
  constructor(headerCells, bodyRows, pos) {
    super()
    this.headerCells = headerCells
    this.bodyRows = bodyRows
    this.pos = pos
  }
  eq(o) {
    return o.pos === this.pos &&
      o.headerCells.length === this.headerCells.length &&
      o.bodyRows.length === this.bodyRows.length &&
      o.headerCells.every((c, i) => c.text === this.headerCells[i].text)
  }
  toDOM(view) {
    const table = document.createElement('table')
    table.className = 'glean-table-widget'
    table.setAttribute('aria-hidden', 'true')
    const thead = document.createElement('thead')
    const htr = document.createElement('tr')
    for (const cell of this.headerCells) {
      const th = document.createElement('th')
      th.textContent = cell.text
      htr.appendChild(th)
    }
    thead.appendChild(htr)
    table.appendChild(thead)
    if (this.bodyRows.length > 0) {
      const tbody = document.createElement('tbody')
      for (const row of this.bodyRows) {
        const tr = document.createElement('tr')
        for (const cell of row) {
          const td = document.createElement('td')
          td.textContent = cell.text
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
    }
    table.addEventListener('click', (e) => {
      const td = e.target.closest('td, th')
      if (!td) return
      const tableEl = td.closest('table')
      const row = td.parentElement
      const ri = Array.from(tableEl.children).reduce((acc, sec) => {
        if (sec.tagName === 'THEAD') return acc
        const rows = Array.from(sec.children)
        const idx = rows.indexOf(row)
        return idx >= 0 ? acc + idx : acc
      }, 0)
      const ci = Array.from(row.children).indexOf(td)
      const allRows = [this.headerCells, ...this.bodyRows]
      if (ri < allRows.length && ci < allRows[ri].length) {
        const cellFrom = allRows[ri][ci].from
        view.dispatch({ selection: { anchor: cellFrom } })
        view.focus()
      }
    })
    return table
  }
  ignoreEvent() { return false }
}

const CALLOUT_RE = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/

const CALLOUT_SVG = {
  NOTE: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  TIP: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8l4 2"/><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>',
  IMPORTANT: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  WARNING: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  CAUTION: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
}

const CALLOUT_COLORS = {
  NOTE:       { bg: 'rgba(56,139,253,0.10)', border: '#388bfd', title: '#58a6ff', iconBg: 'rgba(56,139,253,0.15)' },
  TIP:        { bg: 'rgba(63,185,80,0.10)',  border: '#3fb950', title: '#3fb950', iconBg: 'rgba(63,185,80,0.15)' },
  IMPORTANT:  { bg: 'rgba(137,87,224,0.10)', border: '#8957e5', title: '#bc8cff', iconBg: 'rgba(137,87,224,0.15)' },
  WARNING:    { bg: 'rgba(210,153,34,0.10)', border: '#d29922', title: '#e3b341', iconBg: 'rgba(210,153,34,0.15)' },
  CAUTION:    { bg: 'rgba(248,81,73,0.10)',  border: '#f85149', title: '#f85149', iconBg: 'rgba(248,81,73,0.15)' },
}

class CalloutWidget extends WidgetType {
  constructor(type, bodyLines) {
    super()
    this.type = type
    this.bodyLines = bodyLines
  }
  eq(o) { return o.type === this.type && o.bodyLines === this.bodyLines }
  toDOM() {
    const c = CALLOUT_COLORS[this.type] || CALLOUT_COLORS.NOTE
    const icon = CALLOUT_SVG[this.type] || CALLOUT_SVG.NOTE
    const wrap = document.createElement('div')
    wrap.style.cssText = `border-left:3px solid ${c.border};border-radius:6px;background:${c.bg};padding:8px 16px 12px 12px;`
    wrap.setAttribute('aria-hidden', 'true')
    const title = document.createElement('div')
    title.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 0 4px;font-weight:600;font-size:14px;color:${c.title};`
    title.innerHTML = `<span style="display:inline-flex;align-items:center;color:${c.title}">${icon}</span><span>${this.type.charAt(0) + this.type.slice(1).toLowerCase()}</span>`
    wrap.appendChild(title)
    const body = document.createElement('div')
    body.style.cssText = 'color:#c8d6e0;font-size:14px;line-height:1.6;padding-bottom:4px;'
    body.textContent = this.bodyLines
    wrap.appendChild(body)
    return wrap
  }
  ignoreEvent() { return false }
}

class MarkdownWidget extends WidgetType {
  constructor(html) {
    super()
    this.html = html
  }
  eq(o) { return o.html === this.html }
  toDOM() {
    const div = document.createElement('div')
    div.className = 'glean-md-block'
    div.setAttribute('aria-hidden', 'true')
    div.innerHTML = this.html
    return div
  }
  ignoreEvent() { return false }
}

function getBlockRange(state, lineNum) {
  try {
    const line = state.doc.line(lineNum)
    return { from: line.from, to: line.to }
  } catch {
    return null
  }
}

export function buildLivePreview(state) {
  const tree = syntaxTree(state)
  const head = state.selection.main.head
  const docStr = state.doc.toString()
  const ranges = []
  const add = (from, to, deco) => ranges.push({ from, to, deco })

  const tokens = md.parse(docStr, {})

  const renderedBlocks = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]

    if (tok.type === 'inline') {
      i++
      continue
    }

    if (!tok.map) {
      i++
      continue
    }

    const [startLine, endLine] = tok.map
    const blockStart = state.doc.line(startLine + 1).from
    const blockEnd = state.doc.line(endLine).to

    const cursorInside = head >= blockStart && head <= blockEnd

    if (cursorInside) {
      i++
      continue
    }

    const blockTokens = []
    for (let j = i; j < tokens.length; j++) {
      const t = tokens[j]
      if (t.map && t.map[0] >= endLine && j > i) break
      if (!t.map && t.type !== 'inline' && t.type.endsWith('_close')) {
        blockTokens.push(t)
        if (j > i && tokens[j].type === tok.type.replace('_open', '_close')) {
          break
        }
      }
      blockTokens.push(t)
      if (t.type === tok.type.replace('_open', '_close')) break
    }

    const html = md.renderer.render(blockTokens, md.options, {})
    add(blockStart, blockEnd, hiddenMark)
    add(blockStart, blockStart, Decoration.widget({
      widget: new MarkdownWidget(html),
      block: true,
      side: -1,
    }))

    i++
  }

  tree.iterate({
    enter(node) {
      const name = node.name

      if (name === 'FencedCode') {
        const firstLine = state.doc.lineAt(node.from)
        const lastLine = state.doc.lineAt(node.to)
        const onNode = head >= node.from && head <= node.to
        const fenceMatch = firstLine.text.match(/^(`{3,}|~{3,})\s*(\w*)/)
        const lang = fenceMatch ? fenceMatch[2].toLowerCase() : ''

        if ((lang === 'math' || lang === 'latex' || lang === 'katex') && !onNode) {
          const code = state.doc.sliceString(firstLine.to + 1, lastLine.from)
          add(node.from, node.to, hiddenMark)
          add(node.from, node.from, Decoration.widget({ widget: new MathWidget(code.trim(), true), block: true, side: -1 }))
          return false
        }

        if (lang === 'mermaid' && !onNode) {
          const code = state.doc.sliceString(firstLine.to + 1, lastLine.from)
          add(node.from, node.to, hiddenMark)
          add(node.from, node.from, Decoration.widget({ widget: new MermaidWidget(code.trim()), block: true, side: -1 }))
          return false
        }

        return false
      }

      if (name === 'Table') {
        const onNode = head >= node.from && head <= node.to
        if (!onNode) {
          const docNode = tree.topNode
          let child = docNode.firstChild
          while (child && !(child.name === 'Table' && child.from === node.from)) {
            child = child.nextSibling
          }
          if (child && child.name === 'Table') {
            let headerCells = []
            let bodyRows = []
            let rowChild = child.firstChild
            while (rowChild) {
              if (rowChild.name === 'TableHeader') {
                headerCells = extractCells(state, rowChild)
              } else if (rowChild.name === 'TableRow') {
                bodyRows.push(extractCells(state, rowChild))
              }
              rowChild = rowChild.nextSibling
            }
            if (headerCells.length > 0) {
              add(node.from, node.to, hiddenMark)
              add(node.from, node.from, Decoration.widget({
                widget: new TableWidget(headerCells, bodyRows, node.from),
                block: true,
                side: -1,
              }))
            }
          }
        }
        return false
      }

      if (name === 'Blockquote') {
        const firstLine = state.doc.lineAt(node.from)
        const lastLine = state.doc.lineAt(node.to)
        const onNode = head >= node.from && head <= node.to

        const m = firstLine.text.match(CALLOUT_RE)
        if (m && !onNode) {
          const type = m[1]
          let bodyLines = ''
          for (let ln = firstLine.number; ln <= lastLine.number; ln++) {
            const l = state.doc.line(ln)
            let lineText = l.text.replace(/^\s*>\s?/, '')
            if (ln === firstLine.number) {
              lineText = lineText.replace(/^\[!\w+\]\s*/, '')
            }
            if (lineText || ln > firstLine.number) {
              bodyLines += (bodyLines ? '\n' : '') + lineText
            }
          }
          add(node.from, node.to, hiddenMark)
          add(node.from, node.from, Decoration.widget({ widget: new CalloutWidget(type, bodyLines), block: true, side: -1 }))
        }
        return false
      }

      if (name === 'TaskMarker') {
        const text = state.doc.sliceString(node.from, node.to)
        const m = text.match(/^\[([ x])\]/)
        if (!m) return false
        if (head >= node.from && head <= node.to) {
          return false
        }
        add(node.from, node.to, hiddenMark)
        add(node.from, node.from, Decoration.widget({ widget: new TaskCheckbox(m[1] !== ' ') }))
        return false
      }

      if (name === 'Image') {
        add(node.from, node.to, Decoration.mark({ class: 'glean-image' }))
        return false
      }

      if (name === 'StrongEmphasis') {
        if (head >= node.from && head <= node.to) {
          add(node.from + 2, node.to - 2, Decoration.mark({ class: 'glean-bold' }))
        } else {
          add(node.from, node.to, hiddenMark)
          add(node.from + 2, node.to - 2, Decoration.mark({ class: 'glean-bold' }))
        }
        return false
      }

      if (name === 'Emphasis') {
        if (head >= node.from && head <= node.to) {
          add(node.from + 1, node.to - 1, Decoration.mark({ class: 'glean-italic' }))
        } else {
          add(node.from, node.to, hiddenMark)
          add(node.from + 1, node.to - 1, Decoration.mark({ class: 'glean-italic' }))
        }
        return false
      }

      if (name === 'InlineCode') {
        const text = state.doc.sliceString(node.from, node.to)
        const fence = (text.match(/^(`+)/) || ['', '`'])[1].length
        if (node.to - node.from <= fence * 2) return false
        const onNode = head >= node.from && head <= node.to
        if (!onNode) {
          add(node.from, node.from + fence, hiddenMark)
          add(node.to - fence, node.to, hiddenMark)
        }
        add(node.from + fence, node.to - fence, Decoration.mark({ class: 'glean-icode' }))
        return false
      }

      if (name === 'Link') {
        const text = state.doc.sliceString(node.from, node.to)
        const close = text.indexOf(']')
        if (close <= 0) return false
        const onNode = head >= node.from && head <= node.to
        if (!onNode) {
          add(node.from, node.from + 1, hiddenMark)
          add(node.from + close, node.to, hiddenMark)
        }
        add(node.from + 1, node.from + close, Decoration.mark({ class: 'glean-link' }))
        return false
      }

      return undefined
    },
  })

  const text = state.doc.toString()
  const mathRe = /\$([^$]+)\$/g
  let match
  while ((match = mathRe.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    const latex = match[1]
    const onMath = head >= from && head <= to
    if (!onMath && latex.trim()) {
      add(from, to, hiddenMark)
      add(from, from, Decoration.widget({ widget: new MathWidget(latex, false) }))
    }
  }

  const strikeRe = /~~([^~]+?)~~/g
  while ((match = strikeRe.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    const onNode = head >= from && head <= to
    if (!onNode) {
      add(from, from + 2, hiddenMark)
      add(from + 2, to - 2, Decoration.mark({ class: 'glean-strike' }))
      add(to - 2, to, hiddenMark)
    } else {
      add(from + 2, to - 2, Decoration.mark({ class: 'glean-strike' }))
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to)
  const builder = new RangeSetBuilder()
  for (const r of ranges) builder.add(r.from, r.to, r.deco)
  return builder.finish()
}

export const livePreviewField = StateField.define({
  create(state) { return buildLivePreview(state) },
  update(deco, tr) {
    return buildLivePreview(tr.state)
  },
  provide: f => EditorView.decorations.from(f),
})

export function toggleTaskAt(view, pos) {
  const line = view.state.doc.lineAt(pos)
  const text = line.text
  const m = text.match(/^(\s*[-*+]\s+)\[([ x])\]/)
  if (!m) return false
  const from = line.from + m[0].length - 3
  const checked = m[2] === ' ' ? 'x' : ' '
  view.dispatch({
    changes: { from, to: from + 3, insert: `[${checked}]` },
  })
  return true
}

export const taskClickPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = Decoration.none
  }
  update() {}
}, {
  decorations: () => Decoration.none,
  eventHandlers: {
    mousedown(e, view) {
      const target = e.target
      if (target && target.nodeName === 'INPUT' &&
          target.parentElement && target.parentElement.classList.contains('glean-taskbox')) {
        e.preventDefault()
        toggleTaskAt(view, view.posAtDOM(target))
        return true
      }
      return false
    },
  },
})
