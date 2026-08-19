import { useState, useEffect, useCallback } from 'react'
import Workspace from './components/Workspace'
import NewNotePrompt from './components/NewNotePrompt'
import Wizard from './components/Wizard'
import Recovery from './components/Recovery'
import { colors } from './lib/theme'

const wails = window.go?.main

// Mock mode defaults to the workspace; #wizard=1 and #recovery=1 force the
// other gates so the screens can be reached from the browser dev server.
function mockSkyState() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (params.get('wizard') === '1') {
    return { configured: false, sky_missing: false, sky_name: '', sky_path: '',
      has_legacy: false, registry_empty: true, migration_skipped: false }
  }
  if (params.get('recovery') === '1') {
    return { configured: true, sky_missing: true, sky_name: 'My Sky', sky_path: '',
      has_legacy: false, registry_empty: true, migration_skipped: false }
  }
  return { configured: true, sky_missing: false, sky_name: 'My Sky', sky_path: '',
    has_legacy: false, registry_empty: true, migration_skipped: false }
}

const MOCK_NOTES = [
  { id: '1', title: 'First spark', body: 'Notes on tools and configs.', created_at: new Date(Date.now() - 120000).toISOString(), last_visited: new Date(Date.now() - 120000).toISOString(), visit_count: 1, last_manual_water: null, world_x: 0, world_y: 0, positioned: true, stage: 'faintspeck', species: 'warm' },
  { id: '2', title: 'Dim glow', body: 'Ideas for the next session.', created_at: new Date(Date.now() - 3600000).toISOString(), last_visited: new Date(Date.now() - 3600000).toISOString(), visit_count: 3, last_manual_water: null, world_x: 18, world_y: 0, positioned: true, stage: 'dimstar', species: 'cool' },
  { id: '3', title: 'Steady light', body: 'Daily reflections and observations.', created_at: new Date(Date.now() - 86400000).toISOString(), last_visited: new Date(Date.now() - 86400000).toISOString(), visit_count: 7, last_manual_water: null, world_x: -18, world_y: 8, positioned: true, stage: 'steadystar', species: 'neutral' },
  { id: '4', title: 'Brilliant beacon', body: 'Roadmap and milestones ahead.', created_at: new Date(Date.now() - 172800000).toISOString(), last_visited: new Date(Date.now() - 172800000).toISOString(), visit_count: 25, last_manual_water: null, world_x: 36, world_y: 8, positioned: true, stage: 'brilliantstar', species: 'hot' },
]

// Mock-created notes survive loadSky refetches.
let mockCreated = []

async function getNotes() {
  if (wails) return wails.App.GetNotes()
  return [...MOCK_NOTES, ...mockCreated]
}

async function getTrails() {
  if (wails) return wails.App.GetTrails()
  return [
    { note_a: '1', note_b: '2', dimmed: false },
    { note_a: '2', note_b: '3', dimmed: true },
  ]
}

async function getStats() {
  if (wails) return wails.App.GetStats()
  return {
    total_notes: 4,
    stage_counts: { faintspeck: 1, dimstar: 1, steadystar: 1, brilliantstar: 1 },
    current_streak: 6,
    longest_streak: 14,
    last_active_date: '',
    daily_counts: {},
    milestones: {},
  }
}

async function getSkyName() {
  if (wails) return wails.App.GetSkyName()
  return 'My Sky'
}

async function getSkyPath() {
  if (wails) return wails.App.GetSkyPath()
  return 'local'
}

export default function App() {
  const [setup, setSetup] = useState('loading') // loading | wizard | recovery | workspace
  const [skyState, setSkyState] = useState(null)
  const [notes, setNotes] = useState([])
  const [trails, setTrails] = useState([])
  const [stats, setStats] = useState(null)
  const [noteBodies, setNoteBodies] = useState({})
  const [skyName, setSkyName] = useState('My Sky')
  const [skyPath, setSkyPath] = useState('local')
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')

  // The pointer gate: wizard for a new user, recovery for a missing sky,
  // workspace for everyone else.
  useEffect(() => {
    (async () => {
      const st = wails ? await wails.App.SkyState() : mockSkyState()
      setSkyState(st)
      if (!st.configured) setSetup('wizard')
      else if (st.sky_missing) setSetup('recovery')
      else setSetup('workspace')
    })()
  }, [])

  const loadSky = useCallback(async () => {
    const [n, t] = await Promise.all([getNotes(), getTrails()])
    setNotes(n)
    setTrails(t)
  }, [])

  const loadStats = useCallback(async () => {
    const s = await getStats()
    setStats(s)
  }, [])

  // Sky data loads only once the workspace is the active gate, so a fresh
  // setup gets its scan results instead of the empty pre-wizard state.
  useEffect(() => {
    if (setup !== 'workspace') return
    loadSky()
    loadStats()
    getSkyName().then(setSkyName)
    getSkyPath().then(setSkyPath)
  }, [setup, loadSky, loadStats])

  const handleOpenNote = useCallback(async (id) => {
    if (wails) {
      const note = await wails.App.OpenNote(id)
      setNoteBodies(prev => ({ ...prev, [id]: note.body || '' }))
    } else {
      const note = notes.find(n => n.id === id)
      setNoteBodies(prev => ({ ...prev, [id]: note?.body || '' }))
    }
    loadSky()
  }, [notes, loadSky])

  const handleBodyChange = useCallback((id, newBody) => {
    setNoteBodies(prev => ({ ...prev, [id]: newBody }))
  }, [])

  const handleRescan = useCallback(async () => {
    if (wails) {
      const updated = await wails.App.ScanSky()
      setNotes(updated)
    }
  }, [])

  const handleRefreshNote = useCallback(async (id) => {
    if (wails) {
      const note = await wails.App.GetNote(id)
      // Wails may wrap multi-return methods in an array.
      return Array.isArray(note) ? note[0] : note
    }
    return notes.find(n => n.id === id) || null
  }, [notes])

  const handleSaveNow = useCallback(async (id) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    // Skip if the body hasn't been loaded from disk yet.
    // noteBodies[id] is undefined before OpenNote returns,
    // and saving empty string would wipe the file.
    if (!(id in noteBodies)) return
    const body = noteBodies[id]
    if (wails) await wails.App.SaveNote(id, note.title, body)
    loadSky()
  }, [notes, noteBodies, loadSky])

  const handleWish = useCallback(async (id) => {
    if (!wails) return false
    let ok = false
    try { ok = await wails.App.WaterNote(id) } catch { return false }
    if (!ok) return false
    loadSky()
    return true
  }, [loadSky])

  const handleDelete = useCallback(async (id) => {
    if (wails) {
      await wails.App.DeleteNote(id)
    } else {
      mockCreated = mockCreated.filter(n => n.id !== id)
      setNotes(prev => prev.filter(n => n.id !== id))
    }
    loadSky()
  }, [loadSky])

  const handleCreate = useCallback(async (title, contextId) => {
    let note
    if (wails) {
      note = await wails.App.CreateNote(title, contextId || '')
    } else {
      note = {
        id: String(Date.now()),
        title: title || 'Untitled',
        body: '',
        created_at: new Date().toISOString(),
        last_visited: new Date().toISOString(),
        visit_count: 0,
        last_manual_water: null,
        world_x: 0,
        world_y: 0,
        positioned: true,
        stage: 'faintspeck',
        species: 'warm',
      }
      mockCreated = [...mockCreated, note]
    }
    await handleOpenNote(note.id)
    return note
  }, [handleOpenNote])

  const handleNewNote = useCallback(() => {
    setNewNoteTitle('')
    setShowNewPrompt(true)
  }, [])

  const handleCreateSubmit = useCallback(async () => {
    await handleCreate(newNoteTitle)
    setShowNewPrompt(false)
  }, [handleCreate, newNoteTitle])

  const handleOpenStats = useCallback(async () => {
    await loadStats()
  }, [loadStats])

  if (setup === 'loading') return <div style={{ width: '100vw', height: '100vh', background: colors.bg }} />
  if (setup === 'wizard') return (
    <Wizard onComplete={async () => {
      const st = await (wails ? wails.App.SkyState() : mockSkyState())
      setSkyState(st)
      setSetup(st.sky_missing ? 'recovery' : 'workspace')
    }} />
  )
  if (setup === 'recovery') return (
    <Recovery onCreateNew={() => setSetup('wizard')}
      onComplete={() => { setSkyState(null); setSetup('workspace') }} />
  )

  return (
    <div style={{ width: '100vw', height: '100vh', background: colors.bg, position: 'relative', overflow: 'hidden' }}>
      <Workspace
        notes={notes}
        trails={trails}
        stats={stats}
        skyName={skyName}
        skyPath={skyPath}
        version="v1.0.0"
        onOpenNote={handleOpenNote}
        onNewNote={handleNewNote}
        onOpenStats={handleOpenStats}
        onCreateNote={handleCreate}
        fetchWorkspaceState={async () => (wails ? wails.App.GetWorkspaceState() : { open_ids: [], active_id: '' })}
        saveWorkspaceState={async (st) => { if (wails) await wails.App.SaveWorkspaceState(st) }}
        noteBodies={noteBodies}
        onBodyChange={handleBodyChange}
        onSaveNow={handleSaveNow}
        onRefreshNote={handleRefreshNote}
        onRescan={handleRescan}
        onWish={handleWish}
        onDelete={handleDelete}
      />

      {showNewPrompt && (
        <NewNotePrompt
          title={newNoteTitle}
          onTitleChange={setNewNoteTitle}
          onSubmit={handleCreateSubmit}
          onCancel={() => setShowNewPrompt(false)}
        />
      )}
    </div>
  )
}
