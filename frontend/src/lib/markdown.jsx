import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { visit, SKIP } from 'unist-util-visit'
import { colors } from './theme'
import { highlightCode } from './prism-setup'
import 'katex/dist/katex.min.css'

/**
 * remark plugin: GFM alerts (> [!NOTE] etc)
 *
 * Works on the mdast AST, BEFORE rendering. Strips the marker text from
 * the blockquote's first paragraph and re-tags the node for the renderer
 * via the canonical mdast->hast extension points (data.hName +
 * data.hProperties). This is the ONLY mechanism react-markdown actually
 * honors: replacing the node with a custom type is silently flattened to
 * a plain div (verified empirically), so custom element names here is
 * what makes the `alertbox` component fire
 *
 * The alert tag always sits at the start of the blockquote's FIRST
 * paragraph. It may be plain text or strong/emphasis-wrapped; we flatten
 * the leading inline runs to text to find the tag, then consume the tag
 * length across inline nodes so the marker vanishes from whichever node
 * holds it (keeping the strong wrapper for the remainder)
 */
const ALERT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

function inlineText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  if (node.children) return (node.children || []).map(inlineText).join('')
  return ''
}

function remarkAlert() {
  return (tree) => {
    visit(tree, 'blockquote', (bq) => {
      const first = bq.children && bq.children[0]
      if (!first || first.type !== 'paragraph') return
      const inline = (first.children || []).map(inlineText).join('')
      const m = inline.match(ALERT_RE)
      if (!m) return

      const tagLen = m[0].length
      let remaining = tagLen
      const out = []
      for (const child of first.children) {
        if (remaining <= 0) { out.push(child); continue }
        const txt = inlineText(child)
        const tlen = txt.length
        if (tlen <= remaining) {
          remaining -= tlen
          continue
        }
        const keep = txt.slice(remaining)
        remaining = 0
        if (child.type === 'text') out.push({ ...child, value: keep })
        else if (child.children) out.push({ ...child, children: [{ type: 'text', value: keep }] })
        else out.push(child)
      }
      first.children = out

      bq.data = bq.data || {}
      bq.data.hName = 'alertbox'
      bq.data.hProperties = { kind: m[1].toLowerCase() }
    })
  }
}

/* -- Styles -- */

function getS() {
  return {
  h1: { fontSize: 22, fontWeight: 600, lineHeight: 1.3, margin: '20px 0 10px', paddingBottom: 6, borderBottom: `1px solid ${colors.border}`, color: colors.text },
  h2: { fontSize: 18, fontWeight: 600, lineHeight: 1.3, margin: '18px 0 8px', paddingBottom: 5, borderBottom: `1px solid rgba(90,106,122,0.2)`, color: colors.text },
  h3: { fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: '14px 0 6px', color: colors.text },
  h4: { fontSize: 14, fontWeight: 600, lineHeight: 1.4, margin: '12px 0 4px', color: colors.text },
  h5: { fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: '10px 0 4px', color: colors.text },
  h6: { fontSize: 13, fontWeight: 500, lineHeight: 1.4, margin: '10px 0 4px', color: colors.textMuted },
  p: { margin: '6px 0', lineHeight: 1.7, color: colors.text, overflowWrap: 'anywhere' },
  strong: { fontWeight: 600, color: colors.text },
  em: { fontStyle: 'italic', color: colors.text },
  del: { textDecoration: 'line-through', color: colors.textMuted },
  a: { color: colors.accent, textDecoration: 'none', cursor: 'pointer' },
  blockquote: {
    borderLeft: `3px solid ${colors.borderStrong}`,
    margin: '10px 0',
    padding: '6px 16px',
    color: colors.textMuted,
    fontStyle: 'italic',
    background: 'rgba(90,106,122,0.06)',
    borderRadius: '0 4px 4px 0',
  },
  hr: { border: 'none', borderTop: `1px solid ${colors.border}`, margin: '20px 0' },
  ul: { margin: '6px 0', paddingLeft: 24, listStyleType: 'none' },
  ol: { margin: '6px 0', paddingLeft: 24, listStyleType: 'none', counterReset: 'glean-counter' },
  li: { margin: '3px 0', lineHeight: 1.7, color: colors.text, overflowWrap: 'anywhere', position: 'relative', paddingLeft: 16 },
  table: { borderCollapse: 'collapse', margin: '12px 0', width: '100%', fontSize: 13, border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'hidden' },
  th: { border: `1px solid ${colors.border}`, padding: '10px 14px', fontWeight: 600, color: colors.text, background: 'rgba(90,106,122,0.12)', textAlign: 'left', overflowWrap: 'anywhere' },
  td: { border: `1px solid ${colors.border}`, padding: '10px 14px', color: colors.text, overflowWrap: 'anywhere' },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    background: 'rgba(90,106,122,0.15)',
    padding: '1px 5px',
    borderRadius: 3,
    color: colors.text,
  },
  pre: {
    position: 'relative',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    background: colors.bgElevated,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '12px 16px',
    overflow: 'auto',
    margin: '10px 0',
    color: colors.text,
    lineHeight: 1.5,
    whiteSpace: 'pre',
    overflowWrap: 'anywhere',
  },
  img: { maxWidth: '100%', height: 'auto', borderRadius: 4, margin: '6px 0' },
  details: {
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '8px 12px',
    margin: '8px 0',
    background: 'rgba(90,106,122,0.04)',
  },
  summary: {
    cursor: 'pointer',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 500,
  },
}
}

let s = {}

let ctx = { body: '', next: 0, onToggle: null, noteNames: null }

/* -- Note-link helpers -- */

const WIKI_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]/g
const MD_LINK_RE = /\[([^\]]*)\]\(([^) ]+\.md)\)/g

export function rewriteWikiLinks(body, noteNames) {
  if (!body) return { body: '', resolved: {} }
  const resolved = {}
  const out = body
    .replace(WIKI_RE, (m, title, alias) => {
      const t = title.trim()
      const label = (alias && alias.trim()) || t
      resolved[t] = noteNames?.[t] ?? ''
      return `[${label}](wails:wiki:${encodeURIComponent(t)})`
    })
    .replace(MD_LINK_RE, (m, text, target) => {
      const t = target.replace(/^.*[\\\/]/, '').replace(/\.md$/, '')
      resolved[t] = noteNames?.[t] ?? ''
      return `[${text || t}](wails:wiki:${encodeURIComponent(t)})`
    })
  return { body: out, resolved }
}

/* -- List marker styles -- */
const listStyles = () => `
  .glean-markdown ul > li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.7em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${colors.textMuted};
  }
  .glean-markdown ul ul > li::before {
    background: ${colors.borderStrong};
  }
  .glean-markdown ul ul ul > li::before {
    background: ${colors.border};
  }
  .glean-markdown ol > li::before {
    content: counter(glean-counter) '.';
    position: absolute;
    left: -20px;
    color: ${colors.textDim};
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .glean-markdown ol {
    counter-reset: glean-counter;
  }
  .glean-markdown ol > li {
    counter-increment: glean-counter;
  }
  .glean-markdown mark {
    background: rgba(217, 154, 61, 0.3);
    color: inherit;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .glean-markdown abbr {
    text-decoration: underline dotted ${colors.textMuted};
    cursor: help;
  }
  .glean-markdown sub, .glean-markdown sup {
    font-size: 0.75em;
  }
  .glean-markdown kbd {
    display: inline-block;
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
    color: ${colors.text};
    background: ${colors.bgElevated};
    border: 1px solid ${colors.border};
    border-radius: 3px;
    box-shadow: 0 1px 0 ${colors.border};
  }
  .glean-markdown table tbody tr:hover {
    background: ${colors.text}0d;
  }
  .glean-markdown table th {
    position: sticky;
    top: 0;
    background: rgba(90, 106, 122, 0.15);
  }
  .glean-markdown pre {
    position: relative;
  }
  .glean-markdown pre:hover .copy-btn {
    opacity: 1;
  }
  .glean-markdown .copy-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
`

/* -- Mermaid Diagram Component -- */

let mermaidCounter = 0
let mermaidInitialized = false

async function initMermaid() {
  if (mermaidInitialized) return
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: colors.accent,
      primaryTextColor: colors.text,
      primaryBorderColor: colors.border,
      lineColor: colors.borderStrong,
      secondaryColor: colors.bgElevated,
      tertiaryColor: 'rgba(90, 106, 122, 0.1)',
      fontFamily: 'inherit',
    },
  })
  mermaidInitialized = true
}

function MermaidDiagram({ code }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        await initMermaid()
        const mermaid = (await import('mermaid')).default
        const id = `mermaid-${++mermaidCounter}`
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) setSvg(svg)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to render diagram')
      }
    }
    render()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div style={{
        padding: '10px 14px',
        margin: '8px 0',
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        background: 'rgba(219, 76, 64, 0.1)',
        color: colors.textMuted,
        fontSize: 12,
        fontFamily: 'monospace',
      }}>
        Diagram error: {error}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="mermaid-diagram"
      style={{ margin: '10px 0', textAlign: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/* -- Interactive Components -- */

function Checkbox({ checked, index }) {
  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (ctx.onToggle) ctx.onToggle(flipTask(ctx.body, index))
  }
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick(e)
    }
  }
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: 4,
        border: `2px solid ${checked ? colors.accent : colors.borderStrong}`,
        background: checked ? colors.accent : 'transparent',
        flexShrink: 0,
        marginTop: 4,
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 150ms ease',
        boxShadow: checked ? `0 0 0 1px ${colors.accent}40` : 'none',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5.5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

function CodeBlock({ children, className }) {
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') || ''
  const highlighted = highlightCode(code, lang)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code)
  }, [code])

  return (
    <div className="code-block" style={s.pre}>
      <button
        className="copy-btn"
        type="button"
        onClick={copy}
        title="Copy code"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(90, 106, 122, 0.2)',
          border: `1px solid ${colors.border}`,
          color: colors.textMuted,
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 11,
          borderRadius: 4,
        }}
      >
        Copy
      </button>
      {lang && (
        <span style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 10,
          color: colors.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {lang}
        </span>
      )}
      <div style={{ marginTop: lang ? 20 : 0 }}>
        {highlighted
          ? <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
          : <code>{code}</code>}
      </div>
    </div>
  )
}

function InlineCode({ children }) {
  return <code style={s.code}>{children}</code>
}

function Details({ children, ...props }) {
  return <details style={s.details} {...props}>{children}</details>
}

function Summary({ children, ...props }) {
  return <summary style={s.summary} {...props}>{children}</summary>
}

/* -- GFM Alerts -- */

const ALERT_KINDS = {
  note: { label: 'Note', color: '#5b9fd4' },
  tip: { label: 'Tip', color: '#56b87a' },
  important: { label: 'Important', color: '#8b7cf6' },
  warning: { label: 'Warning', color: '#d99a3d' },
  caution: { label: 'Caution', color: '#db4c40' },
}

function AlertBlock({ kind, children }) {
  const t = ALERT_KINDS[kind] || ALERT_KINDS.note
  return (
    <div style={{
      border: `1px solid ${t.color}40`,
      borderLeft: `3px solid ${t.color}`,
      borderRadius: 6,
      background: `${t.color}0f`,
      padding: '10px 14px',
      margin: '10px 0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: t.color, fontWeight: 600, fontSize: 12,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
        {t.label}
      </div>
      <div style={{ marginTop: 5, color: colors.text }}>
        {children}
      </div>
    </div>
  )
}

/* -- Custom Components Map -- */

const components = {
  h1: ({ children, ...props }) => <h1 style={s.h1} {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 style={s.h2} {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 style={s.h3} {...props}>{children}</h3>,
  h4: ({ children, ...props }) => <h4 style={s.h4} {...props}>{children}</h4>,
  h5: ({ children, ...props }) => <h5 style={s.h5} {...props}>{children}</h5>,
  h6: ({ children, ...props }) => <h6 style={s.h6} {...props}>{children}</h6>,

  p: ({ children, ...props }) => <p style={s.p} {...props}>{children}</p>,
  strong: ({ children, ...props }) => <strong style={s.strong} {...props}>{children}</strong>,
  em: ({ children, ...props }) => <em style={s.em} {...props}>{children}</em>,
  del: ({ children, ...props }) => <del style={s.del} {...props}>{children}</del>,

  a: ({ children, href, ...props }) => {
    const isWiki = typeof href === 'string' && href.startsWith('wails:wiki:')
    const title = isWiki ? decodeURIComponent(href.slice('wails:wiki:'.length)) : ''
    const resolvedId = isWiki ? (ctx.resolved && ctx.resolved[title]) : null
    const broken = isWiki && !resolvedId
    return (
      <a
        href={isWiki ? undefined : href}
        onClick={(e) => {
          e.preventDefault()
          if (isWiki) {
            if (ctx.onNoteLink) ctx.onNoteLink(title, resolvedId)
          } else if (href && window.runtime?.BrowserOpenURL) {
            window.runtime.BrowserOpenURL(href)
          }
        }}
        style={{
          ...s.a,
          ...(broken ? {
            color: colors.textMuted,
            textDecoration: 'underline dotted',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          } : {}),
        }}
        {...props}
      >{children}</a>
    )
  },
  img: ({ src, alt, ...props }) => {
    const resolved = src && /^\.{0,2}\/?(\.glean\/assets\/)/.test(src)
      ? '/@assets/' + src.replace(/^\.{0,2}\//, '')
      : src
    return <img src={resolved} alt={alt} style={s.img} {...props} />
  },

  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-')
    if (!isBlock) return <InlineCode {...props}>{children}</InlineCode>
    const lang = className?.replace('language-', '') || ''
    const code = String(children).replace(/\n$/, '')
    if (lang === 'mermaid') {
      return <MermaidDiagram code={code} />
    }
    return <CodeBlock className={className} {...props}>{children}</CodeBlock>
  },
  pre: ({ children }) => <>{children}</>,

  ul: ({ children, ...props }) => <ul style={s.ul} {...props}>{children}</ul>,
  ol: ({ children, ...props }) => {
    const count = React.Children.count(children)
    return <ol style={{ ...s.ol, counterReset: `glean-counter ${count}` }} {...props}>{children}</ol>
  },
  li: ({ children, className, ...props }) => {
    if (className?.includes('task-list-item')) {
      const kids = React.Children.toArray(children)
      const box = kids[0]
      const checked = box?.props?.checked
      return (
        <li style={{ ...s.li, paddingLeft: 0 }} {...props}>
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.7, cursor: 'pointer' }}>
            {box}
            <span style={checked ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>
              {kids.slice(1)}
            </span>
          </span>
        </li>
      )
    }
    return <li style={s.li} {...props}>{children}</li>
  },

  input: ({ type, checked, ...props }) => {
    if (type === 'checkbox') {
      const index = ctx.next++
      return <Checkbox checked={checked} index={index} />
    }
    return <input type={type} checked={checked} {...props} />
  },

  blockquote: ({ children, ...props }) => <blockquote style={s.blockquote} {...props}>{children}</blockquote>,

  alertbox: ({ kind, children }) => <AlertBlock kind={kind}>{children}</AlertBlock>,

  table: ({ children, ...props }) => <table style={s.table} {...props}>{children}</table>,
  th: ({ children, ...props }) => <th style={s.th} {...props}>{children}</th>,
  td: ({ children, ...props }) => <td style={s.td} {...props}>{children}</td>,
  thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,

  hr: (props) => <hr style={s.hr} {...props} />,

  details: Details,
  summary: Summary,

  sup: ({ children, ...props }) => <sup style={{ fontSize: '0.75em', color: colors.accent }} {...props}>{children}</sup>,
  sub: ({ children, ...props }) => <sub style={{ fontSize: '0.75em' }} {...props}>{children}</sub>,
  mark: ({ children, ...props }) => <mark {...props}>{children}</mark>,
  abbr: ({ children, ...props }) => <abbr {...props}>{children}</abbr>,
  kbd: ({ children, ...props }) => <kbd {...props}>{children}</kbd>,
  footnoteDefinition: ({ children, ...props }) => (
    <div style={{ fontSize: 12, color: colors.textMuted, margin: '4px 0', paddingLeft: 16, borderLeft: `2px solid ${colors.border}` }} {...props}>{children}</div>
  ),
  footnoteReference: ({ children, ...props }) => (
    <sup style={{ fontSize: '0.75em', color: colors.accent, cursor: 'pointer' }} {...props}>{children}</sup>
  ),
}

/* -- Main Renderer -- */

export function flipTask(body, index) {
  const re = /^(\s*(?:[-*+]|\d+\.)\s+)\[[ xX]\]/gm
  let i = 0
  let m
  while ((m = re.exec(body))) {
    if (i === index) {
      const checked = m[0].endsWith('[x]') || m[0].endsWith('[X]')
      const replacement = checked ? '[ ]' : '[x]'
      const start = m.index + m[1].length
      return body.slice(0, start) + replacement + body.slice(start + 3)
    }
    i++
  }
  return body
}

export function renderMarkdown(text, opts = {}) {
  if (!text) return null
  s = getS()
  const { body, resolved } = rewriteWikiLinks(text, opts.noteNames || null)
  ctx = {
    body,
    next: 0,
    onToggle: opts.onToggle || null,
    onNoteLink: opts.onNoteLink || null,
    resolved,
  }
  return (
    <div className="glean-markdown">
      <style>{listStyles()}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkAlert]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
