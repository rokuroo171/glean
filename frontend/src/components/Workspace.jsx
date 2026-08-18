import { useEffect, useMemo, useState } from 'react'
import { colors, space } from '../lib/theme'
import TabBar from './TabBar'
import StatusBar from './StatusBar'
import Home from './Home'
import { renderMarkdown } from '../lib/markdown'

export default function Workspace({
  notes, trails, stats, skyName, version,
  onOpenNote, onNewNote, onOpenStats,
  fetchWorkspaceState, saveWorkspaceState,
  noteBodies, // map id -> body, filled by App via OpenNote
}) {
  const [openIds, setOpenIds] = useState([])
  const [activeId, setActiveId] = useState(null)

  // Restore tabs once at mount.
  useEffect(() => {
    (async () => {
      const st = await fetchWorkspaceState()
      if (st && st.open_ids && st.open_ids.length > 0) {
        setOpenIds(st.open_ids)
        setActiveId(st.active_id || st.open_ids[0])
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (ids, active) => saveWorkspaceState({ open_ids: ids, active_id: active })

  const tabs = useMemo(() => openIds
    .map(id => notes.find(n => n.id === id))
    .filter(Boolean)
    .map(n => ({ id: n.id, title: n.title, species: n.species, dirty: false })), [openIds, notes])

  function openNote(id) {
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
    const next = openIds.filter(x => x !== id)
    setOpenIds(next)
    const active = activeId === id ? (next[next.length - 1] || null) : activeId
    setActiveId(active)
    persist(next, active)
  }

  const activeNote = notes.find(n => n.id === activeId) || null
  const body = activeNote ? (noteBodies[activeNote.id] || '') : ''

  return (
    <div style={{ width: '100vw', height: '100vh', background: colors.bg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar tabs={tabs} activeId={activeId}
        onSelect={openNote} onClose={closeTab} onNew={onNewNote} onSettings={() => {}} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left panel: SkyPanel lands in Task 5. Placeholder keeps layout. */}
        <div style={{ width: 264, borderRight: `1px solid ${colors.border}` }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: space[4] }}>
            {!activeNote ? (
              <Home notes={notes} stats={stats} onNoteClick={openNote}
                onOpenStats={onOpenStats} onNewNote={onNewNote} />
            ) : (
              <div>
                <h2 style={{ color: colors.text, fontSize: 20, margin: '0 0 12px' }}>{activeNote.title}</h2>
                <div style={{ color: colors.text, lineHeight: 1.6 }}>{renderMarkdown(body)}</div>
              </div>
            )}
          </div>
          <StatusBar words={body.trim() ? body.trim().split(/\s+/).length : 0}
            saveState="saved" skyName={skyName} version={version} />
        </div>
        {/* Right panel: DetailsPanel lands in Task 6. */}
        <div style={{ width: 220, borderLeft: `1px solid ${colors.border}` }} />
      </div>
    </div>
  )
}
