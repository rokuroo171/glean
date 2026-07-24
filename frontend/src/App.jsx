import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import Home from './components/Home'
import Sky from './components/Sky'
import StatsOverlay from './components/StatsOverlay'
import { colors } from './lib/theme'

const wails = window.go?.main

async function getNotes() {
  if (wails) return wails.App.GetNotes()
  return [
    { id: '1', title: 'First spark', body: 'Notes on tools and configs.', created_at: new Date(Date.now() - 120000).toISOString(), last_visited: new Date(Date.now() - 120000).toISOString(), visit_count: 1, last_manual_water: null, world_x: 0, world_y: 0, positioned: true, stage: 'faintspeck', species: 'warm' },
    { id: '2', title: 'Dim glow', body: 'Ideas for the next session.', created_at: new Date(Date.now() - 3600000).toISOString(), last_visited: new Date(Date.now() - 3600000).toISOString(), visit_count: 3, last_manual_water: null, world_x: 18, world_y: 0, positioned: true, stage: 'dimstar', species: 'cool' },
    { id: '3', title: 'Steady light', body: 'Daily reflections and observations.', created_at: new Date(Date.now() - 86400000).toISOString(), last_visited: new Date(Date.now() - 86400000).toISOString(), visit_count: 7, last_manual_water: null, world_x: -18, world_y: 8, positioned: true, stage: 'steadystar', species: 'neutral' },
    { id: '4', title: 'Brilliant beacon', body: 'Roadmap and milestones ahead.', created_at: new Date(Date.now() - 172800000).toISOString(), last_visited: new Date(Date.now() - 172800000).toISOString(), visit_count: 25, last_manual_water: null, world_x: 36, world_y: 8, positioned: true, stage: 'brilliantstar', species: 'hot' },
  ]
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

export default function App() {
  const [view, setView] = useState('home')
  const [notes, setNotes] = useState([])
  const [trails, setTrails] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [stats, setStats] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [pendingNoteId, setPendingNoteId] = useState(null)
  const [pendingNewNote, setPendingNewNote] = useState(false)
  const stageUpRef = useRef(null)
  const wishGlowRef = useRef(null)

  useEffect(() => {
    loadSky()
    loadStats()
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

  const handleNoteClick = useCallback(async (noteId) => {
    if (wails) {
      const note = await wails.App.OpenNote(noteId)
      setSelectedNote(note)
    } else {
      const note = notes.find(n => n.id === noteId)
      setSelectedNote(note)
    }
  }, [notes])

  const handleHomeNoteClick = useCallback(async (noteId) => {
    setPendingNoteId(noteId)
    setView('sky')
  }, [])

  const handleEnterSky = useCallback(() => {
    setPendingNoteId(null)
    setSelectedNote(null)
    setView('sky')
  }, [])

  const handleNewNoteFromHome = useCallback(() => {
    setPendingNoteId(null)
    setSelectedNote(null)
    setView('sky')
    // Signal Sky to show new note prompt on entry
    setPendingNewNote(true)
  }, [])

  const handleReturnHome = useCallback(() => {
    setSelectedNote(null)
    setShowStats(false)
    setView('home')
    loadSky()
  }, [loadSky])

  const handleOpenStats = useCallback(async () => {
    await loadStats()
    setShowStats(true)
  }, [loadStats])

  const handleSave = useCallback(async (id, title, body) => {
    if (wails) await wails.App.SaveNote(id, title, body)
    setSelectedNote(prev => prev ? { ...prev, title, body } : null)
    loadSky()
  }, [loadSky])

  const handleWish = useCallback(async (id) => {
    if (!wails) return false
    // Capture old stage before wish (item 13, stage-up flourish)
    const oldNote = notes.find(n => n.id === id)
    const oldStage = oldNote?.stage
    let ok = false
    try { ok = await wails.App.WaterNote(id) } catch { return false }
    if (!ok) return false // daily limit already used
    // Re-fetch the updated note to reflect new visit count / stage
    const note = await wails.App.OpenNote(id)
    setSelectedNote(note)
    // Trigger wish glow on every successful wish (item 2)
    wishGlowRef.current?.(id)
    // Trigger stage-up flourish if stage actually changed (item 13)
    if (oldStage && note.stage && oldStage !== note.stage) {
      stageUpRef.current?.(id)
    }
    loadSky()
    return true
  }, [notes, loadSky])

  const handleDelete = useCallback(async (id) => {
    if (wails) await wails.App.DeleteNote(id)
    setSelectedNote(null)
    loadSky()
  }, [loadSky])

  const handleCreate = useCallback(async (title, contextId) => {
    if (wails) {
      const note = await wails.App.CreateNote(title, contextId || '')
      setSelectedNote(note)
      loadSky()
      return note
    }
    loadSky()
    return null
  }, [loadSky])

  const handleCloseStats = useCallback(() => {
    setShowStats(false)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: colors.bg, position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <Home
            key="home"
            notes={notes}
            stats={stats}
            onNoteClick={handleHomeNoteClick}
            onEnterSky={handleEnterSky}
            onOpenStats={handleOpenStats}
            onNewNote={handleNewNoteFromHome}
          />
        )}
        {view === 'sky' && (
          <Sky
            key="sky"
            notes={notes}
            trails={trails}
            onNoteClick={handleNoteClick}
            selectedNote={selectedNote}
            onCloseNote={() => setSelectedNote(null)}
            onSave={handleSave}
            onWish={handleWish}
            onDelete={handleDelete}
            onCreate={handleCreate}
            showStats={false}
            stats={stats}
            onCloseStats={handleCloseStats}
            onReturnHome={handleReturnHome}
            pendingNoteId={pendingNoteId}
            onPendingNoteHandled={() => setPendingNoteId(null)}
            pendingNewNote={pendingNewNote}
            onPendingNewNoteHandled={() => setPendingNewNote(false)}
            onStageUp={stageUpRef}
            onWishGlow={wishGlowRef}
          />
        )}
      </AnimatePresence>

      {showStats && (
        <StatsOverlay stats={stats} onClose={handleCloseStats} />
      )}
    </div>
  )
}
