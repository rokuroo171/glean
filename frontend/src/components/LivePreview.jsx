import { useState, useRef, useEffect, useCallback } from 'react'
import { colors } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'
import { parseSections } from '../lib/sectionParser'

/**
 * LivePreview: Obsidian-style inline editing.
 * - Default: everything rendered via react-markdown
 * - Click a section: that section becomes contenteditable inline with raw source
 * - Blur/Enter: contenteditable swaps back to rendered react-markdown
 *
 * No textarea boxes. The raw source appears right where the rendered content was.
 */
export default function LivePreview({ body, onBodyChange, noteNames, onNoteLink, tabWidth = 2 }) {
  const [activeSection, setActiveSection] = useState(null)
  const editRef = useRef(null)
  const sections = parseSections(body)

  const activateSection = useCallback((index) => {
    setActiveSection(index)
  }, [])

  const commitSection = useCallback(() => {
    if (activeSection === null || !editRef.current) return
    const sec = sections[activeSection]
    if (!sec) return
    const newContent = editRef.current.innerText
    const before = body.slice(0, sec.from)
    const after = body.slice(sec.to)
    onBodyChange(before + newContent + after)
    setActiveSection(null)
  }, [activeSection, sections, body, onBodyChange])

  const cancelSection = useCallback(() => {
    setActiveSection(null)
  }, [])

  // Focus and select contenteditable when section activates
  useEffect(() => {
    if (activeSection !== null && editRef.current) {
      const el = editRef.current
      el.focus()
      // Select all content
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [activeSection])

  // Handle key events in contenteditable
  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelSection()
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitSection()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const sel = window.getSelection()
      if (!sel.rangeCount) return
      const range = sel.getRangeAt(0)
      const spaces = ' '.repeat(tabWidth)
      range.insertNode(document.createTextNode(spaces))
      // Move cursor after inserted spaces
      range.setStartAfter(range.endContainer)
      range.setEndAfter(range.endContainer)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [cancelSection, commitSection, tabWidth])

  return (
    <div style={{ padding: '12px 16px', color: colors.text, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
      {sections.map((sec, i) => {
        if (activeSection === i) {
          // Inline edit mode: contenteditable div with raw source
          const raw = body.slice(sec.from, sec.to)
          return (
            <div
              key={i}
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={commitSection}
              onKeyDown={handleEditKeyDown}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 14,
                lineHeight: 1.6,
                color: colors.text,
                background: 'rgba(90, 106, 122, 0.06)',
                borderLeft: `2px solid ${colors.accent}`,
                padding: '4px 8px',
                margin: '4px 0',
                borderRadius: '0 4px 4px 0',
                outline: 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '1.6em',
              }}
            >
              {raw}
            </div>
          )
        }

        // Render mode: react-markdown for this section
        const raw = body.slice(sec.from, sec.to)
        return (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              activateSection(i)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(180, 140, 80, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
            style={{
              cursor: 'pointer',
              borderRadius: 4,
              padding: '2px 4px',
              margin: '-2px -4px',
              transition: 'background 120ms ease',
              background: 'transparent',
              minHeight: sec.type === 'code' ? 40 : undefined,
            }}
          >
            {renderMarkdown(raw, {
              noteNames,
              onNoteLink,
              onToggle: (newRaw) => {
                const before = body.slice(0, sec.from)
                const after = body.slice(sec.to)
                onBodyChange(before + newRaw + after)
              },
            })}
          </div>
        )
      })}
    </div>
  )
}
