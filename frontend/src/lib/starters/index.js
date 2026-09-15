import welcomeMd from './Welcome.md?raw'
import brightMd from './Bright and Dim.md?raw'
import wishesMd from './Wishes.md?raw'
import starlinesMd from './Starlines.md?raw'

// Browser preview has no Go backend, so the seed set is mirrored here.
// Keep titles, folder, link graph, and visit ladder in sync with
// internal/core/starters_seed.go; that file owns the real content
const now = Date.now()
const day = 86400000

export const MOCK_STARTERS = [
  { id: 'seed-welcome', title: 'Welcome', body: welcomeMd, folder: '', created_at: new Date(now).toISOString(), last_visited: new Date(now).toISOString(), visit_count: 1, last_manual_water: null, world_x: 0, world_y: 0, positioned: true, stage: 'faintspeck', species: 'warm' },
  { id: 'seed-bright', title: 'Bright and Dim', body: brightMd, folder: 'Getting Started', created_at: new Date(now - day).toISOString(), last_visited: new Date(now - day).toISOString(), visit_count: 3, last_manual_water: null, world_x: 18, world_y: 0, positioned: true, stage: 'dimstar', species: 'cool' },
  { id: 'seed-wishes', title: 'Wishes', body: wishesMd, folder: 'Getting Started', created_at: new Date(now - 2 * day).toISOString(), last_visited: new Date(now - 2 * day).toISOString(), visit_count: 5, last_manual_water: null, world_x: -18, world_y: 8, positioned: true, stage: 'steadystar', species: 'neutral' },
  { id: 'seed-starlines', title: 'Starlines', body: starlinesMd, folder: 'Getting Started', created_at: new Date(now - 3 * day).toISOString(), last_visited: new Date(now - 3 * day).toISOString(), visit_count: 5, last_manual_water: null, world_x: 36, world_y: 8, positioned: true, stage: 'steadystar', species: 'hot' },
]

export const MOCK_STARTER_LINKS = [
  { note_a: 'seed-welcome', note_b: 'seed-bright', dimmed: false, visits: 1 },
  { note_a: 'seed-welcome', note_b: 'seed-wishes', dimmed: false, visits: 1 },
  { note_a: 'seed-welcome', note_b: 'seed-starlines', dimmed: false, visits: 1 },
]
