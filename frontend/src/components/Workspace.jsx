import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space, radius } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import { toast } from '../lib/toast'
import TabBar from './TabBar'
import HeaderBar from './HeaderBar'
import OpenNotesList from './OpenNotesList'
import StatusBar from './StatusBar'
import Home from './Home'
import EditorPane from './EditorPane'
import FileExplorer from './FileExplorer'
import DetailsPanel from './DetailsPanel'
import StatsOverlay from './StatsOverlay'
import SettingsPane from './SettingsPane'
import CustomizationPane from './CustomizationPane'
import FullConstellation from './FullConstellation'
import CommandCenter from './CommandCenter'
import Icon from './Icon'
import { wordCount } from '../lib/format'
import ManageSky from './ManageSky'
import NewFolderPrompt from './NewFolderPrompt'

const wails = window.go?.main

export default function Workspace({
  notes, links, stats, skyName, skyPath, version, systemInfo,
  onOpenNote, onNewNote, onOpenStats, onCreateNote,
  fetchWorkspaceState, saveWorkspaceState,
  noteBodies, // map id -> body, filled by App via OpenNote
  onBodyChange, onSaveNow, onRefreshNote, onRescan,
  onWish, onDelete, onReplayTour,
}) {
  const { prefs, updatePrefs } = usePreferences()
  const [pseudoTab, setPseudoTab] = useState(null) // null | 'stats' | 'settings' | 'customization'
  const [nightOpen, setNightOpen] = useState(true)
  const [commandMode, setCommandMode] = useState(null) // null | 'commands' | 'notes'
  const [hatchOpen, setHatchOpen] = useState(false)
  const [folderPromptOpen, setFolderPromptOpen] = useState(false)
  const renameApiRef = useRef(null)
  const [showConstellation, setShowConstellation] = useState(false)
  const [skyCollapsed, setSkyCollapsed] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [openIds, setOpenIds] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [dirty, setDirty] = useState({}) // { [noteId]: true }
  const [externalChanged, setExternalChanged] = useState(false)
  const [externalBody, setExternalBody] = useState(null)
  const [showManageSky, setShowManageSky] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [sidebarWidth, setSidebarWidth] = useState(264)
  const draggingRef = useRef(false)
  // Floating cards need room; narrow screens collapse to attached panels
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const onChange = (e) => setWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const floatCard = {
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: colors.shadow,
    background: colors.bgCard,
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
  }

  function startResize(e) {
    draggingRef.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    function onMove(ev) {
      if (!draggingRef.current) return
      const delta = ev.clientX - startX
      const next = Math.min(Math.max(startW + delta, 180), 500)
      setSidebarWidth(next)
    }
    function onUp() {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Restore tabs once at mount. Night is always open
  useEffect(() => {
    (async () => {
      const st = await fetchWorkspaceState()
      if (st && st.open_ids && st.open_ids.length > 0) {
        setOpenIds(st.open_ids)
        setActiveId(st.active_id || st.open_ids[0])
      } else {
        setActiveId('__night__')
      }
      setSkyCollapsed(!!st?.sky_collapsed)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (ids, active) => saveWorkspaceState({ open_ids: ids, active_id: active })

  const tabs = useMemo(() => {
    const noteTabs = openIds
      .map(id => notes.find(n => n.id === id))
      .filter(Boolean)
      .map(n => ({ id: n.id, title: n.title, species: n.species, dirty: !!dirty[n.id] }))
    if (nightOpen) {
      noteTabs.unshift({ id: '__night__', title: 'Night', species: 'warm', dirty: false })
    }
    return noteTabs
  }, [openIds, notes, dirty, nightOpen])

  // Global Tab key: switch tabs when no textarea/input is focused
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Tab') return
      const ae = document.activeElement
      if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return
      e.preventDefault()
      const allIds = tabs.map(t => t.id)
      const idx = allIds.indexOf(activeId)
      if (idx === -1) return
      const next = e.shiftKey
        ? (idx - 1 + allIds.length) % allIds.length
        : (idx + 1) % allIds.length
      const nid = allIds[next]
      setPseudoTab(null)
      if (nid === '__night__') {
        if (!nightOpen) setNightOpen(true)
        setActiveId('__night__')
      } else {
        setActiveId(nid)
        if (!openIds.includes(nid)) {
          const extended = [...openIds, nid]
          setOpenIds(extended)
          onOpenNote(nid)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [tabs, activeId, openIds, nightOpen])

  function openNote(id) {
    setPseudoTab(null)
    if (openIds.includes(id)) {
      setActiveId(id)
      persist(openIds, id)
      return
    }
    const next = [...openIds, id]
    setOpenIds(next)
    setActiveId(id)
    persist(next, id)
    onOpenNote(id)
  }

  function closeTab(id) {
    if (dirty[id]) onSaveNow(id)
    const next = openIds.filter(x => x !== id)
    setOpenIds(next)
    const active = activeId === id ? (next[next.length - 1] || '__night__') : activeId
    setActiveId(active)
    persist(next, active)
    setDirty(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function handleSaveComplete(id) {
    onSaveNow(id)
    setDirty(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function openNight() {
    setPseudoTab(null)
    if (nightOpen) {
      setActiveId('__night__')
      return
    }
    setNightOpen(true)
    setActiveId('__night__')
  }

  function closeNight() {
    // Night is the home tab -- closing it just focuses the last note
    if (activeId === '__night__') {
      const next = openIds.length > 0 ? openIds[openIds.length - 1] : null
      setActiveId(next)
    }
  }

  // The Ctrl+K registry. A plain array rebuilt each render: cheap, and run
  // closures always see current state
  const commands = [
    { id: 'new-note', label: 'New Note', group: 'Notes', icon: 'file-plus', keywords: ['create'], run: () => onNewNote() },
    { id: 'new-folder', label: 'New Folder', group: 'Notes', icon: 'folder-plus', keywords: ['create'], run: () => setFolderPromptOpen(true) },
    ...(activeNote ? [
      { id: 'rename-note', label: `Rename "${activeNote.title}"`, group: 'Notes', icon: 'pencil', run: () => renameApiRef.current?.startRename() },
      { id: 'delete-note', label: `Delete "${activeNote.title}"`, group: 'Notes', icon: 'trash', run: () => { onDelete(activeNote.id); closeTab(activeNote.id) } },
    ] : []),
    { id: 'source-view', label: hatchOpen ? 'Close Source View' : 'Open Source View', group: 'Panes', icon: 'code', keywords: ['markdown', 'raw'], run: () => setHatchOpen(v => !v) },
    { id: 'outline', label: 'Toggle Outline', group: 'Panes', icon: 'list', run: () => updatePrefs({ editor: { show_outline: prefs.editor.show_outline === false } }) },
    { id: 'explorer', label: skyCollapsed ? 'Show File Explorer' : 'Hide File Explorer', group: 'Panes', icon: 'columns', run: toggleSky },
    { id: 'details', label: detailsOpen ? 'Hide Details Panel' : 'Show Details Panel', group: 'Panes', icon: 'panel-right', run: () => setDetailsOpen(v => !v) },
    { id: 'night', label: 'Go to Night', group: 'Navigate', icon: 'moon', keywords: ['home'], run: openNight },
    { id: 'stats', label: 'Sky Overview', group: 'Navigate', icon: 'bar-chart', run: () => { setPseudoTab('stats'); onOpenStats() } },
    { id: 'constellation', label: 'Open Constellation', group: 'Navigate', icon: 'sparkles', run: () => setShowConstellation(true) },
    { id: 'manage-sky', label: 'Manage Sky', group: 'Navigate', icon: 'folder-open', run: () => setShowManageSky(true) },
    { id: 'customization', label: 'Open Customization', group: 'Navigate', icon: 'palette', run: () => setPseudoTab('customization') },
    { id: 'settings', label: 'Open Settings', group: 'Navigate', icon: 'settings', run: () => setPseudoTab('settings') },
    { id: 'tour', label: 'Replay Onboarding Tour', group: 'App', icon: 'sparkle', run: () => { if (onReplayTour) onReplayTour() } },
    { id: 'refresh-window', label: 'Refresh Window', group: 'App', icon: 'refresh-cw', run: () => window.location.reload() },
  ]

  function toggleSky() {
    const next = !skyCollapsed
    setSkyCollapsed(next)
    saveWorkspaceState({ open_ids: openIds, active_id: activeId, sky_collapsed: next })
  }

  // Load the body for the active tab once notes are available
  // On startup, tabs restore from saved state but bodies are not loaded
  // yet. Without this, the editor shows empty content and the focus
  // handler fires a false "File changed on disk" alert
  useEffect(() => {
    if (!activeId || !notes.length) return
    if (activeId in noteBodies) return
    onOpenNote(activeId)
  }, [activeId, notes, noteBodies, onOpenNote])

  // Ctrl+K runs commands, Ctrl+O is the files-only quick switcher; the
  // constellation keeps its own Ctrl+K for graph search
  useEffect(() => {
    const onKey = (e) => {
      if (showConstellation) return
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setCommandMode('commands') }
      else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); setCommandMode('notes') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showConstellation])

  // When the window regains focus, re-scan the sky folder for new or
  // removed md files and check if the active note changed on disk
  useEffect(() => {
    const onFocus = async () => {
      // Re-scan picks up external md files added to the sky folder
      onRescan()
      if (!activeId || dirty[activeId]) return
      const note = await onRefreshNote(activeId)
      if (!note) return
      const current = noteBodies[activeId] || ''
      if (note.body !== current) {
        setExternalBody(note.body)
        setExternalChanged(true)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeId, dirty, noteBodies, onRefreshNote, onRescan])

  function reloadFromDisk() {
    if (externalBody !== null && activeId) {
      onBodyChange(activeId, externalBody)
    }
    setExternalChanged(false)
    setExternalBody(null)
  }

  // keep mine re-saves the in-memory body over the disk version; the body
  // is guaranteed loaded because a disk diff cannot fire before OpenNote
  function keepMine() {
    if (activeId) onSaveNow(activeId)
    setExternalChanged(false)
    setExternalBody(null)
  }

  // The bar this toast replaces pushed layout down whenever it showed; a
  // toast reports the same conflict without moving the editor
  useEffect(() => {
    if (!externalChanged) return
    toast('File changed on disk', {
      description: notes.find(n => n.id === activeId)?.title || 'This note was modified outside glean',
      duration: 12000,
      action: { label: 'Reload', onClick: reloadFromDisk },
      cancel: { label: 'Keep mine', onClick: keepMine },
    })
    setExternalChanged(false)
  }, [externalChanged])

  const activeNote = notes.find(n => n.id === activeId) || null
  const body = activeNote ? (noteBodies[activeNote.id] || '') : ''

  // Update window title and taskbar preview when active note or pseudo tab changes
  useEffect(() => {
    if (wails?.App?.SetWindowTitle) {
      if (pseudoTab === 'stats') {
        wails.App.SetWindowTitle('Sky overview - glean')
      } else if (pseudoTab === 'settings') {
        wails.App.SetWindowTitle('Settings - glean')
      } else if (pseudoTab === 'customization') {
        wails.App.SetWindowTitle('Customization - glean')
      } else if (activeId === '__night__') {
        wails.App.SetWindowTitle('Night - glean')
      } else if (activeNote) {
        wails.App.SetWindowTitle(activeNote.title + ' - glean')
      } else {
        wails.App.SetWindowTitle('glean')
      }
    }
  }, [activeNote, pseudoTab])

  // Backlinks: which other notes mention the current note's title
  const backlinks = useMemo(() => {
    if (!activeNote) return 0
    const title = activeNote.title.toLowerCase()
    let count = 0
    for (const [id, body] of Object.entries(noteBodies)) {
      if (id === activeId || !body) continue
      if (body.toLowerCase().includes(title)) count++
    }
    return count
  }, [activeNote, activeId, noteBodies])

  const linked = useMemo(() => {
    if (!activeNote) return []
    const ids = new Set()
    for (const t of links) {
      if (t.note_a === activeNote.id) ids.add(t.note_b)
      if (t.note_b === activeNote.id) ids.add(t.note_a)
    }
    return notes.filter(n => ids.has(n.id))
  }, [activeNote, links, notes])

  return (
    <div style={{ width: '100vw', height: '100vh', background: colors.bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <HeaderBar skyName={skyName}
        onCommand={() => setCommandMode('commands')}
        onSettings={() => setPseudoTab('settings')}
        onToggleDetails={() => setDetailsOpen(v => !v)}
        detailsOpen={detailsOpen} />
      {prefs.layout.tab_mode === 'vertical' ? null : (
        <TabBar tabs={tabs} activeId={activeId}
          onSelect={(id) => id === '__night__' ? openNight() : openNote(id)}
          onClose={(id) => id === '__night__' ? closeNight() : closeTab(id)}
          pseudoTab={pseudoTab} onClosePseudo={() => setPseudoTab(null)} />
      )}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Persistent left icon rail -- always visible, carries app navigation */}
        <div style={{ width: 44, borderRight: `1px solid ${colors.border}`, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: space[2], gap: space[2],
          background: colors.bgTranslucent, backdropFilter: 'blur(12px)' }}>
          <button type="button" onClick={toggleSky} aria-label={skyCollapsed ? 'show explorer' : 'hide explorer'}
            data-tip={skyCollapsed ? 'Show explorer' : 'Hide explorer'}
            style={{ background: 'none', border: 'none', color: skyCollapsed ? colors.textMuted : colors.accent,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <span style={{ display: 'inline-block', transition: 'transform 0.2s ease',
              transform: skyCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
              <Icon name="chevron-right" size={16} />
            </span>
          </button>
          <button type="button" onClick={() => setShowConstellation(true)} aria-label="constellation view" data-tip="Constellation"
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="sparkles" size={16} />
          </button>
          <button type="button" data-tour="customize" onClick={() => setPseudoTab(pseudoTab === 'customization' ? null : 'customization')} aria-label="customization" data-tip="Customization"
            style={{ background: 'none', border: 'none', color: pseudoTab === 'customization' ? colors.accent : colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="palette" size={16} />
          </button>
          <button type="button" onClick={() => { if (pseudoTab === 'stats') setPseudoTab(null); else { setPseudoTab('stats'); onOpenStats() } }} aria-label="stats" data-tip="Sky overview"
            style={{ background: 'none', border: 'none', color: pseudoTab === 'stats' ? colors.accent : colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="bar-chart" size={16} />
          </button>
        </div>
        {/* File explorer panel -- slides in/out next to the icon rail */}
        {!skyCollapsed && (
          <>
          <div style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0,
            ...(wide
              ? { margin: '8px 0 8px 8px', ...floatCard }
              : { borderRight: `1px solid ${colors.border}`, background: colors.bgTranslucent, backdropFilter: 'blur(12px)', overflow: 'hidden' }) }}>
            {prefs.layout.tab_mode === 'vertical' && (
              <OpenNotesList tabs={tabs} activeId={activeId}
                onSelect={(id) => id === '__night__' ? openNight() : openNote(id)}
                onClose={(id) => id === '__night__' ? closeNight() : closeTab(id)} />
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <FileExplorer notes={notes} activeId={activeId} skyName={skyName}
              onOpenNote={openNote}
              onCreateNote={async (name, folder) => {
                const note = await onCreateNote(name, '', folder)
                if (note) openNote(note.id)
              }}
              onCreateFolder={async (name, parentPath) => {
                try {
                  await wails.App.CreateFolder(name, parentPath || '')
                  onRescan()
                } catch {}
              }}
              onRefresh={onRescan}
              skyPath={skyPath}
              renameApiRef={renameApiRef}
              onManageSky={() => setShowManageSky(true)}
              onDelete={onDelete} />
            </div>
          </div>
          <div
            onMouseDown={startResize}
            style={{ width: 4, cursor: 'col-resize', flexShrink: 0, zIndex: 10,
              background: 'transparent', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180, 140, 80, 0.2)' }}
            onMouseLeave={(e) => { if (!draggingRef.current) e.currentTarget.style.background = 'transparent' }}
          />
          </>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {pseudoTab === 'stats' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <StatsOverlay stats={stats} />
            </div>
          ) : pseudoTab === 'settings' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <SettingsPane skyName={skyName} skyPath={skyPath} version={version} systemInfo={systemInfo} prefs={prefs} onUpdatePrefs={updatePrefs} />
            </div>
          ) : pseudoTab === 'customization' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CustomizationPane />
            </div>
          ) : activeId === '__night__' ? (
            // no padding here: Home paints its own full-bleed background, an
            // inset would leave an unpainted strip at the pane edges
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Home notes={notes} stats={stats} onNoteClick={(id) => { openNote(id) }}
                onOpenStats={() => { setPseudoTab('stats'); onOpenStats() }} onNewNote={onNewNote} />
            </div>
          ) : !activeNote ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Home notes={notes} stats={stats} onNoteClick={openNote}
                onOpenStats={() => { setPseudoTab('stats'); onOpenStats() }} onNewNote={onNewNote} />
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
              <EditorPane
                key={activeNote?.id}
                note={activeNote}
                body={body}
                noteNames={Object.fromEntries(notes.map(n => [n.title, n.id]))}
                onBodyChange={(newBody) => onBodyChange(activeNote.id, newBody)}
                onSaveNow={() => handleSaveComplete(activeNote.id)}
                dirty={!!dirty[activeNote?.id]}
                setDirty={(v) => setDirty(prev => ({ ...prev, [activeNote.id]: v }))}
                linked={linked}
                onOpenNote={openNote}
                onNewNote={onNewNote}
                skyName={skyName}
                onCursorChange={setCursorPos}
                hatchOpen={hatchOpen}
                onHatchChange={setHatchOpen}
              />
            </div>
          )}
          {prefs.layout.show_status_bar && (
            <StatusBar
              words={wordCount(body)}
              chars={body.length}
              line={cursorPos.line}
              col={cursorPos.col}
              backlinks={backlinks}
              showCursor={!!activeNote}
              saveState={dirty[activeNote?.id] ? 'unsaved' : 'saved'}
              skyName={skyName} version={version} />
          )}
        </div>
        {detailsOpen && activeNote && (
          <div style={{ width: 220, overflow: 'auto', flexShrink: 0,
            ...(wide
              ? { margin: '8px 8px 8px 0', ...floatCard }
              : { borderLeft: `1px solid ${colors.border}`, background: colors.bgTranslucent, backdropFilter: 'blur(12px)' }) }}>
            <DetailsPanel note={activeNote} linked={linked}
              noteBodies={noteBodies} notes={notes}
              onWish={onWish}
              onDelete={(id) => { onDelete(id); closeTab(id) }}
              onOpenNote={openNote} />
          </div>
        )}
      </div>
      {showConstellation && (
        <FullConstellation notes={notes} links={links} onNoteClick={openNote}
          onClose={() => setShowConstellation(false)} />
      )}
      {showManageSky && (
        <ManageSky
          currentSky={{ name: skyName, path: skyPath }}
          onSwitch={(path, name) => {
            // Reload everything after switch
            window.location.reload()
          }}
          onClose={() => setShowManageSky(false)}
        />
      )}

      {commandMode && (
        <CommandCenter mode={commandMode} commands={commands} notes={notes}
          onOpen={openNote} onClose={() => setCommandMode(null)} />
      )}
      {folderPromptOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFolderPromptOpen(false) }}>
          <div style={{ position: 'fixed', top: 46, left: '50%', transform: 'translateX(-50%)',
            width: 420, maxWidth: '90vw', background: colors.bgElevated,
            border: `1px solid ${colors.borderStrong}`, borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)', padding: '10px 8px' }}>
            <NewFolderPrompt
              onSubmit={async (name) => {
                try {
                  if (!wails) throw new Error('Backend not available')
                  await wails.App.CreateFolder(name, '')
                  onRescan()
                } catch (err) {
                  toast.error('Could not create folder', { description: String(err?.message || err) })
                }
                setFolderPromptOpen(false)
              }}
              onCancel={() => setFolderPromptOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
