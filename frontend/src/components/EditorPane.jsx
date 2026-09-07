import { useMemo, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import StarIcon from './StarIcon'
import Icon from './Icon'
import LivePreview from './LivePreview'

export function parseHeadings(markdown) {
  const out = []
  const lines = markdown.split('\n')
  let offset = 0
  let inFence = false
  let fenceChar = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(/^(\s*`{3,}|~{3,})\s*(.*)/)
    if (fenceMatch) {
      const char = fenceMatch[1].trim()[0]
      if (!inFence) { inFence = true; fenceChar = char }
      else if (char === fenceChar) { inFence = false }
      offset += line.length + 1
      continue
    }
    if (inFence) { offset += line.length + 1; continue }
    const atx = line.match(/^(#{1,6})\s+(.+)/)
    if (atx) {
      out.push({ level: atx[1].length, text: atx[2].replace(/\s+#+\s*$/, ''), offset })
      offset += line.length + 1
      continue
    }
    if (i + 1 < lines.length) {
      const next = lines[i + 1]
      const setextMatch = next.match(/^(=+|-+)\s*$/)
      if (setextMatch && line.trim().length > 0) {
        const underline = setextMatch[1][0]
        if (underline === '=' && line.trim().length > 0) {
          out.push({ level: 1, text: line.trim(), offset })
        } else if (underline === '-' && line.trim().length > 0 && !line.match(/^#{1,6}\s/)) {
          out.push({ level: 2, text: line.trim(), offset })
        }
      }
    }
    offset += line.length + 1
  }
  return out
}

export default function EditorPane({ note, body, onBodyChange, onSaveNow, dirty, setDirty,
  linked, onOpenNote, onNewNote, skyName, onCursorChange, noteNames }) {
  const { prefs } = usePreferences()
  const headings = useMemo(() => parseHeadings(body), [body])
  const [currentHeading, setCurrentHeading] = useState(0)

  function handleNoteLink(title, id) {
    if (id && onOpenNote) { onOpenNote(id); return }
    if (!id && onNewNote) onNewNote(title)
  }

  function jumpTo(offset, index) {
    setCurrentHeading(index)
    // TODO: scroll the LivePreview to the offset
  }

  const tabWidth = prefs.editor?.tab_width || 2

  // --- Breadcrumbs ---
  const breadcrumbParts = []
  if (note) {
    if (note.folder) breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
    breadcrumbParts.push(note.title)
  }

  const toolbarBtn = {
    background: 'none', border: 'none', color: colors.textMuted,
    cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
        background: colors.bgElevated }}>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
          color: colors.textMuted, overflow: 'hidden', flex: 1 }}>
          {breadcrumbParts.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {i > 0 && <span style={{ color: colors.textDim }}>/</span>}
              <span style={{ color: i === breadcrumbParts.length - 1 ? colors.text : colors.textMuted }}>
                {part}
              </span>
            </span>
          ))}
        </div>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button" data-tip="Bold" style={toolbarBtn}>
            <Icon name="bold" size={14} />
          </button>
          <button type="button" data-tip="Italic" style={toolbarBtn}>
            <Icon name="italic" size={14} />
          </button>
          <button type="button" data-tip="Strikethrough" style={toolbarBtn}>
            <Icon name="strikethrough" size={14} />
          </button>
          <button type="button" data-tip="Code" style={toolbarBtn}>
            <Icon name="code" size={14} />
          </button>
          <button type="button" data-tip="Link" style={toolbarBtn}>
            <Icon name="link" size={14} />
          </button>
          <button type="button" data-tip="List" style={toolbarBtn}>
            <Icon name="list" size={14} />
          </button>
        </div>
      </div>

      {/* Trail chips */}
      {linked && linked.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          borderBottom: `1px solid ${colors.border}`, fontSize: 12, color: colors.textMuted,
          flexShrink: 0, overflowX: 'auto' }}>
          <span style={{ ...typography.sectionLabel, color: colors.textMuted, marginRight: 2 }}>Trail</span>
          {linked.map(n => (
            <button key={n.id} type="button" onClick={() => onOpenNote(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: colors.bgElevated,
                border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px',
                cursor: 'pointer', fontSize: 11, color: colors.text, whiteSpace: 'nowrap' }}>
              <StarIcon species={n.species} size="sm" />
              <span>{n.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {/* Outline */}
        {headings.length >= 3 && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`,
            overflow: 'auto', padding: space[2], flexShrink: 0,
            background: 'rgba(11, 15, 25, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6 }}>Outline</div>
            {headings.map((h, i) => (
              <button key={i} type="button" onClick={() => jumpTo(h.offset, i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background:
                  i === currentHeading ? 'rgba(180, 140, 80, 0.12)' : 'none',
                  border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted,
                  fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11,
                  fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400,
                  padding: '3px 6px', cursor: 'pointer',
                  paddingLeft: 6 + (h.level - 1) * 10,
                  textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.text}</button>
            ))}
          </div>
        )}

        {/* Live preview: react-markdown renders, click to edit via textarea */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
          <LivePreview
            body={body}
            onBodyChange={onBodyChange}
            noteNames={noteNames}
            onNoteLink={handleNoteLink}
            tabWidth={tabWidth}
          />
        </div>
      </div>
    </div>
  )
}
