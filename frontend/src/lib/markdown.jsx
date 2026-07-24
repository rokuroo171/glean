import React from 'react'

/**
 * Lightweight markdown → React renderer.
 * Handles: headers, bold, italic, strikethrough, inline code, code blocks,
 * unordered/ordered/nested lists, task lists, blockquotes (nested), tables,
 * images, links, horizontal rules.
 * No external dependencies. Intentionally simple, not a full markdown parser.
 * Raw HTML is escaped for security, never rendered as executable markup.
 */

const inlineStyle = (tag, baseStyle) => {
  const styles = {
    h1: {
      fontSize: 22, fontWeight: 600, lineHeight: 1.3,
      margin: '16px 0 8px', paddingBottom: 6,
      borderBottom: '1px solid rgba(90,106,122,0.25)',
      color: '#e8eaed',
    },
    h2: {
      fontSize: 18, fontWeight: 600, lineHeight: 1.3,
      margin: '14px 0 6px', paddingBottom: 5,
      borderBottom: '1px solid rgba(90,106,122,0.2)',
      color: '#e8eaed',
    },
    h3: { fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: '12px 0 4px', color: '#e8eaed' },
    strong: { fontWeight: 600, color: '#e8eaed' },
    em: { fontStyle: 'italic', color: '#e8eaed' },
    del: { textDecoration: 'line-through', color: '#9aa0a6' },
    code: {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      background: 'rgba(90,106,122,0.15)',
      padding: '1px 5px',
      borderRadius: 3,
      color: '#d0d0d0',
    },
    pre: {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      background: '#151a24',
      border: '1px solid rgba(90,106,122,0.25)',
      borderRadius: 6,
      padding: '12px 16px',
      overflow: 'auto',
      margin: '8px 0',
      color: '#d0e0d0',
      lineHeight: 1.5,
      whiteSpace: 'pre',
    },
    blockquote: {
      borderLeft: '3px solid rgba(90,106,122,0.4)',
      margin: '8px 0',
      padding: '4px 16px',
      color: '#6a7a8a',
      fontStyle: 'italic',
    },
    hr: {
      border: 'none',
      borderTop: '1px solid rgba(90,106,122,0.25)',
      margin: '16px 0',
    },
    ul: { margin: '4px 0', paddingLeft: 20, listStyleType: 'disc' },
    ol: { margin: '4px 0', paddingLeft: 20, listStyleType: 'decimal' },
    li: { margin: '2px 0', lineHeight: 1.6, color: '#e8eaed' },
    p: { margin: '4px 0', lineHeight: 1.6, color: '#e8eaed' },
    a: { color: '#5b9fd4', textDecoration: 'none' },
    table: {
      borderCollapse: 'collapse',
      margin: '8px 0',
      width: '100%',
      fontSize: 13,
    },
    th: {
      border: '1px solid rgba(90,106,122,0.3)',
      padding: '6px 10px',
      fontWeight: 600,
      color: '#e8eaed',
      background: 'rgba(90,106,122,0.1)',
      textAlign: 'left',
    },
    td: {
      border: '1px solid rgba(90,106,122,0.2)',
      padding: '6px 10px',
      color: '#d0d0d0',
    },
  }
  return styles[tag] || baseStyle || {}
}

/**
 * Escape < and > in text content to prevent raw HTML from being visible.
 * We do NOT escape & because it would break markdown syntax (e.g. **foo & bar**).
 * React text nodes already escape & automatically for DOM safety.
 */
function escapeAngleBrackets(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Parse inline markdown: **bold**, *italic*, ~~strikethrough~~, `code`, ![img](url), [link](url) */
function parseInline(text, keyPrefix) {
  const parts = []
  // Order matters: images before links, strikethrough before bold/italic single *
  const regex = /(!\[([^\]]*)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match
  let idx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t${idx++}`}>{escapeAngleBrackets(text.slice(lastIndex, match.index))}</span>)
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      // ![alt](url) image
      parts.push(
        <img
          key={`${keyPrefix}-img${idx++}`}
          src={match[3]}
          alt={match[2]}
          style={{ maxWidth: '100%', height: 'auto', borderRadius: 4, margin: '4px 0' }}
        />
      )
    } else if (match[4]) {
      // **bold**
      parts.push(<strong key={`${keyPrefix}-b${idx++}`} style={inlineStyle('strong')}>{match[4]}</strong>)
    } else if (match[5]) {
      // *italic*
      parts.push(<em key={`${keyPrefix}-i${idx++}`} style={inlineStyle('em')}>{match[5]}</em>)
    } else if (match[6]) {
      // ~~strikethrough~~
      parts.push(<del key={`${keyPrefix}-d${idx++}`} style={inlineStyle('del')}>{match[6]}</del>)
    } else if (match[7]) {
      // `code`
      parts.push(<code key={`${keyPrefix}-c${idx++}`} style={inlineStyle('code')}>{match[7]}</code>)
    } else if (match[8] && match[9]) {
      // [text](url)
      parts.push(
        <a key={`${keyPrefix}-a${idx++}`} href={match[9]} style={inlineStyle('a')} target="_blank" rel="noopener noreferrer">
          {match[8]}
        </a>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-t${idx++}`}>{escapeAngleBrackets(text.slice(lastIndex))}</span>)
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Detect nesting depth of blockquote lines.
 * "> > text" has depth 2, "> text" has depth 1.
 */
function getBlockquoteDepth(line) {
  let depth = 0
  let pos = 0
  while (pos < line.length && line[pos] === '>') {
    depth++
    pos++
    if (pos < line.length && line[pos] === ' ') pos++
  }
  return depth
}

/**
 * Strip leading "> " markers for a given depth from a line.
 */
function stripBlockquoteMarkers(line, depth) {
  let result = line
  for (let d = 0; d < depth; d++) {
    if (result.startsWith('> ')) {
      result = result.slice(2)
    } else if (result.startsWith('>')) {
      result = result.slice(1)
    }
  }
  return result
}

/**
 * Parse a blockquote block into nested <blockquote> elements.
 */
function parseBlockquoteBlock(lines, keyPrefix) {
  if (lines.length === 0) return null

  const maxDepth = Math.max(...lines.map(l => getBlockquoteDepth(l)))

  function buildLevel(currentLines, depth) {
    if (depth > maxDepth) {
      // Leaf level, render lines as content
      return currentLines.map((line, i) => (
        <span key={`${keyPrefix}-ln-${depth}-${i}`}>
          {parseInline(line, `${keyPrefix}-l-${depth}-${i}`)}
          {i < currentLines.length - 1 && <br />}
        </span>
      ))
    }

    const groups = []
    let currentGroup = []
    let currentGroupDepth = -1

    for (const line of currentLines) {
      const lineDepth = getBlockquoteDepth(line)
      const content = stripBlockquoteMarkers(line, depth)

      if (lineDepth >= depth) {
        if (lineDepth === depth) {
          // Same depth, new item in current group
          if (currentGroup.length > 0) {
            groups.push({ depth: currentGroupDepth, lines: currentGroup })
          }
          currentGroup = [content]
          currentGroupDepth = lineDepth
        } else {
          // Deeper, belongs to current group's nested content
          if (currentGroup.length === 0) {
            currentGroup = [content]
            currentGroupDepth = lineDepth
          } else {
            currentGroup.push(content)
          }
        }
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ depth: currentGroupDepth, lines: currentGroup })
    }

    return groups.map((group, gi) => (
      <blockquote key={`${keyPrefix}-bq-${depth}-${gi}`} style={inlineStyle('blockquote')}>
        {group.depth > depth
          ? buildLevel(group.lines, group.depth)
          : group.lines.map((line, li) => (
              <span key={`${keyPrefix}-bl-${depth}-${gi}-${li}`}>
                {parseInline(line, `${keyPrefix}-bl-${depth}-${gi}-${li}`)}
                {li < group.lines.length - 1 && <br />}
              </span>
            ))
        }
      </blockquote>
    ))
  }

  return buildLevel(lines, 1)
}

/**
 * Count leading spaces to determine list nesting depth.
 * Tab counts as 2 spaces (GFM convention).
 */
function getIndentWidth(line) {
  let width = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') width += 1
    else if (line[i] === '\t') width += 2
    else break
  }
  return width
}

/**
 * Parse a list item line's content and detect if it's a task list item.
 * Returns { content, isTask, checked }
 */
function parseListItemContent(text) {
  const taskMatch = text.match(/^\[([ xX])\]\s*(.*)/)
  if (taskMatch) {
    return { content: taskMatch[2], isTask: true, checked: taskMatch[1] !== ' ' }
  }
  return { content: text, isTask: false, checked: false }
}

/**
 * Build a list (ul/ol) from a slice of list lines, respecting indentation nesting.
 * Each line: { indent, ordered, marker, content }
 */
function buildNestedList(items, ordered, keyPrefix, depth = 0) {
  const Tag = ordered ? 'ol' : 'ul'
  const listItems = []
  let i = 0

  while (i < items.length) {
    const item = items[i]
    const { content, isTask, checked } = parseListItemContent(item.content)

    // Check for nested children (lines with greater indent)
    const nestedItems = []
    i++
    while (i < items.length && items[i].indent > item.indent) {
      nestedItems.push(items[i])
      i++
    }

    // Recursively build nested list if there are children
    let nestedContent = null
    if (nestedItems.length > 0) {
      const nestedOrdered = nestedItems[0].ordered
      const grouped = []
      let j = 0
      while (j < nestedItems.length) {
        const childItem = nestedItems[j]
        const subNested = []
        j++
        while (j < nestedItems.length && nestedItems[j].indent > childItem.indent) {
          subNested.push(nestedItems[j])
          j++
        }
        grouped.push({ item: childItem, children: subNested })
      }

      nestedContent = (
        <Tag key={`${keyPrefix}-nest-${depth}-${i}`} style={{ ...inlineStyle('ul'), paddingLeft: 16 + depth * 8, listStyleType: nestedOrdered ? 'decimal' : 'circle' }}>
          {grouped.map((g, gi) => {
            const gc = parseListItemContent(g.item.content)
            return (
              <li key={`${keyPrefix}-nestli-${depth}-${i}-${gi}`} style={inlineStyle('li')}>
                {gc.isTask && (
                  <span style={{ marginRight: 6, display: 'inline-block', width: 14, textAlign: 'center' }}>
                    {gc.checked ? '☑' : '☐'}
                  </span>
                )}
                {parseInline(gc.content, `${keyPrefix}-nestli-${depth}-${i}-${gi}`)}
                {g.children.length > 0 && buildNestedList(g.children, nestedOrdered, `${keyPrefix}-sub-${depth}-${i}-${gi}`, depth + 1)}
              </li>
            )
          })}
        </Tag>
      )
    }

    const liKey = `${keyPrefix}-li-${depth}-${i}`

    if (isTask) {
      listItems.push(
        <li key={liKey} style={{ ...inlineStyle('li'), display: 'flex', alignItems: 'flex-start', gap: 6, ...(checked ? { textDecoration: 'line-through', opacity: 0.7 } : {}) }}>
          <span style={{ display: 'inline-block', width: 14, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>
            {checked ? '☑' : '☐'}
          </span>
          <span style={{ flex: 1 }}>{parseInline(content, `${liKey}-c`)}</span>
          {nestedContent}
        </li>
      )
    } else {
      listItems.push(
        <li key={liKey} style={inlineStyle('li')}>
          {parseInline(content, `${liKey}-c`)}
          {nestedContent}
        </li>
      )
    }
  }

  return (
    <Tag key={`${keyPrefix}`} style={{ ...inlineStyle('ul'), paddingLeft: 20 + depth * 16, listStyleType: ordered ? 'decimal' : (depth === 0 ? 'disc' : 'circle') }}>
      {listItems}
    </Tag>
  )
}

/**
 * Parse table lines into a <table> element.
 * Expects: header row, separator row (|---|---|), data rows.
 */
function parseTable(headerLine, separatorLine, dataLines, keyPrefix) {
  const parseCells = (line) =>
    line.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1)

  const parseAlignment = (sepLine) => {
    const cells = parseCells(sepLine)
    return cells.map(cell => {
      const left = cell.startsWith(':')
      const right = cell.endsWith(':')
      if (left && right) return 'center'
      if (right) return 'right'
      return 'left'
    })
  }

  const headers = parseCells(headerLine)
  const alignments = parseAlignment(separatorLine)
  const rows = dataLines.map(line => parseCells(line))

  return (
    <table key={keyPrefix} style={inlineStyle('table')}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={`${keyPrefix}-th-${i}`} style={{ ...inlineStyle('th'), textAlign: alignments[i] || 'left' }}>
              {parseInline(h, `${keyPrefix}-thc-${i}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={`${keyPrefix}-tr-${ri}`}>
            {headers.map((_, ci) => (
              <td key={`${keyPrefix}-td-${ri}-${ci}`} style={{ ...inlineStyle('td'), textAlign: alignments[ci] || 'left' }}>
                {row[ci] ? parseInline(row[ci], `${keyPrefix}-tdc-${ri}-${ci}`) : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Split markdown text into a flat array of block-level elements as React nodes */
export function renderMarkdown(text) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block: ```lang ... ```
    if (line.trimStart().startsWith('```')) {
      const codeLines = []
      i++ // skip opening fence
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      elements.push(
        <pre key={`pre-${elements.length}`} style={inlineStyle('pre')}>
          {escapeAngleBrackets(codeLines.join('\n'))}
        </pre>
      )
      continue
    }

    // Horizontal rule: --- or *** or ___
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      elements.push(<hr key={`hr-${elements.length}`} style={inlineStyle('hr')} />)
      i++
      continue
    }

    // Headers: # ... ######
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const tag = `h${level}`
      elements.push(
        React.createElement(tag, { key: `${tag}-${elements.length}`, style: inlineStyle(tag) },
          ...parseInline(headerMatch[2], `h${level}-${elements.length}`)
        )
      )
      i++
      continue
    }

    // Table detection: line starts with | followed by separator row |---|
    if (line.trimStart().startsWith('|') && i + 1 < lines.length && /^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?\s*$/.test(lines[i + 1].trim())) {
      const headerLine = line
      const separatorLine = lines[i + 1]
      i += 2
      const dataLines = []
      while (i < lines.length && lines[i].trimStart().startsWith('|') && lines[i].trim() !== '') {
        dataLines.push(lines[i])
        i++
      }
      elements.push(parseTable(headerLine, separatorLine, dataLines, `tbl-${elements.length}`))
      continue
    }

    // Blockquote: > ...
    if (line.startsWith('> ') || line === '>') {
      const quoteLines = []
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i])
        i++
      }
      elements.push(parseBlockquoteBlock(quoteLines, `bq-${elements.length}`))
      continue
    }

    // Unordered list: - or * or + (check indentation)
    if (/^[-*+]\s+/.test(line)) {
      const listItems = []
      while (i < lines.length && /^[\t ]*[-*+]\s+/.test(lines[i])) {
        const currentLine = lines[i]
        const indent = getIndentWidth(currentLine)
        const content = currentLine.trim().replace(/^[-*+]\s+/, '')
        listItems.push({ indent, ordered: false, marker: currentLine.trim()[0], content })
        i++
      }
      elements.push(buildNestedList(listItems, false, `ul-${elements.length}`))
      continue
    }

    // Ordered list: 1. 2. etc. (check indentation)
    if (/^\d+\.\s+/.test(line)) {
      const listItems = []
      while (i < lines.length && /^[\t ]*\d+\.\s+/.test(lines[i])) {
        const currentLine = lines[i]
        const indent = getIndentWidth(currentLine)
        const content = currentLine.trim().replace(/^\d+\.\s+/, '')
        listItems.push({ indent, ordered: true, marker: '.', content })
        i++
      }
      elements.push(buildNestedList(listItems, true, `ol-${elements.length}`))
      continue
    }

    // Empty line, spacer
    if (line.trim() === '') {
      elements.push(<div key={`sp-${elements.length}`} style={{ height: 8 }} />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${elements.length}`} style={inlineStyle('p')}>
        {parseInline(line, `p-${elements.length}`)}
      </p>
    )
    i++
  }

  return elements
}
