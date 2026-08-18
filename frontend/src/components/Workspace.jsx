import { useEffect, useMemo, useState } from 'react'
import { colors, space } from '../lib/theme'
import TabBar from './TabBar'
import StatusBar from './StatusBar'
import Home from './Home'
import EditorPane from './EditorPane'
import SkyPanel from './SkyPanel'
import DetailsPanel from './DetailsPanel'
import StatsOverlay from './StatsOverlay'
import SettingsPane from './SettingsPane'
import FullSky from './FullSky'
import CommandCenter from './CommandCenter'

export default function Workspace({
  notes, trails, stats, skyName, skyPath, version,
  onOpenNote, onNewNote, onOpenStats, onCreateNote,
  fetchWorkspaceState, saveWorkspaceState,
  noteBodies, // map id -> body, filled by App via OpenNote
  onBodyChange, onSaveNow, onRefreshNote,
  onWish, onDelete,
}) {
  const [pseudoTab, setPseudoTab] = useState(null) // null | 'stats' | 'settings'
  const [commandOpen, setCommandOpen] = useState(false)
  const [fullSky, setFullSky] = useState(false)
  const [skyCollapsed, setSkyCollapsed] = useState(false)
  const [openIds, setOpenIds] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [externalChanged, setExternalChanged] = useState(false)
  const [externalBody, setExternalBody] = useState(null)

  // Restore tabs once at mount.
  useEffect(() => {
    (async () => {
      const st = await fetchWorkspaceState()
      if (st && st.open_ids && st.open_ids.length > 0) {
        setOpenIds(st.open_ids)
        setActiveId(st.active_id || st.open_ids[0])
      }
      setSkyCollapsed(!!st?.sky_collapsed)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (ids, active) => saveWorkspaceState({ open_ids: ids, active_id: active })

  const tabs = useMemo(() => openIds
    .map(id => notes.find(n => n.id === id))
    .filter(Boolean)
    .map(n => ({ id: n.id, title: n.title, species: n.species, dirty: false })), [openIds, notes])

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
    if (id === activeId && dirty) onSaveNow(id)
    const next = openIds.filter(x => x !== id)
    setOpenIds(next)
    const active = activeId === id ? (next[next.length - 1] || null) : activeId
    setActiveId(active)
    persist(next, active)
  }

  async function createAndOpen(title) {
    const note = await onCreateNote(title)
    if (note) openNote(note.id)
  }

  function toggleSky() {
    const next = !skyCollapsed
    setSkyCollapsed(next)
    saveWorkspaceState({ open_ids: openIds, active_id: activeId, sky_collapsed: next })
  }

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

  // When the window regains focus, compare the disk body with what the
  // editor holds. A mismatch means the file changed outside glean.
  useEffect(() => {
    const onFocus = async () => {
      if (!activeId || dirty) return
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
  }, [activeId, dirty, noteBodies, onRefreshNote])

  function reloadFromDisk() {
    if (externalBody !== null && activeId) {
      onBodyChange(activeId, externalBody)
    }
    setExternalChanged(false)
    setExternalBody(null)
  }

  const activeNote = notes.find(n => n.id === activeId) || null
  const body = activeNote ? (noteBodies[activeNote.id] || '') : ''

  const linked = useMemo(() => {
    if (!activeNote) return []
    const ids = new Set()
    for (const t of trails) {
      if (t.note_a === activeNote.id) ids.add(t.note_b)
      if (t.note_b === activeNote.id) ids.add(t.note_a)
    }
    return notes.filter(n => ids.has(n.id))
  }, [activeNote, trails, notes])

  return (
    <div style={{ width: '100vw', height: '100vh', background: colors.bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar tabs={tabs} activeId={activeId}
        onSelect={openNote} onClose={closeTab} onNew={onNewNote}
        onSettings={() => setPseudoTab('settings')}
        onCommand={() => setCommandOpen(true)}
        skyCollapsed={skyCollapsed} onToggleSky={toggleSky}
        pseudoTab={pseudoTab} onClosePseudo={() => setPseudoTab(null)} />
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
        {skyCollapsed ? (
          <div style={{ width: 44, borderRight: `1px solid ${colors.border}`, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: space[2], gap: space[2] }}>
            <button type="button" onClick={toggleSky} aria-label="show sky panel" title="Show sky panel"
              style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}>
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <rect x={6} y={2} width={5} height={8} rx={1} stroke="currentColor" strokeWidth={1} />
                <path d="M4 4.5L6 6l-2 1.5" stroke="currentColor" strokeWidth={1} />
              </svg>
            </button>
            <button type="button" onClick={() => setFullSky(true)} aria-label="full sky" title="Full sky"
              style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}>
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <path d="M5 2H2v3M7 2h3v3M5 10H2V7M7 10h3V7" stroke="currentColor" strokeWidth={1} />
              </svg>
            </button>
          </div>
        ) : (
          <div style={{ width: 264, borderRight: `1px solid ${colors.border}`, display: 'flex', minHeight: 0 }}>
            <SkyPanel notes={notes} trails={trails} activeId={activeId} skyName={skyName}
              onOpenNote={openNote} onExpand={() => setFullSky(true)} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!activeNote && pseudoTab === 'stats' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <StatsOverlay stats={stats} />
            </div>
          ) : !activeNote && pseudoTab === 'settings' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <SettingsPane skyName={skyName} skyPath={skyPath} version={version} />
            </div>
          ) : !activeNote ? (
            <div style={{ flex: 1, overflow: 'auto', padding: space[4] }}>
              <Home notes={notes} stats={stats} onNoteClick={openNote}
                onOpenStats={() => { setPseudoTab('stats'); onOpenStats() }} onNewNote={onNewNote} />
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <EditorPane
                note={activeNote}
                body={body}
                onBodyChange={(newBody) => onBodyChange(activeNote.id, newBody)}
                onSaveNow={() => onSaveNow(activeNote.id)}
                dirty={dirty}
                setDirty={setDirty}
                linked={linked}
                onOpenNote={openNote}
              />
            </div>
          )}
          <StatusBar words={body.trim() ? body.trim().split(/\s+/).length : 0}
            saveState={dirty ? 'unsaved' : 'saved'} skyName={skyName} version={version} />
        </div>
        <div style={{ width: 220, borderLeft: `1px solid ${colors.border}`, overflow: 'auto' }}>
          {activeNote && (
            <DetailsPanel note={activeNote} linked={linked}
              onWish={onWish}
              onDelete={(id) => { onDelete(id); closeTab(id) }}
              onOpenNote={openNote} />
          )}
        </div>
      </div>
      {fullSky && (
        <FullSky notes={notes} trails={trails} onNoteClick={openNote}
          onClose={() => setFullSky(false)} />
      )}
      {commandOpen && (
        <CommandCenter notes={notes} onOpen={openNote} onCreate={createAndOpen}
          onClose={() => setCommandOpen(false)} />
      )}
    </div>
  )
}
