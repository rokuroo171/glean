import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { colors } from '../theme'
import { tableBlockRanges } from './tables-grid'

// The structure layer: widgets over the raw buffer for the things markdown
// renders as chrome rather than text. Every widget paints from the syntax
// tree and every edit it makes goes through view.dispatch on real buffer
// ranges, so saves stay byte-true by construction. All widgets ignore
// events so typing never lands inside them, and the buffer text they
// replace with visuals stays in the doc untouched

function inCodeAt(state, pos) {
  let node = syntaxTree(state).resolveInner(pos, -1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock') return true
    node = node.parent
  }
  return false
}

// ---- task checkboxes ----

// the buffer holds "- [x] done"; TaskMarker is the [x] itself, so a toggle
// replaces exactly one character inside the marker
class TaskBox extends WidgetType {
  constructor(checked) {
    super()
    this.checked = checked
  }
  eq(other) {
    return other.checked === this.checked
  }
  toDOM(view) {
    const wrap = document.createElement('span')
    wrap.className = 'glean-taskbox'
    const box = document.createElement('span')
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    box.setAttribute('aria-label', 'toggle task')
    box.appendChild(taskSvg(this.checked))
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const pos = view.posAtDOM(wrap)
      const line = view.state.doc.lineAt(pos)
      const m = /\[([ xX])\]/.exec(line.text)
      if (!m) return
      const at = line.from + m.index + 1
      const cur = view.state.sliceDoc(at, at + 1)
      view.dispatch({
        changes: { from: at, to: at + 1, insert: cur === ' ' ? 'x' : ' ' },
        userEvent: 'input',
      })
    })
    wrap.appendChild(box)
    return wrap
  }
  ignoreEvent() {
    return true
  }
}

function taskSvg(checked) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 18 18')
  svg.setAttribute('aria-hidden', 'true')
  // em-sized and inline: a fixed px block svg inside the inline wrap forces
  // the rest of the line onto its own row
  svg.style.display = 'inline-block'
  svg.style.width = '1em'
  svg.style.height = '1em'
  svg.style.verticalAlign = 'text-bottom'
  const rect = document.createElementNS(ns, 'rect')
  rect.setAttribute('x', '1.5')
  rect.setAttribute('y', '1.5')
  rect.setAttribute('width', '15')
  rect.setAttribute('height', '15')
  rect.setAttribute('rx', '5')
  rect.setAttribute('stroke-width', '1.75')
  if (checked) {
    rect.setAttribute('fill', colors.accent)
    rect.setAttribute('stroke', colors.accent)
  } else {
    rect.setAttribute('fill', 'none')
    rect.setAttribute('stroke', colors.borderStrong)
  }
  svg.appendChild(rect)
  if (checked) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M5.5 9.2l2.4 2.4 4.6-5.4')
    path.setAttribute('stroke', colors.bg)
    path.setAttribute('stroke-width', '1.75')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('fill', 'none')
    svg.appendChild(path)
  }
  return svg
}

// a checked task reads as finished: the whole item line dims and strikes.
// Line class only, so law 2's inline-geometry ban is not touched. The
// marker may sit behind a blockquote marker, so the list bullet is
// optional when the line starts with quote marks
const TASK_DONE_RE = /^\s*(?:>\s*)*(?:[-*+]|\d{1,9}[.)])?\s*\[[xX]\](\s|$)/

function taskDecorations(out, tree, state) {
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'TaskMarker') return
      const ch = state.sliceDoc(node.from + 1, node.from + 2)
      out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new TaskBox(ch !== ' ') }) })
      const line = state.doc.lineAt(node.from)
      if (TASK_DONE_RE.test(line.text)) {
        out.push({ from: line.from, to: line.from, deco: Decoration.line({ class: 'glean-task-done' }) })
      }
    },
  })
}

// ---- alerts ----

const ALERT_KINDS = {
  note: { label: 'Note', color: '#5b9fd4', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5v.01M12 11v6' },
  tip: { label: 'Tip', color: '#56b87a', icon: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5' },
  important: { label: 'Important', color: '#8b7cf6', icon: 'M7.9 20A9 9 0 1 0 4 16.1L2 22ZM12 8v4M12 16v.01' },
  warning: { label: 'Warning', color: '#d99a3d', icon: 'm21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17v.01' },
  caution: { label: 'Caution', color: '#db4c40', icon: 'M21.73 18l-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17v.01' },
}

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i

function alertIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', ALERT_KINDS[kind].icon)
  svg.appendChild(path)
  return svg
}

class AlertHeader extends WidgetType {
  constructor(kind) {
    super()
    this.kind = kind
  }
  eq(other) {
    return other.kind === this.kind
  }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'glean-alert-head'
    const inner = document.createElement('span')
    inner.style.color = ALERT_KINDS[this.kind].color
    inner.appendChild(alertIcon(this.kind))
    const label = document.createElement('span')
    label.textContent = ALERT_KINDS[this.kind].label
    inner.appendChild(label)
    wrap.appendChild(inner)
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

// an alert is a blockquote whose first line declares [!KIND]. The line
// decoration tints the whole callout, the header widget rides after the
// declaration, and the caret-inside contract matches reveal.js: while the
// caret edits the declaration the widget steps aside so the raw text is
// editable
function alertDecorations(out, tree, state, head) {
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Blockquote') return
      const firstLine = state.doc.lineAt(node.from)
      if (firstLine.from < node.from) return
      const m = ALERT_RE.exec(firstLine.text.replace(/^>\s?/, ''))
      if (!m) return
      const kind = m[1].toLowerCase()
      const declStart = firstLine.from + firstLine.text.indexOf('[')
      const declEnd = firstLine.from + firstLine.text.indexOf(']') + 1
      out.push({ from: firstLine.from, to: firstLine.from, deco: Decoration.line({ class: 'glean-alert-line', attributes: { 'data-kind': kind } }) })
      const bodyFrom = firstLine.to + 1
      if (bodyFrom <= node.to) {
        for (let l = state.doc.lineAt(bodyFrom).number; l <= state.doc.lineAt(node.to).number; l++) {
          const line = state.doc.line(l)
          out.push({ from: line.from, to: line.from, deco: Decoration.line({ class: 'glean-alert-body', attributes: { 'data-kind': kind } }) })
        }
      }
      const active = head != null && head >= declStart && head <= declEnd
      if (!active) {
        out.push({ from: declEnd, to: declEnd, deco: Decoration.widget({ widget: new AlertHeader(kind), side: 1 }) })
      }
    },
  })
}

// ---- fence language chip ----

class FenceChip extends WidgetType {
  constructor(lang) {
    super()
    this.lang = lang
  }
  eq(other) {
    return other.lang === this.lang
  }
  toDOM() {
    const chip = document.createElement('span')
    chip.className = 'glean-fence-chip'
    chip.textContent = this.lang
    return chip
  }
  ignoreEvent() {
    return false
  }
}

// the ``` fence marks collapse and the language word rides after the open
// mark as a chip; the caret inside the info line shows raw text instead
function fenceDecorations(out, tree, state, head) {
  tree.iterate({
    enter: (node) => {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
        const marks = []
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (child.name === 'CodeMark') marks.push(child)
        }
        for (const mark of marks) {
          if (head < mark.from || head > mark.to) {
            out.push({ from: mark.from, to: mark.to, deco: Decoration.replace({}) })
          }
        }
        const info = node.node.getChild('CodeInfo')
        if (info && info.to > info.from) {
          const lang = state.sliceDoc(info.from, info.to)
          const active = head >= info.from && head <= info.to
          if (!active) {
            out.push({ from: info.from, to: info.to, deco: Decoration.replace({ widget: new FenceChip(lang) }) })
          }
        }
        return false
      }
    },
  })
}

// ---- math ----

let katexLib = null
function katex() {
  if (!katexLib) katexLib = import('katex').then((m) => m.default)
  return katexLib
}

class MathWidget extends WidgetType {
  constructor(tex, display) {
    super()
    this.tex = tex
    this.display = display
  }
  eq(other) {
    return other.tex === this.tex && other.display === this.display
  }
  toDOM() {
    const span = document.createElement(this.display ? 'div' : 'span')
    span.className = this.display ? 'glean-math-block' : 'glean-math-inline'
    katex()
      .then((k) => {
        k.render(this.tex, span, { displayMode: this.display, throwOnError: false })
      })
      .catch(() => {
        span.textContent = this.tex
        span.classList.add('glean-math-error')
      })
    return span
  }
  ignoreEvent() {
    return false
  }
}

// lezer-markdown parses no math nodes (the PM stack got them from remark), so
// math is found by scan like starline: $$ blocks may span lines, $ inline
// must sit on one line with non-space padding inside so currency text like
// "5$ and 6$" never renders as a formula. Inline ranges decorate in the
// view plugin; display ranges are block replacements and live in the
// StateField below, because CM6 forbids block decorations from plugins
const DISPLAY_MATH = /\$\$([^$]+?)\$\$/gs
const INLINE_MATH = /(^|[^\\$])\$([^\s$][^$]*?[^\s$]|[^\s$])\$(?!\$)/g

function inlineMathRanges(doc) {
  const text = doc.toString()
  const out = []
  for (const m of text.matchAll(DISPLAY_MATH)) {
    out.push({ from: m.index, to: m.index + m[0].length, display: true })
  }
  for (const m of text.matchAll(INLINE_MATH)) {
    const from = m.index + m[1].length
    const to = from + m[2].length + 2
    if (out.some((r) => from < r.to && to > r.from)) continue
    if (doc.lineAt(from).number !== doc.lineAt(to - 1).number) continue
    out.push({ from, to, display: false })
  }
  return out
}

function inlineMathDecorations(out, state, head) {
  for (const r of inlineMathRanges(state.doc)) {
    if (r.display) continue
    const active = head >= r.from && head <= r.to
    if (active) continue
    out.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget: new MathWidget(state.sliceDoc(r.from + 1, r.to - 1), false) }) })
  }
}

// ---- mermaid ----

let mermaidInit = null
function mermaidReady() {
  if (!mermaidInit) {
    mermaidInit = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#5b9fd4',
          primaryTextColor: '#e8eaed',
          primaryBorderColor: 'rgba(180, 140, 80, 0.12)',
          lineColor: 'rgba(180, 140, 80, 0.25)',
          secondaryColor: '#121824',
          tertiaryColor: 'rgba(90, 106, 122, 0.1)',
          fontFamily: 'inherit',
        },
      })
      return m.default
    })
  }
  return mermaidInit
}

const svgCache = new Map()
const MAX_CACHE = 30
let renderCounter = 0

class MermaidWidget extends WidgetType {
  constructor(code) {
    super()
    this.code = code
  }
  eq(other) {
    return other.code === this.code
  }
  toDOM() {
    const box = document.createElement('div')
    box.className = 'glean-mermaid'
    const cached = svgCache.get(this.code)
    if (cached) {
      box.innerHTML = cached
      return box
    }
    box.textContent = 'Rendering diagram...'
    mermaidReady()
      .then((m) => m.render(`glean-cm6-${++renderCounter}`, this.code))
      .then(({ svg }) => {
        svgCache.set(this.code, svg)
        if (svgCache.size > MAX_CACHE) svgCache.delete(svgCache.keys().next().value)
        box.innerHTML = svg
      })
      .catch((e) => {
        box.textContent = `Diagram error: ${e.message || 'failed to render'}`
        box.classList.add('has-error')
      })
    return box
  }
  ignoreEvent() {
    return false
  }
}

// Mermaid and display math render as block widgets, and block decorations
// are a StateField's job (plugins may not emit them). Both are detected by
// scan, not the syntax tree, so the field never waits on a parse
function blockRanges(state) {
  const doc = state.doc
  const out = tableBlockRanges(state)
  for (const r of inlineMathRanges(doc)) {
    if (!r.display) continue
    const tex = doc.sliceString(r.from + 2, r.to - 2)
    out.push({ from: r.from, to: r.to, deco: Decoration.replace({ widget: new MathWidget(tex, true), block: true }) })
  }
  const text = doc.toString()
  const lines = text.split('\n')
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^```mermaid\s*$/.test(lines[i])) {
      let j = i + 1
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j++
      if (j < lines.length) {
        const body = lines.slice(i + 1, j).join('\n').trim()
        const after = pos + lines.slice(i, j + 1).join('\n').length + (j + 1 < lines.length ? 1 : 0)
        if (body) out.push({ from: after, to: after, deco: Decoration.widget({ widget: new MermaidWidget(body), side: 1, block: true }) })
      }
      i = j
    }
    pos += lines[i].length + 1
  }
  out.sort((a, b) => a.from - b.from || a.to - b.to)
  return out
}

export const blockWidgets = StateField.define({
  create(state) {
    return buildBlockSet(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) return buildBlockSet(tr.state)
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

function buildBlockSet(state) {
  const ranges = blockRanges(state)
  const builder = new RangeSetBuilder()
  for (const r of ranges) builder.add(r.from, r.to, r.deco)
  return builder.finish()
}

// ---- the plugin ----

export const widgets = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.build(view)
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) this.build(update.view)
    }
    build(view) {
      const tree = syntaxTree(view.state)
      const head = view.state.selection.main.head
      const all = []
      taskDecorations(all, tree, view.state)
      alertDecorations(all, tree, view.state, head)
      fenceDecorations(all, tree, view.state, head)
      inlineMathDecorations(all, view.state, head)
      all.sort((x, y) => x.from - y.from || x.to - y.to)
      const builder = new RangeSetBuilder()
      for (const d of all) builder.add(d.from, d.to, d.deco)
      this.decorations = builder.finish()
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => {
      const inst = view.plugin(plugin)
      return inst ? inst.atomic : Decoration.none
    }),
  },
)

// widget replace ranges are atomic: arrows step over the rendered box and
// land on the real text edges
function collectAtomic(out, tree, state) {
  tree.iterate({
    enter: (node) => {
      if (node.name === 'TaskMarker') out.push({ from: node.from, to: node.to })
    },
  })
  for (const r of inlineMathRanges(state.doc)) {
    out.push({ from: r.from, to: r.to })
  }
  return out
}

export const widgetAtomic = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.build(view)
    }
    update(update) {
      if (update.docChanged) this.build(update.view)
    }
    build(view) {
      const ranges = collectAtomic([], syntaxTree(view.state), view.state)
      ranges.sort((x, y) => x.from - y.from || x.to - y.to)
      const builder = new RangeSetBuilder()
      for (const r of ranges) builder.add(r.from, r.to, Decoration.replace({}))
      this.atomic = builder.finish()
    }
  },
  {
    provide: (plugin) => EditorView.atomicRanges.of((view) => {
      const inst = view.plugin(plugin)
      return inst ? inst.atomic : Decoration.none
    }),
  },
)

export const widgetsTheme = EditorView.theme({
  '.glean-taskbox': { cursor: 'pointer', verticalAlign: 'text-bottom', marginRight: '4px' },
  '.glean-task-done': { textDecoration: 'line-through', color: colors.textMuted },
  '.glean-alert-line': { color: 'inherit' },
  '.glean-alert-body': { color: 'inherit' },
  '.glean-fence-chip': {
    color: colors.textMuted,
    fontStyle: 'italic',
    fontSize: '0.85em',
    marginLeft: '4px',
    fontFamily: 'ui-monospace, monospace',
  },
  '.glean-math-inline': { display: 'inline-block' },
  '.glean-math-block': { display: 'block', margin: '8px 0' },
  '.glean-math-error': { color: '#db4c40', fontFamily: "'Fira Code', ui-monospace, monospace" },
  '.glean-mermaid': { padding: '8px 0' },
  '.glean-mermaid.has-error': {
    fontFamily: "'Fira Code', ui-monospace, monospace",
  },
})
