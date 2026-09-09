import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import MilkdownEditor, { useMilkdownCommands } from './MilkdownEditor'
import { editorViewCtx } from '@milkdown/core'
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, createCodeBlockCommand } from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history'
import StarIcon from './StarIcon'
import Icon from './Icon'
import ContextMenu from './ContextMenu'
import FindReplace from './FindReplace'

const ANIM_SPARKLE_MS = 450
let _animId = 0

function AnimItem({ a, accent }) {
  return (
    <span style={{
      position: 'absolute', left: a.x, top: a.y,
      width: 4, height: 4, borderRadius: 2,
      background: accent || 'currentColor',
      pointerEvents: 'none', zIndex: 50, opacity: 0,
      animation: `animSparkle ${ANIM_SPARKLE_MS}ms ease-out forwards`,
      '--dx': `${a.dx}px`, '--dy': `${a.dy}px`
    }} />
  )
}

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
  function handleNoteLink(title, id) {
    if (id && onOpenNote) { onOpenNote(id); return }
    if (!id && onNewNote) onNewNote(title)
  }
  const { prefs } = usePreferences()
  const editorContainerRef = useRef(null)
  const editorInstanceRef = useRef(null)
  const fileInputRef = useRef(null)
  const [currentHeading, setCurrentHeading] = useState(0)
  const [showFind, setShowFind] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const [animItems, setAnimItems] = useState([])
  const [linkPopup, setLinkPopup] = useState(null)
  const headings = useMemo(() => parseHeadings(body), [body])
  const debounceRef = useRef(null)
  const flushRef = useRef(null)
  const { dispatchCommand, getView } = useMilkdownCommands(editorInstanceRef)

  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  function insertWikilink(title) {
    const view = getView()
    if (!view) return
    const head = view.state.selection.head
    const text = view.state.doc.textBetween(0, head)
    const openBracket = text.lastIndexOf('[[')
    if (openBracket < 0) return
    const link = `[[${title}]]`
    view.dispatch(view.state.tr.insertText(link, openBracket, head))
    setLinkPopup(null)
    view.focus()
  }

  function handleSelectionChange(ctx, selection) {
    const view = ctx.get(editorViewCtx)
    const cursor = selection.head
    const text = view.state.doc.textContent
    if (onCursorChange) {
      const before = text.slice(0, cursor)
      onCursorChange({ line: before.split('\n').length, col: before.slice(before.lastIndexOf('\n') + 1).length + 1 })
    }
    if (!noteNames || Object.keys(noteNames).length === 0) { setLinkPopup(null); return }
    const before = text.slice(0, cursor)
    const openBracket = before.lastIndexOf('[[')
    if (openBracket < 0) { setLinkPopup(null); return }
    const afterOpen = before.slice(openBracket + 2)
    if (afterOpen.includes(']]') || afterOpen.includes('\n')) { setLinkPopup(null); return }
    const query = afterOpen.toLowerCase()
    const typed = text.slice(openBracket + 2, cursor).toLowerCase()
    const matches = Object.keys(noteNames).filter(t => t.toLowerCase().includes(query) && t.toLowerCase() !== typed).slice(0, 8)
    if (matches.length === 0) { setLinkPopup(null); return }
    const coords = view.coordsAtPos(cursor)
    if (!coords) { setLinkPopup(null); return }
    setLinkPopup({ query, index: 0, pos: { top: coords.bottom + 4, left: coords.left } })
  }

  function handleBodyChange(newBody) {
    onBodyChange(newBody)
    setDirty(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flushRef.current(), (prefs.editor.autosave_interval || 3) * 1000)
  }

  const showOutline = headings.length >= 3

  const toolbarBtn = { background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  const editorMenuItems = [
    { label: 'Bold', action: () => dispatchCommand(toggleStrongCommand.key) },
    { label: 'Italic', action: () => dispatchCommand(toggleEmphasisCommand.key) },
    { label: 'Strikethrough', action: () => dispatchCommand(toggleStrikethroughCommand.key) },
    { label: 'Inline code', action: () => dispatchCommand(toggleInlineCodeCommand.key) },
    { label: 'Blockquote', action: () => dispatchCommand(wrapInBlockquoteCommand.key) },
    { label: 'Bullet list', action: () => dispatchCommand(wrapInBulletListCommand.key) },
    { label: 'Code fence', action: () => dispatchCommand(createCodeBlockCommand.key) },
  ]

  const breadcrumbParts = []
  if (note) {
    if (note.folder) breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
    breadcrumbParts.push(note.title)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, background: colors.bgElevated }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.textMuted, overflow: 'hidden', flex: 1 }}>
          {breadcrumbParts.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {i > 0 && <span style={{ color: colors.textDim }}>/</span>}
              <span style={{ color: i === breadcrumbParts.length - 1 ? colors.text : colors.textMuted }}>{part}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canUndo ? 1 : 0.3 }} onClick={() => dispatchCommand(undoCommand.key)} title="Undo (Ctrl+Z)">
            <Icon name="undo" size={14} />
          </button>
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canRedo ? 1 : 0.3 }} onClick={() => dispatchCommand(redoCommand.key)} title="Redo (Ctrl+Shift+Z)">
            <Icon name="redo" size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: colors.border, margin: '0 4px' }} />
          <button type="button" data-tip="Bold (Ctrl+B)" onClick={() => dispatchCommand(toggleStrongCommand.key)} style={toolbarBtn}><Icon name="bold" size={14} /></button>
          <button type="button" data-tip="Italic (Ctrl+I)" onClick={() => dispatchCommand(toggleEmphasisCommand.key)} style={toolbarBtn}><Icon name="italic" size={14} /></button>
          <button type="button" data-tip="Strikethrough" onClick={() => dispatchCommand(toggleStrikethroughCommand.key)} style={toolbarBtn}><Icon name="strikethrough" size={14} /></button>
          <button type="button" data-tip="Inline code" onClick={() => dispatchCommand(toggleInlineCodeCommand.key)} style={toolbarBtn}><Icon name="code" size={14} /></button>
          <button type="button" data-tip="Blockquote" onClick={() => dispatchCommand(wrapInBlockquoteCommand.key)} style={toolbarBtn}><Icon name="quote" size={14} /></button>
          <button type="button" data-tip="Bullet list" onClick={() => dispatchCommand(wrapInBulletListCommand.key)} style={toolbarBtn}><Icon name="list" size={14} /></button>
          <button type="button" data-tip="Code fence" onClick={() => dispatchCommand(createCodeBlockCommand.key)} style={toolbarBtn}><Icon name="braces" size={14} /></button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
      {linked && linked.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderBottom: `1px solid ${colors.border}`, fontSize: 12, color: colors.textMuted, flexShrink: 0, overflowX: 'auto' }}>
          <span style={{ ...typography.sectionLabel, color: colors.textMuted, marginRight: 2 }}>Trail</span>
          {linked.map(n => (
            <button key={n.id} type="button" onClick={() => onOpenNote(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: colors.bgElevated, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: colors.text, whiteSpace: 'nowrap' }}>
              <StarIcon species={n.species} size="sm" /><span>{n.title}</span>
            </button>
          ))}
        </div>
      )}
      {showFind && <FindReplace viewRef={{ current: getView() }} showReplace={showReplace} onClose={() => { setShowFind(false); setShowReplace(false) }} />}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
        {showOutline && (
          <div style={{ width: 180, borderRight: `1px solid ${colors.border}`, overflow: 'auto', padding: space[2], flexShrink: 0, background: 'rgba(11, 15, 25, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6 }}>Outline</div>
            {headings.map((h, i) => (
              <button key={i} type="button" onClick={() => setCurrentHeading(i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: i === currentHeading ? 'rgba(180, 140, 80, 0.12)' : 'none', border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted, fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11, fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400, padding: '3px 6px', cursor: 'pointer', paddingLeft: 6 + (h.level - 1) * 10, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.text}</button>
            ))}
          </div>
        )}
        <div ref={editorContainerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MilkdownEditor
                key={note?.id}
                markdown={body}
                onMarkdownChange={handleBodyChange}
                onSelectionChange={handleSelectionChange}
                editorInstanceRef={editorInstanceRef}
              />
            </div>
          </ContextMenu>
          {linkPopup && (() => {
            const matches = Object.keys(noteNames).filter(t => t.toLowerCase().includes(linkPopup.query)).slice(0, 8)
            if (matches.length === 0) return null
            return (
              <div onMouseDown={(e) => e.preventDefault()}
                style={{ position: 'fixed', left: linkPopup.pos.left, top: linkPopup.pos.top, zIndex: 50, minWidth: 180, maxHeight: 200, overflowY: 'auto', background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`, borderRadius: 8, boxShadow: colors.shadow, padding: 4 }}>
                {matches.map((title, i) => (
                  <button key={title} type="button" onClick={() => insertWikilink(title)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', background: i === linkPopup.index ? 'rgba(180, 140, 80, 0.14)' : 'transparent', color: colors.text, fontSize: 12.5, textAlign: 'left', fontFamily: 'inherit' }}>
                    <StarIcon species={noteNames[title] ? 'neutral' : 'warm'} size="sm" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                  </button>
                ))}
              </div>
            )
          })()}
          {animatedEnabled && animItems.map(a => <AnimItem key={a.id} a={a} accent={colors.accent} />)}
        </div>
      </div>
    </div>
  )
}
