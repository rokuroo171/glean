import { useState, useEffect, useCallback } from 'react'
import Workspace from './components/Workspace'
import NewNotePrompt from './components/NewNotePrompt'
import Setup from './components/Setup'
import Recovery from './components/Recovery'
import OnboardingTour from './components/OnboardingTour'
import TooltipLayer from './components/Tooltip.jsx'
import { PreferencesProvider } from './lib/preferences-context'
import { colors } from './lib/theme'

const wails = window.go?.main

const ONBOARDING_STEPS = [
  { title: 'Your Sky is ready', body: 'A few quick pointers before you make it yours. You can skip this anytime.' },
  { title: 'Create your first note', body: 'Click the file icon with a plus to write your first thought. Notes live inside your Sky folder as markdown files.', target: '[data-tour="new-file"]' },
  { title: 'Make it yours', body: 'Glean is built for customization. Themes, accent colors, and more all live in this pane.', target: '[data-tour="customize"]' },
  { title: 'Manage your Sky', body: 'Your Sky is a folder on disk. Open the explorer footer to switch skies or add more.', target: '[data-tour="manage-sky"]' },
  { title: 'The night is yours', body: 'Start writing. The more you visit a note, the brighter its star grows.' },
]

// Mock mode defaults to the workspace; #setup=1 and #recovery=1 force the
// other gates so the screens can be reached from the browser dev server.
function mockSkyState() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (params.get('setup') === '1') {
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
  const [setup, setSetup] = useState('loading') // loading | setup | recovery | workspace
  const [skyState, setSkyState] = useState(null)
  const [notes, setNotes] = useState([])
  const [trails, setTrails] = useState([])
  const [stats, setStats] = useState(null)
  const [noteBodies, setNoteBodies] = useState({})
  const [skyName, setSkyName] = useState('My Sky')
  const [skyPath, setSkyPath] = useState('local')
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)

  // The pointer gate: setup for a new user, recovery for a missing sky,
  // workspace for everyone else.
  useEffect(() => {
    (async () => {
      const st = wails ? await wails.App.SkyState() : mockSkyState()
      setSkyState(st)
      if (!st.configured) setSetup('setup')
      else if (st.sky_missing) setSetup('recovery')
      else setSetup('workspace')
      // Dev flag to force the tour in mock mode: #tour=1
      if (window.location.hash.includes('tour=1')) setShowOnboarding(true)
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
  // setup gets its scan results instead of the empty pre-setup state.
  useEffect(() => {
    if (setup !== 'workspace') return
    // Direct call to avoid stale useCallback closures
    (async () => {
      const [n, t] = await Promise.all([getNotes(), getTrails()])
      setNotes(n)
      setTrails(t)

    })()
    loadStats()
    getSkyName().then(setSkyName)
    getSkyPath().then(setSkyPath)
  }, [setup])

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

  const handleCreate = useCallback(async (title, contextId, folder) => {
    // Path-style creation: "Ideas/Deep/work" -> folder "Ideas/Deep", title "work".
    if (!folder && title && title.includes('/')) {
      const parts = title.split('/')
      const filePart = parts.pop()
      folder = parts.join('/')
      title = filePart
    } else if (title && title.includes('\\')) {
      const parts = title.split('\\')
      const filePart = parts.pop()
      folder = parts.join('/')
      title = filePart
    }
    let note
    if (wails) {
      note = await wails.App.CreateNote(title, contextId || '', folder || '')
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
  if (setup === 'setup') return (
    <Setup onComplete={async () => {
      const st = await (wails ? wails.App.SkyState() : mockSkyState())
      setSkyState(st)
      setSetup(st.sky_missing ? 'recovery' : 'workspace')
      if (!st.sky_missing) setShowOnboarding(true)
    }} />
  )
  if (setup === 'recovery') return (
    <Recovery onCreateNew={() => setSetup('setup')}
      onComplete={() => { setSkyState(null); setSetup('workspace') }} />
  )

  return (
    <PreferencesProvider>
    <div style={{ width: '100vw', height: '100vh', background: colors.bg, position: 'relative', overflow: 'hidden' }}>
      <TooltipLayer />
      <Workspace
        notes={notes}
        trails={trails}
        stats={stats}
        skyName={skyName}
        skyPath={skyPath}
        version="v1.4.0"
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
        onReplayTour={() => setShowOnboarding(true)}
      />
      {showOnboarding && (
        <OnboardingTour steps={ONBOARDING_STEPS}
          onDone={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)} />
      )}
      {showNewPrompt && (
        <NewNotePrompt
          title={newNoteTitle}
          onTitleChange={setNewNoteTitle}
          onSubmit={handleCreateSubmit}
          onCancel={() => setShowNewPrompt(false)} />
      )}
    </div>
    </PreferencesProvider>
  )
}
