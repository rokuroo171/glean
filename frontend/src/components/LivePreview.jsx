import { useState, useRef, useEffect, useCallback } from 'react'
import { colors } from '../lib/theme'
import { renderMarkdown } from '../lib/markdown'
import { parseSections } from '../lib/sectionParser'

/**
 * LivePreview: Obsidian-style editing.
 * - Default: everything rendered via react-markdown
 * - Click a section: that section swaps to a textarea showing raw source
 * - Blur/Enter: textarea swaps back to rendered react-markdown
 *
 * No CM6. No decoration engine. Just react-markdown + textarea.
 */
export default function LivePreview({ body, onBodyChange, noteNames, onNoteLink, tabWidth = 2 }) {
  const [activeSection, setActiveSection] = useState(null) // index
  const [draft, setDraft] = useState('')
  const textareaRef = useRef(null)
  const sections = parseSections(body)

  const activateSection = useCallback((index) => {
    const sec = sections[index]
    if (!sec) return
    const raw = body.slice(sec.from, sec.to)
    setDraft(raw)
    setActiveSection(index)
  }, [sections, body])

  const commitSection = useCallback(() => {
    if (activeSection === null) return
    const sec = sections[activeSection]
    if (!sec) return
    const before = body.slice(0, sec.from)
    const after = body.slice(sec.to)
    const newBody = before + draft + after
    onBodyChange(newBody)
    setActiveSection(null)
    setDraft('')
  }, [activeSection, sections, body, draft, onBodyChange])

  const cancelSection = useCallback(() => {
    setActiveSection(null)
    setDraft('')
  }, [])

  // Focus textarea when section activates
  useEffect(() => {
    if (activeSection !== null && textareaRef.current) {
      textareaRef.current.focus()
      // Place cursor at end
      const ta = textareaRef.current
      ta.selectionStart = ta.value.length
      ta.selectionEnd = ta.value.length
    }
  }, [activeSection])

  // Handle key events in textarea
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelSection()
    }
    // Tab inserts spaces instead of moving focus
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const val = ta.value
      const spaces = ' '.repeat(tabWidth)
      setDraft(val.slice(0, start) + spaces + val.slice(end))
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = start + spaces.length
        ta.selectionEnd = start + spaces.length
      })
    }
  }, [cancelSection])

  // Inline styles for sections
  const sectionStyle = {
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 4px',
    margin: '-2px -4px',
    transition: 'background 120ms ease',
  }

  const hoverStyle = {
    background: 'rgba(180, 140, 80, 0.08)',
  }

  return (
    <div style={{ padding: '12px 16px', color: colors.text, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
      {sections.map((sec, i) => {
        if (activeSection === i) {
          // Edit mode: textarea with raw source
          return (
            <textarea
              key={i}
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitSection}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                minHeight: 60,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 14,
                lineHeight: 1.6,
                color: colors.text,
                background: 'rgba(90, 106, 122, 0.08)',
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 6,
                padding: '8px 12px',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 8,
              }}
            />
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
              ...sectionStyle,
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
