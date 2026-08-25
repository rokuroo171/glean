import { useEffect, useMemo, useRef, useState } from 'react'
import { colors, space } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import TabBar from './TabBar'
import StatusBar from './StatusBar'
import Home from './Home'
import EditorPane from './EditorPane'
import FileExplorer from './FileExplorer'
import DetailsPanel from './DetailsPanel'
import StatsOverlay from './StatsOverlay'
import SettingsPane from './SettingsPane'
import CustomizationPane from './CustomizationPane'
import FullSky from './FullSky'
import CommandCenter from './CommandCenter'
import Icon from './Icon'
import ManageSky from './ManageSky'

const wails = window.go?.main

export default function Workspace({
  notes, links, stats, skyName, skyPath, version,
  onOpenNote, onNewNote, onOpenStats, onCreateNote,
  fetchWorkspaceState, saveWorkspaceState,
  noteBodies, // map id -> body, filled by App via OpenNote
  onBodyChange, onSaveNow, onRefreshNote, onRescan,
  onWish, onDelete, onReplayTour,
}) {
  const { prefs } = usePreferences()
  const [pseudoTab, setPseudoTab] = useState(null) // null | 'stats' | 'settings' | 'customization'
  const [nightOpen, setNightOpen] = useState(true)
  const [commandOpen, setCommandOpen] = useState(false)
  const [fullSky, setFullSky] = useState(false)
  const [skyCollapsed, setSkyCollapsed] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [openIds, setOpenIds] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [dirty, setDirty] = useState({}) // { [noteId]: true }
  const [externalChanged, setExternalChanged] = useState(false)
  const [externalBody, setExternalBody] = useState(null)
  const [showManageSky, setShowManageSky] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [editorMode, setEditorMode] = useState('preview')
  const [sidebarWidth, setSidebarWidth] = useState(264)
  const draggingRef = useRef(false)

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

  // Restore tabs once at mount. Night is always open.
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

  async function createAndOpen(title) {
    const note = await onCreateNote(title)
    if (note) openNote(note.id)
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

  function handleCommandAction(actionId) {
    if (actionId === 'customize') setPseudoTab('customization')
    else if (actionId === 'settings') setPseudoTab('settings')
    else if (actionId === 'stats') { setPseudoTab('stats'); onOpenStats() }
    else if (actionId === 'new-note') onNewNote()
    else if (actionId === 'night') openNight()
    else if (actionId === 'full-sky') setFullSky(true)
    else if (actionId === 'refresh-window') window.location.reload()
    else if (actionId === 'replay-tour') { if (onReplayTour) onReplayTour() }
  }

  function toggleSky() {
    const next = !skyCollapsed
    setSkyCollapsed(next)
    saveWorkspaceState({ open_ids: openIds, active_id: activeId, sky_collapsed: next })
  }

  // Load the body for the active tab once notes are available.
  // On startup, tabs restore from saved state but bodies are not loaded
  // yet. Without this, the editor shows empty content and the focus
  // handler fires a false "File changed on disk" alert.
  useEffect(() => {
    if (!activeId || !notes.length) return
    if (activeId in noteBodies) return
    onOpenNote(activeId)
  }, [activeId, notes, noteBodies, onOpenNote])

  // The command center opens from the title bar pill, or with the
  // shortcuts both references use: Ctrl+K and Ctrl+O.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // When the window regains focus, re-scan the sky folder for new or
  // removed md files and check if the active note changed on disk.
  useEffect(() => {
    const onFocus = async () => {
      // Re-scan picks up external md files added to the sky folder.
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

  const activeNote = notes.find(n => n.id === activeId) || null
  const body = activeNote ? (noteBodies[activeNote.id] || '') : ''

  // Update window title and taskbar preview when active note or pseudo tab changes.
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

  // Backlinks: which other notes mention the current note's title.
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
      <TabBar tabs={tabs} activeId={activeId}
        onSelect={(id) => id === '__night__' ? openNight() : openNote(id)}
        onClose={(id) => id === '__night__' ? closeNight() : closeTab(id)}
        onNew={openNight}
        onSettings={() => setPseudoTab('settings')}
        onCustomize={() => setPseudoTab('customization')}
        onCommand={() => setCommandOpen(true)}
        pseudoTab={pseudoTab} onClosePseudo={() => setPseudoTab(null)}
        detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen(v => !v)} />
      {externalChanged && (
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2], padding: '6px 12px',
          background: 'rgba(180,140,80,0.15)', borderBottom: `1px solid ${colors.border}`,
          fontSize: 12, color: '#c0a060' }}>
          <span style={{ flex: 1 }}>File changed on disk</span>
          <button type="button" onClick={reloadFromDisk}
            style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.text,
              borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>Reload</button>
          <button type="button" onClick={() => setExternalChanged(false)}
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', fontSize: 12 }}>Keep mine</button>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Persistent left icon rail -- always visible, carries app navigation. */}
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
          <button type="button" onClick={() => setFullSky(true)} aria-label="sky view" data-tip="Sky"
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="sparkles" size={16} />
          </button>
          <button type="button" data-tour="customize" onClick={() => setPseudoTab('customization')} aria-label="customization" data-tip="Customization"
            style={{ background: 'none', border: 'none', color: pseudoTab === 'customization' ? colors.accent : colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="palette" size={16} />
          </button>
          <button type="button" onClick={() => { setPseudoTab('stats'); onOpenStats() }} aria-label="stats" data-tip="Sky overview"
            style={{ background: 'none', border: 'none', color: pseudoTab === 'stats' ? colors.accent : colors.textMuted,
              cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Icon name="bar-chart" size={16} />
          </button>
        </div>
        {/* File explorer panel -- slides in/out next to the icon rail. */}
        {!skyCollapsed && (
          <>
          <div style={{ width: sidebarWidth, borderRight: `1px solid ${colors.border}`, display: 'flex', minHeight: 0,
            background: colors.bgTranslucent, backdropFilter: 'blur(12px)', flexShrink: 0, overflow: 'hidden' }}>
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
              onManageSky={() => setShowManageSky(true)}
              onDelete={onDelete} />
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
              <SettingsPane skyName={skyName} skyPath={skyPath} version={version} />
            </div>
          ) : pseudoTab === 'customization' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CustomizationPane />
            </div>
          ) : activeId === '__night__' ? (
            <div style={{ flex: 1, overflow: 'auto', padding: space[4] }}>
              <Home notes={notes} stats={stats} onNoteClick={(id) => { openNote(id) }}
                onOpenStats={() => { setPseudoTab('stats'); onOpenStats() }} onNewNote={onNewNote} />
            </div>
          ) : !activeNote ? (
            <div style={{ flex: 1, overflow: 'auto', padding: space[4] }}>
              <Home notes={notes} stats={stats} onNoteClick={openNote}
                onOpenStats={() => { setPseudoTab('stats'); onOpenStats() }} onNewNote={onNewNote} />
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <EditorPane
                key={activeNote?.id}
                note={activeNote}
                body={body}
                onBodyChange={(newBody) => onBodyChange(activeNote.id, newBody)}
                onSaveNow={() => handleSaveComplete(activeNote.id)}
                dirty={!!dirty[activeNote?.id]}
                setDirty={(v) => setDirty(prev => ({ ...prev, [activeNote.id]: v }))}
                linked={linked}
                onOpenNote={openNote}
                skyName={skyName}
                onCursorChange={setCursorPos}
                editorMode={editorMode}
                onEditorModeChange={setEditorMode}
              />
            </div>
          )}
          {prefs.layout.show_status_bar && (
            <StatusBar
              words={body.trim() ? body.trim().split(/\s+/).length : 0}
              chars={body.length}
              line={cursorPos.line}
              col={cursorPos.col}
              backlinks={backlinks}
              showCursor={editorMode === 'edit' || editorMode === 'split'}
              saveState={dirty[activeNote?.id] ? 'unsaved' : 'saved'}
              skyName={skyName} version={version} />
          )}
        </div>
        {detailsOpen && activeNote && (
          <div style={{ width: 220, borderLeft: `1px solid ${colors.border}`, overflow: 'auto', flexShrink: 0,
            background: colors.bgTranslucent, backdropFilter: 'blur(12px)' }}>
            <DetailsPanel note={activeNote} linked={linked}
              noteBodies={noteBodies} notes={notes}
              onWish={onWish}
              onDelete={(id) => { onDelete(id); closeTab(id) }}
              onOpenNote={openNote} />
          </div>
        )}
      </div>
      {fullSky && (
        <FullSky notes={notes} links={links} onNoteClick={openNote}
          onClose={() => setFullSky(false)} />
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

      {commandOpen && (
        <CommandCenter notes={notes} onOpen={openNote} onCreate={createAndOpen}
          onAction={handleCommandAction}
          onClose={() => setCommandOpen(false)} />
      )}
    </div>
  )
}
