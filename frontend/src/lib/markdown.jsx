import React, { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { colors } from './theme'
import { highlightCode } from './prism-setup'

/**
 * Markdown renderer built on react-markdown + remark-gfm.
 * Supports: GFM (tables, task lists, strikethrough, autolinks),
 * footnotes, nested blockquotes, Setext headings, hard breaks,
 * character references, and all CommonMark core features.
 *
 * Custom interactive components:
 * - Checkboxes: styled task-list checkboxes (visual only)
 * - Copy button on code blocks
 * - Collapsible details/summary
 */

/* ── Styles ── */

function getS() {
  return {
  h1: { fontSize: 22, fontWeight: 600, lineHeight: 1.3, margin: '20px 0 10px', paddingBottom: 6, borderBottom: `1px solid ${colors.border}`, color: colors.text },
  h2: { fontSize: 18, fontWeight: 600, lineHeight: 1.3, margin: '18px 0 8px', paddingBottom: 5, borderBottom: `1px solid rgba(90,106,122,0.2)`, color: colors.text },
  h3: { fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: '14px 0 6px', color: colors.text },
  h4: { fontSize: 14, fontWeight: 600, lineHeight: 1.4, margin: '12px 0 4px', color: colors.text },
  h5: { fontSize: 13, fontWeight: 600, lineHeight: 1.4, margin: '10px 0 4px', color: colors.text },
  h6: { fontSize: 13, fontWeight: 500, lineHeight: 1.4, margin: '10px 0 4px', color: colors.textMuted },
  p: { margin: '6px 0', lineHeight: 1.7, color: colors.text },
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
  ul: { margin: '6px 0', paddingLeft: 24 },
  ol: { margin: '6px 0', paddingLeft: 24 },
  li: { margin: '3px 0', lineHeight: 1.7, color: colors.text },
  table: { borderCollapse: 'collapse', margin: '12px 0', width: '100%', fontSize: 13 },
  th: { border: `1px solid ${colors.border}`, padding: '8px 12px', fontWeight: 600, color: colors.text, background: 'rgba(90,106,122,0.08)', textAlign: 'left' },
  td: { border: `1px solid ${colors.border}`, padding: '8px 12px', color: colors.text },
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

// Per-render task-list state: which checkbox index is next, the source body,
// and the toggle callback. Reset at the start of every renderMarkdown call.
let taskCtx = { body: '', next: 0, onToggle: null }

/* ── Interactive Components ── */

/** Task-list checkbox box, Obsidian-style: clean square, no bullet.
 *  Intercepts the <input type="checkbox"> that react-markdown emits for
 *  GFM task items (v10 does not pass `checked` to the `li` component).
 *  The `li` component groups this box with the sibling label text. */
function Checkbox({ checked, index }) {
  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (taskCtx.onToggle) taskCtx.onToggle(flipTask(taskCtx.body, index))
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
        width: 14,
        height: 14,
        borderRadius: 3.5,
        border: `1px solid ${checked ? colors.accent : colors.borderStrong}`,
        background: checked ? colors.accent : 'transparent',
        flexShrink: 0,
        marginTop: 5,
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
          <path d="M3.5 7.5l2.5 2.5 4.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/** Code block with copy button and syntax highlighting */
function CodeBlock({ children, className }) {
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') || ''
  const highlighted = highlightCode(code, lang)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code)
  }, [code])

  return (
    <div className="code-block" style={s.pre}>
      {lang && (
        <span style={{
          position: 'absolute', top: 6, right: 10,
          fontSize: 10, color: colors.textDim, textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        title="Copy code"
        style={{
          position: 'absolute', top: 6, right: lang ? 50 : 10,
          background: 'none', border: 'none', color: colors.textMuted,
          cursor: 'pointer', padding: 2, fontSize: 11,
        }}
      >
        copy
      </button>
      {highlighted
        ? <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
        : <code>{code}</code>}
    </div>
  )
}

/** Inline code */
function InlineCode({ children }) {
  return <code style={s.code}>{children}</code>
}

/** Collapsible details/summary for <details> blocks */
function Details({ children, ...props }) {
  return <details style={s.details} {...props}>{children}</details>
}

function Summary({ children, ...props }) {
  return <summary style={s.summary} {...props}>{children}</summary>
}

/* ── Custom Components Map ── */

const components = {
  // Headings
  h1: ({ children, ...props }) => <h1 style={s.h1} {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 style={s.h2} {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 style={s.h3} {...props}>{children}</h3>,
  h4: ({ children, ...props }) => <h4 style={s.h4} {...props}>{children}</h4>,
  h5: ({ children, ...props }) => <h5 style={s.h5} {...props}>{children}</h5>,
  h6: ({ children, ...props }) => <h6 style={s.h6} {...props}>{children}</h6>,

  // Text
  p: ({ children, ...props }) => <p style={s.p} {...props}>{children}</p>,
  strong: ({ children, ...props }) => <strong style={s.strong} {...props}>{children}</strong>,
  em: ({ children, ...props }) => <em style={s.em} {...props}>{children}</em>,
  del: ({ children, ...props }) => <del style={s.del} {...props}>{children}</del>,

  // Links and images
  a: ({ children, href, ...props }) => (
    <a
      style={s.a}
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href && window.runtime?.BrowserOpenURL) {
          window.runtime.BrowserOpenURL(href)
        }
      }}
      {...props}
    >{children}</a>
  ),
  img: ({ src, alt, ...props }) => <img src={src} alt={alt} style={s.img} {...props} />,

  // Code
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-')
    return isBlock
      ? <CodeBlock className={className} {...props}>{children}</CodeBlock>
      : <InlineCode {...props}>{children}</InlineCode>
  },
  pre: ({ children }) => <>{children}</>,

  // Lists
  ul: ({ children, ...props }) => <ul style={s.ul} {...props}>{children}</ul>,
  ol: ({ children, ...props }) => <ol style={s.ol} {...props}>{children}</ol>,
  li: ({ children, className, ...props }) => {
    if (className?.includes('task-list-item')) {
      // react-markdown renders the checkbox input and the label text as
      // siblings: [<input/>, " Text"]. Group them in a flex row so the box
      // and text sit on one line, and strike through the text when checked.
      const kids = React.Children.toArray(children)
      const box = kids[0]
      const checked = box?.props?.checked
      return (
        <li style={{ ...s.li, listStyle: 'none', paddingLeft: 0 }} {...props}>
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

  // GFM task lists render as <input type="checkbox">; replace it with our
  // custom clickable checkbox box (the li groups it with the label text).
  input: ({ type, checked, ...props }) => {
    if (type === 'checkbox') {
      const index = taskCtx.next++
      return <Checkbox checked={checked} index={index} />
    }
    return <input type={type} checked={checked} {...props} />
  },

  // Blockquote
  blockquote: ({ children, ...props }) => <blockquote style={s.blockquote} {...props}>{children}</blockquote>,

  // Table
  table: ({ children, ...props }) => <table style={s.table} {...props}>{children}</table>,
  th: ({ children, ...props }) => <th style={s.th} {...props}>{children}</th>,
  td: ({ children, ...props }) => <td style={s.td} {...props}>{children}</td>,
  thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,

  // Horizontal rule
  hr: (props) => <hr style={s.hr} {...props} />,

  // Details/summary (GFM collapsible)
  details: Details,
  summary: Summary,

  // Footnote support
  sup: ({ children, ...props }) => <sup style={{ fontSize: '0.75em', color: colors.accent }} {...props}>{children}</sup>,
  footnoteDefinition: ({ children, ...props }) => (
    <div style={{ fontSize: 12, color: colors.textMuted, margin: '4px 0', paddingLeft: 16, borderLeft: `2px solid ${colors.border}` }} {...props}>{children}</div>
  ),
}

/* ── Main Renderer ── */

/**
 * Flip the nth task checkbox ([ ] <-> [x]) in a markdown source string.
 * Only matches checkboxes at the start of a list item (GFM task list syntax),
 * so literal `[ ]` text in paragraphs is never touched.
 */
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
  taskCtx = { body: text, next: 0, onToggle: opts.onToggle || null }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  )
}
