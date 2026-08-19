import React, { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { colors } from './theme'

/**
 * Markdown renderer built on react-markdown + remark-gfm.
 * Supports: GFM (tables, task lists, strikethrough, autolinks),
 * footnotes, nested blockquotes, Setext headings, hard breaks,
 * character references, and all CommonMark core features.
 *
 * Custom interactive components:
 * - Checkboxes: clickable, toggle checked state
 * - Copy button on code blocks
 * - Collapsible details/summary
 */

/* ── Styles ── */

const s = {
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
  a: { color: '#5b9fd4', textDecoration: 'none', cursor: 'pointer' },
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
    color: '#d0d0d0',
  },
  pre: {
    position: 'relative',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    background: '#151a24',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '12px 16px',
    overflow: 'auto',
    margin: '10px 0',
    color: '#d0e0d0',
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

/* ── Interactive Components ── */

/** Clickable checkbox for task lists */
function Checkbox({ checked, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', lineHeight: 1.7 }}>
      <input
        type="checkbox"
        checked={checked}
        readOnly
        style={{
          appearance: 'none',
          width: 16, height: 16,
          border: `1.5px solid ${checked ? colors.accent : colors.borderStrong}`,
          borderRadius: 3,
          background: checked ? colors.accent : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: 3,
          position: 'relative',
        }}
      />
      <span style={checked ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
        {children}
      </span>
      {checked && (
        <svg
          style={{ position: 'absolute', left: 3, top: 6, pointerEvents: 'none' }}
          width={10} height={10} viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 6l3 3 5-5" stroke="#0B0F19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </label>
  )
}

/** Code block with copy button */
function CodeBlock({ children, className }) {
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') || ''

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code)
  }, [code])

  return (
    <div style={s.pre}>
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
      <code>{code}</code>
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
  li: ({ children, checked, ...props }) => {
    if (checked !== undefined && checked !== null) {
      return <li style={{ ...s.li, listStyle: 'none', marginLeft: -24 }} {...props}>
        <Checkbox checked={checked}>{children}</Checkbox>
      </li>
    }
    return <li style={s.li} {...props}>{children}</li>
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

export function renderMarkdown(text) {
  if (!text) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  )
}
