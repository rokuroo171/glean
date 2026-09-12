import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import MilkdownEditor, { useMilkdownCommands } from './MilkdownEditor'
import { editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, createCodeBlockCommand, wrapInHeadingCommand, turnIntoTextCommand, insertHrCommand } from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history'
import StarIcon from './StarIcon'
import Icon from './Icon'
import ContextMenu from './ContextMenu'
import FindReplace from './FindReplace'

const ANIM_SPARKLE_MS = 450
let _animId = 0

// Dead-space strip beside the editor body. Left click toggles centered
// reading width; right click opens the view menu. The gutters flex-grow
// so in centered mode they ARE the empty margins around the text column,
// giving the clicks a visible target at any window size
function Gutter({ onToggle, menuItems, grow }) {
  return (
    <ContextMenu
      items={menuItems}
      width={230}
      triggerStyle={{ display: 'contents' }}
    >
      <div
        onClick={onToggle}
        title="Click to toggle centered width"
        style={{
          width: grow ? undefined : 20,
          flex: grow ? '1 1 0' : '0 0 20px',
          minWidth: 20,
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'flex 0.18s ease',
        }}
      />
    </ContextMenu>
  )
}

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
  const { prefs, updatePrefs } = usePreferences()
  const editorContainerRef = useRef(null)
  const editorInstanceRef = useRef(null)
  const fileInputRef = useRef(null)
  const [currentHeading, setCurrentHeading] = useState(0)
  const [showFind, setShowFind] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })
  const animatedEnabled = prefs.editor.animated_text_enabled === true
  const narrowWidth = prefs.editor.narrow_width === true
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

  function scrollToHeading(index) {
    setCurrentHeading(index)
    const view = getView()
    if (!view) return
    // Pick the Nth heading node from the live doc so the jump target can
    // never drift. Skip blockquote subtrees: the outline parser only sees
    // column-0 headings, so quoted headings must not shift the index
    let count = -1
    let target = null
    view.state.doc.descendants((node, pos) => {
      if (target != null) return false
      if (node.type.name === 'blockquote') return false
      if (node.type.name !== 'heading') return true
      count++
      if (count === index) { target = pos + 1; return false }
      return true
    })
    if (target == null) return
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(target), 1)))
    view.focus()
    // Selection, focus, and ProseMirror each emit their own caret-into-view
    // passes that race an immediate scroll, so correct from the settled DOM
    // instead. Two passes keep it idempotent against stragglers
    const alignHeading = () => {
      const el = [...view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .filter((h) => !h.closest('blockquote'))[index]
      if (!el || !el.isConnected) return
      let scroller = null
      let n = el.parentElement
      while (n) {
        const oy = getComputedStyle(n).overflowY
        if (oy === 'auto' || oy === 'scroll') { scroller = n; break }
        n = n.parentElement
      }
      if (!scroller) return
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    }
    setTimeout(alignHeading, 16)
    setTimeout(alignHeading, 90)
  }

  function handleSelectionChange(_ctx, selection) {
    // The listener fires mid-transaction where editorViewCtx is not yet
    // readable; deferring also lets coordsAtPos see the settled DOM
    setTimeout(() => {
      const view = getView()
      if (!view) return
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
    }, 0)
  }

  function handleBodyChange(newBody) {
    onBodyChange(newBody)
    setDirty(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => flushRef.current(), (prefs.editor.autosave_interval || 3) * 1000)
  }

  const showOutline = prefs.editor.show_outline !== false && headings.length >= 3

  const toolbarBtn = { background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  // Selection helpers for the editor context menu. Commands need a
  // non-collapsed selection; the menu itself runs with focus on the menu,
  // so the ProseMirror selection survives
  const selectionText = () => {
    const view = getView()
    if (!view) return ''
    return view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, ' ')
  }

  const copySelection = () => {
    const text = selectionText()
    if (text) navigator.clipboard?.writeText(text).catch(() => {})
  }

  const cutSelection = () => {
    const view = getView()
    if (!view) return
    const text = selectionText()
    if (!text) return
    navigator.clipboard?.writeText(text).catch(() => {})
    view.dispatch(view.state.tr.deleteSelection())
    view.focus()
  }

  const pasteIntoSelection = () => {
    const view = getView()
    if (!view) return
    navigator.clipboard?.readText()
      .then((text) => {
        if (text) view.dispatch(view.state.tr.insertText(text))
        view.focus()
      })
      .catch(() => view.focus())
  }

  const selectAllInEditor = () => {
    const view = getView()
    if (!view) return
    const { state } = view
    view.dispatch(state.tr.setSelection(state.selection.constructor.create(state.doc, 0, state.doc.content.size)))
    view.focus()
  }

  const editorMenuItems = [
    { id: 'copy', label: 'Copy', icon: 'copy', disabled: !selectionText(), onSelect: copySelection },
    { id: 'cut', label: 'Cut', icon: 'scissors', disabled: !selectionText(), onSelect: cutSelection },
    { id: 'paste', label: 'Paste', icon: 'paste', onSelect: pasteIntoSelection },
    { id: 'sep-clip', type: 'separator' },
    {
      id: 'format', label: 'Format', icon: 'pencil',
      submenu: [
        { id: 'fmt-bold', label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', onSelect: () => dispatchCommand(toggleStrongCommand.key) },
        { id: 'fmt-italic', label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', onSelect: () => dispatchCommand(toggleEmphasisCommand.key) },
        { id: 'fmt-strike', label: 'Strikethrough', icon: 'strikethrough', onSelect: () => dispatchCommand(toggleStrikethroughCommand.key) },
        { id: 'fmt-code', label: 'Inline code', icon: 'code', onSelect: () => dispatchCommand(toggleInlineCodeCommand.key) },
      ],
    },
    {
      id: 'para', label: 'Paragraph', icon: 'layout-list',
      submenu: [
        { id: 'para-text', label: 'Body text', onSelect: () => dispatchCommand(turnIntoTextCommand.key) },
        { id: 'para-h1', label: 'Heading 1', onSelect: () => dispatchCommand(wrapInHeadingCommand.key, 1) },
        { id: 'para-h2', label: 'Heading 2', onSelect: () => dispatchCommand(wrapInHeadingCommand.key, 2) },
        { id: 'para-h3', label: 'Heading 3', onSelect: () => dispatchCommand(wrapInHeadingCommand.key, 3) },
        { id: 'para-quote', label: 'Quote', icon: 'quote', onSelect: () => dispatchCommand(wrapInBlockquoteCommand.key) },
        { id: 'para-codeblock', label: 'Code block', icon: 'braces', onSelect: () => dispatchCommand(createCodeBlockCommand.key) },
      ],
    },
    {
      id: 'insert', label: 'Insert', icon: 'plus',
      submenu: [
        { id: 'ins-bullet', label: 'Bullet list', icon: 'list', onSelect: () => dispatchCommand(wrapInBulletListCommand.key) },
        { id: 'ins-ordered', label: 'Numbered list', icon: 'list-ordered', onSelect: () => dispatchCommand(wrapInOrderedListCommand.key) },
        { id: 'ins-rule', label: 'Divider', onSelect: () => dispatchCommand(insertHrCommand.key) },
        { id: 'ins-link', label: 'Link to note', icon: 'link', onSelect: () => { const view = getView(); if (view) { view.dispatch(view.state.tr.insertText('[[')); view.focus() } } },
        { id: 'ins-image', label: 'Image', icon: 'image', onSelect: () => fileInputRef.current?.click() },
      ],
    },
    { id: 'sep-edit', type: 'separator' },
    { id: 'select-all', label: 'Select all', onSelect: selectAllInEditor },
  ]

  const viewMenuItems = [
    {
      id: 'vw-outline', label: 'Outline', checked: prefs.editor.show_outline !== false,
      onSelect: () => updatePrefs({ editor: { show_outline: prefs.editor.show_outline === false } }),
    },
    { id: 'sep-view', type: 'separator' },
    {
      id: 'vw-width', label: 'Centered width', checked: narrowWidth,
      onSelect: () => updatePrefs({ editor: { narrow_width: !narrowWidth } }),
    },
    {
      id: 'vw-wrap', label: 'Word wrap', checked: prefs.editor.word_wrap !== false,
      onSelect: () => updatePrefs({ editor: { word_wrap: prefs.editor.word_wrap === false } }),
    },
    {
      id: 'vw-linenum', label: 'Line numbers', checked: prefs.editor.line_numbers === true,
      onSelect: () => updatePrefs({ editor: { line_numbers: prefs.editor.line_numbers !== true } }),
    },
  ]

  const breadcrumbParts = []
  if (note) {
    if (note.folder) breadcrumbParts.push(...note.folder.split('/').filter(Boolean))
    breadcrumbParts.push(note.title)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
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
              <button key={i} type="button" onClick={() => scrollToHeading(i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: i === currentHeading ? 'rgba(180, 140, 80, 0.12)' : 'none', border: 'none', color: i === currentHeading ? colors.accent : colors.textMuted, fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11, fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400, padding: '3px 6px', cursor: 'pointer', paddingLeft: 6 + (h.level - 1) * 10, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.text}</button>
            ))}
          </div>
        )}
        <div ref={editorContainerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'row' }}>
          <Gutter onToggle={() => updatePrefs({ editor: { narrow_width: !narrowWidth } })} menuItems={viewMenuItems} grow={narrowWidth} />
          <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
            <div style={{ flex: narrowWidth ? '0 0 720px' : '1 1 0', minWidth: 0, minHeight: 0, maxWidth: narrowWidth ? 'min(720px, calc(100% - 80px))' : undefined }}>
              <MilkdownEditor
                key={note?.id}
                markdown={body}
                onMarkdownChange={handleBodyChange}
                onSelectionChange={handleSelectionChange}
                editorInstanceRef={editorInstanceRef}
              />
            </div>
          </ContextMenu>
          <Gutter onToggle={() => updatePrefs({ editor: { narrow_width: !narrowWidth } })} menuItems={viewMenuItems} grow={narrowWidth} />
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
