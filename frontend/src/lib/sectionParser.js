/**
 * Parse markdown into blocks with source offsets.
 * Each block can be individually edited via a textarea,
 * while the rest stays rendered via react-markdown.
 */
export function parseSections(markdown) {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const sections = []
  let i = 0
  let offset = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*(.*)/)
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0]
      const lang = fenceMatch[2].trim()
      const startOffset = offset
      offset += line.length + 1
      i++
      while (i < lines.length) {
        const closeMatch = lines[i].match(/^(`{3,}|~{3,})\s*$/)
        if (closeMatch && closeMatch[1][0] === fenceChar) {
          offset += lines[i].length + 1
          i++
          break
        }
        offset += lines[i].length + 1
        i++
      }
      sections.push({
        type: 'code',
        lang,
        from: startOffset,
        to: offset,
      })
      continue
    }

    // Empty line
    if (line.trim() === '') {
      offset += line.length + 1
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const startOffset = offset
      offset += line.length + 1
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        from: startOffset,
        to: offset,
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      const startOffset = offset
      offset += line.length + 1
      sections.push({
        type: 'hr',
        from: startOffset,
        to: offset,
      })
      i++
      continue
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const startOffset = offset
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        offset += lines[i].length + 1
        i++
      }
      sections.push({
        type: 'blockquote',
        from: startOffset,
        to: offset,
      })
      continue
    }

    // Table (starts with |)
    if (/^\s*\|/.test(line)) {
      const startOffset = offset
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        offset += lines[i].length + 1
        i++
      }
      sections.push({
        type: 'table',
        from: startOffset,
        to: offset,
      })
      continue
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const startOffset = offset
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        offset += lines[i].length + 1
        i++
      }
      sections.push({
        type: 'list',
        ordered: false,
        from: startOffset,
        to: offset,
      })
      continue
    }

    // Ordered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const startOffset = offset
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        offset += lines[i].length + 1
        i++
      }
      sections.push({
        type: 'list',
        ordered: true,
        from: startOffset,
        to: offset,
      })
      continue
    }

    // Paragraph (default: consecutive non-empty, non-special lines)
    const startOffset = offset
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].match(/^#{1,6}\s/) &&
           !lines[i].match(/^(`{3,}|~{3,})/) &&
           !lines[i].match(/^\s*>/) &&
           !lines[i].match(/^\s*\|/) &&
           !lines[i].match(/^\s*[-*+]\s/) &&
           !lines[i].match(/^\s*\d+[.)]\s/) &&
           !lines[i].match(/^(\*{3,}|-{3,}|_{3,})\s*$/)) {
      offset += lines[i].length + 1
      i++
    }
    if (offset > startOffset) {
      sections.push({
        type: 'paragraph',
        from: startOffset,
        to: offset,
      })
    }
  }

  return sections
}
