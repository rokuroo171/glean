import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import CM6Editor from './CM6Editor'
import CursorTrail from './CursorTrail'
import { formatToggle } from '../lib/cm6/keymaps'
import { openSearchPanel, searchPanelOpen } from '@codemirror/search'
import { EditorSelection, Text } from '@codemirror/state'
import { undoDepth, redoDepth } from '@codemirror/commands'
import StarIcon from './StarIcon'
import Icon from './Icon'
import ContextMenu from './ContextMenu'

// Dead-space strip beside the editor body. Left click is inert: clicking
// empty space must never silently flip a layout pref (it used to toggle
// centered width, which re-wrapped the document and looked like a word
// wrap switch). Right click still opens the view menu. The gutters
// flex-grow so in centered mode they ARE the empty margins around the
// text column
function Gutter({ menuItems, grow }) {
  return (
    <ContextMenu
      items={menuItems}
      width={230}
      triggerStyle={{ display: 'contents' }}
    >
      <div
        style={{
          width: grow ? undefined : 20,
          flex: grow ? '1 1 0' : '0 0 20px',
          minWidth: 20,
          flexShrink: 0,
        }}
      />
    </ContextMenu>
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
  const [currentHeading, setCurrentHeading] = useState(0)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })
  const [cmView, setCmView] = useState(null)
  const narrowWidth = prefs.editor.narrow_width === true
  const [linkPopup, setLinkPopup] = useState(null)
  const headings = useMemo(() => parseHeadings(body), [body])
  const popupMatches = useMemo(
    () => (linkPopup ? Object.keys(noteNames).filter((t) => t.toLowerCase().includes(linkPopup.query)).slice(0, 8) : null),
    [linkPopup, noteNames]
  )

  // Capture phase so arrows and Enter never reach the editor while the
  // picker is open: ArrowDown would otherwise move the caret and reset the
  // selection listener instead of moving the highlight
  function handlePopupKeys(e) {
    if (!linkPopup || !popupMatches?.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setLinkPopup((p) => ({ ...p, index: Math.min(Math.max(p.index + dir, 0), popupMatches.length - 1) }))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      insertWikilink(popupMatches[linkPopup.index])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setLinkPopup(null)
    }
  }
  const debounceRef = useRef(null)
  const flushRef = useRef(null)

  // the instance ref holds the live EditorView
  const getView = () => editorInstanceRef.current?.view || null

  const docText = (view, from, to) => view.state.sliceDoc(from, to)
  const docEnd = (view) => view.state.doc.length

  // formatting runs on the buffer through the keymap layer's toggles
  const formatInEditor = (kind, level) => {
    const view = getView()
    if (view) formatToggle(view, kind, level)
  }


  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setDirty(false)
    onSaveNow()
  }

  function insertWikilink(title) {
    const view = getView()
    if (!view) return
    const head = view.state.selection.head
    const text = docText(view, 0, head)
    const openBracket = text.lastIndexOf('[[')
    if (openBracket < 0) return
    // the paired close sits ahead of the caret after [[ auto-pairs, so the
    // replace range must swallow it or the insert doubles the brackets
    const ahead = docText(view, head, Math.min(head + 2, docEnd(view)))
    const closeLen = ahead === ']]' ? 2 : 0
    const link = `[[${title}]]`
    view.dispatch(view.state.tr.insertText(link, openBracket, head + closeLen))
    setLinkPopup(null)
    view.focus()
  }

  function scrollToHeading(index) {
    setCurrentHeading(index)
    const view = getView()
    if (!view) return
    const h = headings[index]
    if (!h) return
    // Land on the heading text, past the hash run, since the buffer is the
    // markdown itself and parseHeadings offsets are buffer offsets
    const prefix = body.slice(h.offset, h.offset + 8).match(/^#{1,6} /)
    const at = h.offset + (prefix ? prefix[0].length : 0)
    view.dispatch(view.state.tr.setSelection(EditorSelection.cursor(at)).scrollIntoView())
    view.focus()
  }

  function handleSelectionChange(_ctx, selection) {
    // Deferring lets coordsAtPos see the settled DOM
    setTimeout(() => {
      const view = getView()
      if (!view) return
      setCmView(view)
      const cursor = selection.head
      setHist({ canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 })
      if (onCursorChange) {
        const before = view.state.sliceDoc(0, cursor)
        onCursorChange({ line: before.split('\n').length, col: before.slice(before.lastIndexOf('\n') + 1).length + 1 })
      }
      if (!noteNames || Object.keys(noteNames).length === 0) { setLinkPopup(null); return }
      const before = view.state.sliceDoc(0, cursor)
      const openBracket = before.lastIndexOf('[[')
      if (openBracket < 0) { setLinkPopup(null); return }
      const afterOpen = before.slice(openBracket + 2)
      if (afterOpen.includes(']]') || afterOpen.includes('\n')) { setLinkPopup(null); return }
      const query = afterOpen.toLowerCase()
      const typed = before.slice(openBracket + 2, cursor).toLowerCase()
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

  // Selection helpers for the editor context menu. The menu itself runs
  // with focus on the menu, so the editor selection survives
  const selectionText = () => {
    const view = getView()
    if (!view) return ''
    return docText(view, view.state.selection.main.from, view.state.selection.main.to)
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
    view.dispatch(view.state.replaceSelection(Text.empty))
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

  const pastePlain = () => {
    const view = getView()
    if (!view) return
    navigator.clipboard?.readText()
      .then((text) => {
        if (text) view.dispatch(view.state.tr.insertText(text))
        view.focus()
      })
      .catch(() => view.focus())
  }

  const startWikilink = () => {
    const view = getView()
    if (!view) return
    view.dispatch(view.state.tr.insertText('[['))
    view.focus()
  }

  const insertExternalLink = () => {
    const view = getView()
    if (!view) return
    navigator.clipboard?.readText()
      .then((url) => {
        const sel = view.state.selection
        const label = docText(view, sel.from, sel.to, ' ') || 'link'
        const safe = /^https?:\/\/|^mailto:/i.test(url.trim()) ? url.trim() : ''
        view.dispatch(view.state.tr.insertText(`[${label}](${safe || 'https://'})`, sel.from, sel.to))
        view.focus()
      })
      .catch(() => view.focus())
  }

  const undoInEditor = () => {
    const inst = editorInstanceRef.current
    inst?.undo()
    // undo can restore the exact prior cursor, which fires no selection or
    // doc listener, so the button states must be refreshed from the history
    if (inst?.histState) setHist(inst.histState())
  }

  const redoInEditor = () => {
    const inst = editorInstanceRef.current
    inst?.redo()
    if (inst?.histState) setHist(inst.histState())
  }

  const selectAllInEditor = () => {
    const view = getView()
    if (!view) return
    view.dispatch(view.state.tr.setSelection(EditorSelection.range(0, view.state.doc.length)))
    view.focus()
  }

  // Ctrl+F and Ctrl+H work app-wide while a note is open, through the
  // CM6 search panel
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      const view = getView()
      if (!view) return
      if (key === 'f') {
        e.preventDefault()
        if (!searchPanelOpen(view.state)) openSearchPanel(view)
        else view.focus()
      } else if (key === 'h') {
        e.preventDefault()
        if (!searchPanelOpen(view.state)) {
          openSearchPanel(view)
          // the replace field is the panel's second input; open then move
          // focus there on the next frame once the panel DOM exists
          setTimeout(() => {
            const inputs = view.dom.querySelectorAll('.cm-panel input')
            if (inputs[1]) inputs[1].focus()
          }, 20)
        } else view.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const editorMenuItems = [
    { id: 'add-link', label: 'Add starline', icon: 'link', onSelect: startWikilink },
    { id: 'add-ext-link', label: 'Add external link', icon: 'external-link', onSelect: insertExternalLink },
    { id: 'sep-link', type: 'separator' },
    {
      id: 'format', label: 'Format', icon: 'pencil',
      submenu: [
        { id: 'fmt-bold', label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', onSelect: () => formatInEditor('bold') },
        { id: 'fmt-italic', label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', onSelect: () => formatInEditor('italic') },
        { id: 'fmt-strike', label: 'Strikethrough', icon: 'strikethrough', onSelect: () => formatInEditor('strike') },
        { id: 'fmt-code', label: 'Inline code', icon: 'code', onSelect: () => formatInEditor('code') },
      ],
    },
    {
      id: 'para', label: 'Paragraph', icon: 'layout-list',
      submenu: [
        { id: 'para-text', label: 'Body text', onSelect: () => formatInEditor('heading', 0) },
        { id: 'para-h1', label: 'Heading 1', onSelect: () => formatInEditor('heading', 1) },
        { id: 'para-h2', label: 'Heading 2', onSelect: () => formatInEditor('heading', 2) },
        { id: 'para-h3', label: 'Heading 3', onSelect: () => formatInEditor('heading', 3) },
        { id: 'para-quote', label: 'Quote', icon: 'quote', onSelect: () => formatInEditor('quote') },
        { id: 'para-codeblock', label: 'Code block', icon: 'braces', onSelect: () => formatInEditor('codeblock') },
      ],
    },
    {
      id: 'insert', label: 'Insert', icon: 'plus',
      submenu: [
        { id: 'ins-bullet', label: 'Bullet list', icon: 'list', onSelect: () => formatInEditor('bullet') },
        { id: 'ins-ordered', label: 'Numbered list', icon: 'list-ordered', onSelect: () => formatInEditor('ordered') },
        { id: 'ins-rule', label: 'Divider', onSelect: () => formatInEditor('hr') },
      ],
    },
    { id: 'sep-clip', type: 'separator' },
    { id: 'cut', label: 'Cut', icon: 'scissors', disabled: !selectionText(), onSelect: cutSelection },
    { id: 'copy', label: 'Copy', icon: 'copy', disabled: !selectionText(), onSelect: copySelection },
    { id: 'paste', label: 'Paste', icon: 'paste', onSelect: pasteIntoSelection },
    { id: 'paste-plain', label: 'Paste as plain text', icon: 'paste', disabled: !navigator.clipboard?.readText, onSelect: pastePlain },
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
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canUndo ? 1 : 0.3 }} onClick={undoInEditor} title="Undo (Ctrl+Z)">
            <Icon name="undo" size={14} />
          </button>
          <button type="button" style={{ ...toolbarBtn, opacity: hist.canRedo ? 1 : 0.3 }} onClick={redoInEditor} title="Redo (Ctrl+Shift+Z)">
            <Icon name="redo" size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: colors.border, margin: '0 4px' }} />
          <button type="button" data-tip="Bold (Ctrl+B)" onClick={() => formatInEditor('bold')} style={toolbarBtn}><Icon name="bold" size={14} /></button>
          <button type="button" data-tip="Italic (Ctrl+I)" onClick={() => formatInEditor('italic')} style={toolbarBtn}><Icon name="italic" size={14} /></button>
          <button type="button" data-tip="Strikethrough" onClick={() => formatInEditor('strike')} style={toolbarBtn}><Icon name="strikethrough" size={14} /></button>
          <button type="button" data-tip="Inline code" onClick={() => formatInEditor('code')} style={toolbarBtn}><Icon name="code" size={14} /></button>
          <button type="button" data-tip="Blockquote" onClick={() => formatInEditor('quote')} style={toolbarBtn}><Icon name="quote" size={14} /></button>
          <button type="button" data-tip="Bullet list" onClick={() => formatInEditor('bullet')} style={toolbarBtn}><Icon name="list" size={14} /></button>
          <button type="button" data-tip="Code fence" onClick={() => formatInEditor('codeblock')} style={toolbarBtn}><Icon name="braces" size={14} /></button>
        </div>
      </div>
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
        <div ref={editorContainerRef} onKeyDownCapture={handlePopupKeys} style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'row' }}>
          <Gutter menuItems={viewMenuItems} grow={narrowWidth} />
          <ContextMenu items={editorMenuItems} triggerStyle={{ display: 'contents' }}>
            <div style={{ flex: narrowWidth ? '0 0 720px' : '1 1 0', minWidth: 0, minHeight: 0, maxWidth: narrowWidth ? 'min(720px, calc(100% - 80px))' : undefined }}>
              <CM6Editor
                key={note?.id}
                markdown={body}
                onMarkdownChange={handleBodyChange}
                onSelectionChange={handleSelectionChange}
                editorInstanceRef={editorInstanceRef}
                noteNames={noteNames}
                onNoteLink={handleNoteLink}
              />
            </div>
          </ContextMenu>
          <Gutter menuItems={viewMenuItems} grow={narrowWidth} />
          {cmView && <CursorTrail view={cmView} containerRef={editorContainerRef} />}
          {linkPopup && popupMatches?.length > 0 && (() => {
            const matches = popupMatches
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
        </div>
      </div>
    </div>
  )
}
