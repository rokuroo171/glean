import { useState, useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Circle, Line, Text, Group, Path } from 'react-konva'
import { motion, AnimatePresence } from 'motion/react'
import NoteOverlay from './NoteOverlay'
import EditOverlay from './EditOverlay'
import NewNotePrompt from './NewNotePrompt'
import HomeIcon from './HomeIcon'
import { usePreferences, speciesPalette } from '../lib/preferences-context'
import { colors } from '../lib/theme'
import { motionTokens } from '../lib/motion-tokens'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { GetPalette } from '../../wailsjs/go/main/App'

const wails = window.go?.main

// Color temperature evolution (Idea 7). Behavioral coloring.
// Frequently visited stars shift warmer (amber/gold), neglected stars shift cooler (blue-white).
// Blend between cold and warm palettes based on recency of last visit.
const COLOR_COLD = { core: '#b8d4ff', glow: '#5a9aff', accent: '#7ab4ff' }
const COLOR_WARM = { core: '#ffd6a5', glow: '#ffb366', accent: '#ffc080' }

// Warmth factor: 1.0 = very warm (just visited), 0.0 = very cold (long ago)
function warmthFromVisits(daysSince) {
  if (daysSince < 3)  return 1.0          // visited in last 3 days → fully warm
  if (daysSince < 14) return 1.0 - (daysSince - 3) / 11  // 3→14 days: linear cool-down (1.0→0.0)
  return 0.0                               // 14+ days → fully cold
}

// Blend two color objects by factor t (0→cold, 1→warm)
function blendColors(cold, warm, t) {
  const parse = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const toHex = (r, g, b) =>
    '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  const blend = (a, b) => {
    const ca = parse(a), cb = parse(b)
    return toHex(
      ca[0] + (cb[0] - ca[0]) * t,
      ca[1] + (cb[1] - ca[1]) * t,
      ca[2] + (cb[2] - ca[2]) * t,
    )
  }
  return { core: blend(cold.core, warm.core), glow: blend(cold.glow, warm.glow), accent: blend(cold.accent, warm.accent) }
}

// LOD thresholds (Idea 19). Progressive detail disclosure.
const LOD = {
  constellation: 0.5,  // lines fade in above this scale
  labels: 0.8,         // star titles fade in above this scale
  preview: 1.2,        // note body excerpt fades in above this scale
}
// Smooth step: returns 0 below lo, 1 above hi, smooth ramp between
function lodFactor(scale, lo, hi) {
  return Math.max(0, Math.min(1, (scale - lo) / (hi - lo)))
}

// Stage sizes. Scale with visit count, never dominate the canvas.
const STAGE_RADIUS = {
  faintspeck: 4,
  dimstar: 8,
  steadystar: 14,
  brightstar: 20,
  brilliantstar: 26,
}

// Ambient palette from time-of-day + season (mirrors Go ambient.Palette).
function ambientPalette() {
  const hour = new Date().getHours()
  const month = new Date().getMonth() // 0-11
  let line, text
  if (hour < 12) { line = '#3a5a4a'; text = '#6a8a9a' }
  else if (hour < 20) { line = '#3a5a3a'; text = '#7a9a7a' }
  else { line = '#5a4a3a'; text = '#9a8a6a' }
  // Seasonal sky tint + events.
  let sky, nebula, aurora = false, meteorBoost = 1
  const winter = month === 11 || month <= 1
  const spring = month >= 2 && month <= 4
  const summer = month >= 5 && month <= 7
  if (winter) { sky = '#0B1220'; nebula = '#2a3a6a' }
  else if (spring) { sky = '#0B1418'; nebula = '#1f3a2e' }
  else if (summer) { sky = '#0B0F1E'; nebula = '#2a2140' }
  else { sky = '#140F0B'; nebula = '#3a2a1a' }
  // Aurora nights: winter, after dark.
  if (winter && (hour >= 19 || hour < 6)) aurora = true
  // Meteor-shower weeks: Quadrantids, Lyrids, Perseids, Orionids, Leonids, Geminids.
  const d = new Date()
  const dom = d.getDate()
  if (month === 0 && dom >= 1 && dom <= 5) meteorBoost = 4
  else if (month === 3 && dom >= 21 && dom <= 23) meteorBoost = 3
  else if (month === 7 && dom >= 9 && dom <= 13) meteorBoost = 4
  else if (month === 9 && dom >= 20 && dom <= 22) meteorBoost = 3
  else if (month === 10 && dom >= 16 && dom <= 18) meteorBoost = 3
  else if (month === 11 && dom >= 4 && dom <= 17) meteorBoost = 4
  return { sky, line, text, nebula, aurora, meteorBoost }
}

// Points for one aurora curtain band at time t (seconds). Shared by the
// mount and the rAF drift so both draw the same shape.
function auroraBandPoints(b, t, width, height) {
  const baseY = height * (0.10 + b * 0.11)
  const amp = 26 + b * 18
  const freq = 0.0042 + b * 0.0016
  const phase = b * 2.2
  const pts = []
  for (let x = -60; x <= width + 60; x += 36) {
    pts.push(x, baseY
      + Math.sin(x * freq + t + phase) * amp
      + Math.sin(x * 0.011 + t * 0.7 + phase) * 12)
  }
  return pts
}

// ─── Seeded random for deterministic decoration ───────────────────────
function seededRand(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

// Integer hash/mix. Decorrelates tile coordinates before PRNG seeding.
// Raw linear combinations (tileX * A + tileY * B) fed into an LCG produce
// linearly-correlated outputs (banding). This xorshift-mix scrambles bits
// so adjacent tiles produce completely different PRNG sequences.
function hashMix(x) {
  x |= 0; x = (x ^ (x >>> 16)) * 0x45d9f3b | 0
  x = (x ^ (x >>> 16)) * 0x45d9f3b | 0
  x = x ^ (x >>> 16)
  return x | 0
}

// ─── Tiling twinkle field ────────────────────────────────────────────
// Stars are generated per-tile using a seeded PRNG indexed by (tileX, tileY, starIndex).
// The renderer computes which tiles are visible from camera + scale, then renders stars
// from each tile with world positions mod-wrapped into [0, TILE_SIZE). This gives an
// infinite starfield with no edges, at any pan position and any scale 0.2-3.
const TWINKLE_TILE_SIZE = 1000
const BG_TWINKLE_COLORS = {
  warm:    '#bba080',
  cool:    '#8099bb',
  neutral: '#999999',
}

// Generate a single twinkle star for a given tile + index. Deterministic via seeded PRNG.
function makeTwinkleStar(tileX, tileY, index, variant) {
  const variantSalt = variant === 'near' ? 0x1A2B3C4D : 0x5E6F7081
  const rand = seededRand(hashMix(tileX * 7919 + tileY * 6271 + index * 3571 + variantSalt))
  return {
    x: rand() * TWINKLE_TILE_SIZE,
    y: rand() * TWINKLE_TILE_SIZE,
    r: variant === 'near'
      ? rand() * 1.6 + 1.2          // 1.2-2.8px
      : rand() * 0.6 + 0.8,         // 0.8-1.4px
    baseOp: variant === 'near'
      ? rand() * 0.3 + 0.15          // 0.15-0.45
      : rand() * 0.12 + 0.06,        // 0.06-0.18
    twinkle: variant === 'near' ? rand() < 0.6 : rand() < 0.4,
    phase: rand() * Math.PI * 2,
    speed: variant === 'near'
      ? rand() * 0.5 + 0.2           // 0.2-0.7 Hz
      : rand() * 0.4 + 0.15,         // 0.15-0.55 Hz (slower, subtler)
    colorTemp: rand() < 0.4 ? 'cool' : rand() < 0.7 ? 'warm' : 'neutral',
  }
}

// Compute the set of tile offsets that fully cover the visible world-space range.
// wxMin/wyMin = top-left corner of viewport in world coords, vpW/vpH = viewport size in world coords.
function getVisibleTiles(wxMin, wyMin, vpW, vpH, tileSize) {
  const margin = 1  // 1-tile margin each side covers idle drift (~3 world units at min zoom)
  const minTx = Math.floor(wxMin / tileSize) - margin
  const maxTx = Math.ceil((wxMin + vpW) / tileSize) + margin
  const minTy = Math.floor(wyMin / tileSize) - margin
  const maxTy = Math.ceil((wyMin + vpH) / tileSize) + margin
  const tiles = []
  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      tiles.push({ tx, ty })
    }
  }
  return tiles
}

// ─── Tiling nebula dust clouds (Idea 21) ──────────────────────────
// Faint, large color gradients in the deep background. Optimized: no shadowBlur
// (the #1 perf killer, forces offscreen canvas per circle), reduced count.
const NEBULA_TILE_SIZE = 600
const NEBULA_COLORS = [
  { fill: '#1a1a3a', glow: '#2a2a5a' },  // deep indigo
  { fill: '#2a1a2a', glow: '#4a2a4a' },  // deep purple
  { fill: '#1a2a2a', glow: '#2a4a4a' },  // deep teal
  { fill: '#2a2a1a', glow: '#4a4a2a' },  // deep amber
  { fill: '#1a1a2a', glow: '#2a2a4a' },  // deep navy
  { fill: '#2a1a1a', glow: '#4a2a2a' },  // deep rose
]
const NEBULA_PER_TILE = 2  // 2 clouds per tile, perf-optimized
function makeNebulaCloud(tileX, tileY, index, colors = NEBULA_COLORS) {
  const rand = seededRand(hashMix(tileX * 3571 + tileY * 2957 + index * 777))
  return {
    x: rand() * NEBULA_TILE_SIZE,
    y: rand() * NEBULA_TILE_SIZE,
    radius: 180 + rand() * 220,
    opacity: 0.015 + rand() * 0.035,
    color: colors[index % colors.length],
  }
}

// ─── Meteor spawn ─────────────────────────────────────────────────────
function spawnMeteor() {
  const side = Math.random() < 0.5 ? 'top' : 'left'
  const vx = 300 + Math.random() * 300
  const vy = 200 + Math.random() * 200
  const speed = Math.sqrt(vx * vx + vy * vy)
  return {
    id: Math.random(),
    x: side === 'top' ? Math.random() * 1600 : -50,
    y: side === 'top' ? -50 : Math.random() * 900,
    vx, vy, speed,
    life: 0,
    maxLife: 0.8 + Math.random() * 0.6,
    length: 60 + Math.random() * 80,
  }
}

// ─── Comet spawn ──────────────────────────────────────────────────────
function spawnComet() {
  const side = Math.random() < 0.5 ? 'top' : 'left'
  return {
    id: Math.random(),
    x: side === 'top' ? Math.random() * 1200 : -80,
    y: side === 'top' ? -80 : Math.random() * 700,
    vx: 100 + Math.random() * 100,
    vy: 60 + Math.random() * 80,
    life: 0,
    maxLife: 3 + Math.random() * 2,
    tailLength: 120 + Math.random() * 100,
  }
}

// ─── Fuzzy match helper (Idea 18) ───────────────────────────────────
// Returns a score (higher = better match) or 0 for no match.
function fuzzyMatch(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t === q) return 100 // exact match
  if (t.startsWith(q)) return 90 // prefix match
  if (t.includes(q)) return 70 // substring match
  // Fuzzy: every query char must appear in order
  let qi = 0
  let score = 0
  let lastMatch = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 5 : 1 // consecutive chars score higher
      lastMatch = ti
      qi++
    }
  }
  return qi === q.length ? score : 0
}

// ─── Days since last visit ────────────────────────────────────────────
function daysSinceVisit(note) {
  if (!note?.last_visited) return 999
  return (Date.now() - new Date(note.last_visited).getTime()) / 86400000
}

// Dormant star dimming (Idea 6). Render-time only, no stage regression.
// Stars not visited in 21+ days dim to 30%, after 30 days to 15%.
// Minimum floor of 0.15 keeps them visible. The star is still there.
function dormantDimming(daysSince) {
  if (daysSince < 21) return 1.0
  if (daysSince < 30) return 1.0 - (0.7 * (daysSince - 21) / 9) // 1.0 → 0.3
  return 0.15
}


// ─── Fresh constellation layout (Idea 27) ─────────────────────────────
// Obsidian-style: every open regenerates positions from scratch. Nothing
// persists; a right-drag move lasts only until the next open.
function generateLayout(notes, links) {
  const n = notes.length
  const area = Math.max(60, Math.sqrt(n) * 300)
  const pos = {}
  notes.forEach(note => {
    const angle = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * area
    pos[note.id] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
  })
  const seen = new Set()
  const edges = []
  links.forEach(l => {
    const pairId = [l.note_a, l.note_b].sort().join('-')
    if (seen.has(pairId)) return
    seen.add(pairId)
    edges.push([l.note_a, l.note_b])
  })
  const iterations = n > 300 ? 20 : n > 120 ? 40 : 60
  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations
    for (let i = 0; i < n; i++) {
      const a = pos[notes[i].id]
      for (let j = i + 1; j < n; j++) {
        const b = pos[notes[j].id]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = Math.max(dx * dx + dy * dy, 1) }
        const d = Math.sqrt(d2)
        const f = (9000 / d2) * cooling
        a.x += (dx / d) * f
        a.y += (dy / d) * f
        b.x -= (dx / d) * f
        b.y -= (dy / d) * f
      }
      // Gentle pull toward center so the field does not drift apart
      a.x -= a.x * 0.03 * cooling
      a.y -= a.y * 0.03 * cooling
    }
    // Springs along links keep connected notes as close neighbors
    edges.forEach(([ida, idb]) => {
      const a = pos[ida]
      const b = pos[idb]
      if (!a || !b) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const f = (d - 140) * 0.05 * cooling
      const ux = dx / d
      const uy = dy / d
      a.x += ux * f
      a.y += uy * f
      b.x -= ux * f
      b.y -= uy * f
    })
  }
  return pos
}

// ─── Star-drag spring physics (Obsidian graph-view feel) ─────────────
// The dragged star is pinned to the cursor; every star linked to it is
// tugged along by a spring (Hooke) with damping, so neighbors lag and
// wobble instead of moving rigidly. Rest length matches the layout
// relaxation spring so a released link settles back to its natural gap.
const STAR_SPRING_REST = 140
const STAR_SPRING_K = 0.18
const STAR_SPRING_DAMPING = 0.86
const STAR_REPEL_STRENGTH = 900
const STAR_DRAG_SUBSTEPS = 3
const STAR_DRAG_DT = 1 / 60

function stepStarSprings(r) {
  const { pos, vel, edges, pinned } = r
  const ids = Object.keys(pos)
  // Spring attraction along links. The pinned star is immovable, so all
  // force goes into its neighbors.
  edges.forEach(([a, b]) => {
    const pa = pos[a]
    const pb = pos[b]
    let ddx = pb.x - pa.x
    let ddy = pb.y - pa.y
    const d = Math.max(1, Math.sqrt(ddx * ddx + ddy * ddy))
    const ux = ddx / d
    const uy = ddy / d
    const f = Math.max(-120, Math.min(120, (d - STAR_SPRING_REST) * STAR_SPRING_K))
    if (a !== pinned) { vel[a].x += ux * f; vel[a].y += uy * f }
    if (b !== pinned) { vel[b].x -= ux * f; vel[b].y -= uy * f }
  })
  // Light mutual repulsion so linked stars do not pile up on the pinned
  // one while it is being dragged.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]
      const b = ids[j]
      if (a === pinned && b === pinned) continue
      const pa = pos[a]
      const pb = pos[b]
      let ddx = pb.x - pa.x
      let ddy = pb.y - pa.y
      const d2 = Math.max(400, ddx * ddx + ddy * ddy)
      const d = Math.sqrt(d2)
      const ux = ddx / d
      const uy = ddy / d
      const f = STAR_REPEL_STRENGTH / d2
      if (a !== pinned) { vel[a].x -= ux * f; vel[a].y -= uy * f }
      if (b !== pinned) { vel[b].x += ux * f; vel[b].y += uy * f }
    }
  }
  // Integrate with damping (under 1 gives a visible wobble, then settle).
  ids.forEach(id => {
    const v = vel[id]
    v.x *= STAR_SPRING_DAMPING
    v.y *= STAR_SPRING_DAMPING
    pos[id].x += v.x * STAR_DRAG_DT
    pos[id].y += v.y * STAR_DRAG_DT
  })
}

// ─── Component ────────────────────────────────────────────────────────
export default function Constellation({
  notes, links, onNoteClick, selectedNote, onCloseNote,
  onSave, onWish, onDelete, onCreate,
  showStats, onCloseStats, onReturnHome,
  pendingNoteId, onPendingNoteHandled,
  pendingNewNote, onPendingNewNoteHandled,
  onStageUp,
  onWishGlow,
  hideHomeButton = false,
}) {
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press
  const { prefs } = usePreferences()
  const skyPrefs = prefs.sky || {}

  // ─── Session layout (Idea 27) ───────────────────────────────────────
  // Fresh random positions every open, never persisted. Left-drag a star
  // to reposition it (linked stars follow) until the next open.
  const layoutDoneRef = useRef(false)
  const starDragRef = useRef(null)
  const suppressClickRef = useRef(null)
  const starSettleRafRef = useRef(null)
  const [sessionPos, setSessionPos] = useState(() => {
    if (!notes || notes.length === 0) return null
    layoutDoneRef.current = true
    return generateLayout(notes, links)
  })

  const posOf = useCallback((note) => {
    const p = sessionPos && sessionPos[note.id]
    return p ? p : { x: note.world_x || 0, y: note.world_y || 0 }
  }, [sessionPos])

  // Generate once per open when notes arrive after mount. New notes
  // created mid-session get a spot anchored to a linked star, or a
  // random position when unlinked.
  useEffect(() => {
    if (!notes || notes.length === 0) return
    if (!layoutDoneRef.current) {
      layoutDoneRef.current = true
      setSessionPos(generateLayout(notes, links))
      return
    }
    const missing = notes.filter(n => !sessionPos?.[n.id])
    if (missing.length === 0) return
    setSessionPos(prev => {
      const next = { ...prev }
      missing.forEach(n => {
        const link = links.find(l => l.note_a === n.id || l.note_b === n.id)
        const anchorId = link ? (link.note_a === n.id ? link.note_b : link.note_a) : null
        const anchor = anchorId ? next[anchorId] : null
        const angle = Math.random() * Math.PI * 2
        const r = anchor ? 60 + Math.random() * 120 : Math.random() * 500
        next[n.id] = anchor
          ? { x: anchor.x + Math.cos(angle) * r, y: anchor.y + Math.sin(angle) * r }
          : { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
      })
      return next
    })
  }, [notes, links, sessionPos])
  // Starfield knobs (from Customization > Constellation). Re-render the
  // layers when they change so the field responds live.
  const starDensity = skyPrefs.density || 'normal'
  const twinkleSpeed = skyPrefs.twinkle_speed || 'normal'
  const starColor = skyPrefs.star_color || 'natural'
  const nebulaEnabled = skyPrefs.nebula_enabled !== false
  const densityMul = starDensity === 'sparse' ? 0.6 : starDensity === 'dense' ? 1.8 : 1
  const speedMul = twinkleSpeed === 'slow' ? 0.5 : twinkleSpeed === 'fast' ? 2 : 1
  const stageRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  // Camera / interaction
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef(null)

  // Pan inertia (Idea 5). Drag release continues with deceleration.
  const inertiaRafRef = useRef(null)
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 })

  // Overlays
  const [editingNote, setEditingNote] = useState(null)
  const [editBody, setEditBody] = useState('')
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [showNewPrompt, setShowNewPrompt] = useState(false)

  const meteorsRef = useRef([])
  const cometsRef = useRef([])
  const meteorTimerRef = useRef(null)
  const cometTimerRef = useRef(null)

  // Hover state (triggers re-render, acceptable at low frequency)
  const [hoveredStar, setHoveredStar] = useState(null)
  // Constellation pulse. Tracks fade-out timing for previously hovered star.
  const prevHoveredRef = useRef(null)
  const pulseFadeRef = useRef(null)
  // Press feedback for Konva stars (item 1, micro-feedback on click)
  const [pressedStar, setPressedStar] = useState(null)

  // ─── Idle cursor awareness (Idea 8) ─────────────────────────────────
  const [idleStar, setIdleStar] = useState(null)       // note id nearest to cursor when idle
  const [idleFade, setIdleFade] = useState(1)          // 1 = full bright, fading to 0 on movement
  const cursorRef = useRef({ x: 0, y: 0 })            // last known cursor screen pos
  const idleTimerRef = useRef(null)                     // setTimeout for 30s threshold
  const idleFadeRafRef = useRef(null)                   // RAF for fade-out after movement
  const IDLE_THRESHOLD_MS = 30000                       // 30 seconds

  // Returning/star-up pulse state (keyed by note id)
  const [pulseMap, setPulseMap] = useState({})
  // Trail birth timestamps (keyed by 'a-b' sorted pair id)
  const [trailBirth, setTrailBirth] = useState({})
  const prevTrailsRef = useRef([])

  // Closing animation state
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef(null)

  // Session trail (Idea 20). Ghost path connecting recently opened notes.
  const [sessionTrail, setSessionTrail] = useState([]) // [{id, x, y, timestamp}]
  const SESSION_TRAIL_MAX_AGE_MS = 60000 // 60 seconds
  const SESSION_TRAIL_MIN_OPACITY = 0.04
  const SESSION_TRAIL_MAX_OPACITY = 0.18

  // ─── Search and fly-to (Idea 18) ────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const searchInputRef = useRef(null)

  // ─── Zoom-to-note flight (Idea 14) ──────────────────────────────────
  const flyToRafRef = useRef(null)

  // Stage crossing burst (Idea 2). Localized meteor at star position.
  const [stageBursts, setStageBursts] = useState([])
  const stageBurstTimersRef = useRef({})

  // Arrival animation (item 4). noteId -> timestamp.
  const [arrivingStars, setArrivingStars] = useState({})
  // Departure animation (item 5). { id, start } or null.
  const [departingStar, setDepartingStar] = useState(null)
  const departTimerRef = useRef(null)
  const arrivalTimersRef = useRef({})

  // ─── Ambient palette from Go backend (time-of-day + seasonal) ──────
  const [palette, setPalette] = useState(ambientPalette())
  const meteorBoost = palette.meteorBoost || 1
  const auroraActive = !!palette.aurora && !reducedMotion
  // Aurora runs imperatively on the rAF loop (refs, no React state) so
  // the curtains drift without re-rendering the whole constellation.
  const auroraLayerRef = useRef(null)
  const auroraLineRefs = useRef([])
  const auroraActiveRef = useRef(auroraActive)
  auroraActiveRef.current = auroraActive
  useEffect(() => {
    let mounted = true
    const fetchPalette = () => {
      if (!wails) return // browser/mock mode: keep hardcoded ambientPalette()
      // If the user pinned a season in Customization, ask the backend
      // for that season's palette instead of the current wall-clock one.
      GetPalette().then(c => {
        if (mounted) setPalette({
          line: c.accent,
          text: c.primary,
          sky: c.sky || colors.bg,
          nebula: c.nebula || '',
          aurora: !!c.aurora,
          meteorBoost: c.meteor_boost || 1,
        })
      }).catch(() => {}) // fallback to hardcoded ambientPalette()
    }
    fetchPalette()
    // Re-fetch every 30 minutes to catch hour-of-day changes, and
    // immediately when the user pins a new season in Customization.
    const interval = setInterval(fetchPalette, 30 * 60 * 1000)
    return () => { mounted = false; clearInterval(interval) }
  }, [skyPrefs.season])

  // ─── Initial camera (center on oldest note, with drift-in) ────────────
  const driftRafRef = useRef(null)
  const getInitialCamera = useCallback(() => {
    if (!notes || notes.length === 0 || !sessionPos) return { x: 0, y: 0 }
    const oldest = notes.reduce((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return aTime < bTime ? a : b
    })
    const p = posOf(oldest)
    return {
      x: window.innerWidth / 2 - p.x,
      y: window.innerHeight / 2 - p.y,
    }
  }, [notes, posOf])

  // Entrance drift-in: camera starts offset, eases into target over ~600ms
  const driftedRef = useRef(false)
  useEffect(() => {
    if (!sessionPos) { driftedRef.current = false; return } // wait for the fresh layout
    if (driftedRef.current) return // only run once on initial mount
    if (!notes || notes.length === 0) return // wait for notes to load first
    const target = getInitialCamera()
    if (reducedMotion) {
      setCamera(target)
      driftedRef.current = true
      return
    }
    driftedRef.current = true
    // Start offset ~40px to the right and ~30px down from target
    const offset = { x: target.x + 40, y: target.y + 30 }
    setCamera(offset)
    const startTime = performance.now()
    const duration = 600
    const tick = (now) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      // Ease-out quad: fast start, gentle settle
      const ease = 1 - (1 - t) * (1 - t)
      setCamera({
        x: offset.x + (target.x - offset.x) * ease,
        y: offset.y + (target.y - offset.y) * ease,
      })
      if (t < 1) {
        driftRafRef.current = requestAnimationFrame(tick)
      }
    }
    driftRafRef.current = requestAnimationFrame(tick)
    return () => { if (driftRafRef.current) cancelAnimationFrame(driftRafRef.current) }
  }, [getInitialCamera, reducedMotion, notes, sessionPos])

  // ─── Pending note from Home ──────────────────────────────────────────
  useEffect(() => {
    if (pendingNoteId) {
      onNoteClick(pendingNoteId)
      onPendingNoteHandled?.()
    }
  }, [pendingNoteId, onNoteClick, onPendingNoteHandled])

  useEffect(() => {
    if (pendingNewNote) {
      setShowNewPrompt(true)
      onPendingNewNoteHandled?.()
    }
  }, [pendingNewNote, onPendingNewNoteHandled])



  // ─── Trail draw-in detection (item 3) ─────────────────────────────────
  useEffect(() => {
    const prevIds = new Set(
      prevTrailsRef.current.map(t => [t.note_a, t.note_b].sort().join('-'))
    )
    links.forEach(t => {
      const id = [t.note_a, t.note_b].sort().join('-')
      if (!prevIds.has(id)) {
        setTrailBirth(prev => ({ ...prev, [id]: Date.now() }))
      }
    })
    // Clean up stale entries for trails that no longer exist
    const currentIds = new Set(
      links.map(t => [t.note_a, t.note_b].sort().join('-'))
    )
    setTrailBirth(prev => {
      const next = {}
      Object.keys(prev).forEach(k => { if (currentIds.has(k)) next[k] = prev[k] })
      return next
    })
    prevTrailsRef.current = links
  }, [links])

  // ─── Returning pulse auto-clear ──────────────────────────────────────
  useEffect(() => {
    const entries = Object.entries(pulseMap)
    if (entries.length === 0) return
    const timeout = setTimeout(() => {
      setPulseMap(prev => {
        const next = { ...prev }
        const now = Date.now()
        entries.forEach(([id, p]) => {
          if (now - p.start > 1500) delete next[id]
        })
        return next
      })
    }, 1800)
    return () => clearTimeout(timeout)
  }, [pulseMap])

  // ─── Meteor / comet spawn timers ─────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return

    const scheduleMeteor = () => {
      meteorTimerRef.current = setTimeout(() => {
        meteorsRef.current = [...meteorsRef.current, spawnMeteor()]
        scheduleMeteor()
      }, (6000 + Math.random() * 18000) / meteorBoost)
    }
    scheduleMeteor()

    const scheduleComet = () => {
      cometTimerRef.current = setTimeout(() => {
        cometsRef.current = [...cometsRef.current, spawnComet()]
        scheduleComet()
      }, 25000 + Math.random() * 45000)
    }
    scheduleComet()

    return () => {
      clearTimeout(meteorTimerRef.current)
      clearTimeout(cometTimerRef.current)
    }
    // meteorBoost re-triggers the schedule when a shower palette arrives.
  }, [reducedMotion, meteorBoost])

  // ─── Animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return

    const tick = (now) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = now

      // Update meteors
      meteorsRef.current = meteorsRef.current
        .map(m => ({ ...m, x: m.x + m.vx * dt, y: m.y + m.vy * dt, life: m.life + dt }))
        .filter(m => m.life < m.maxLife)

      // Update stage crossing bursts (Idea 2)
      setStageBursts(prev => {
        if (prev.length === 0) return prev // skip re-render when empty
        const next = prev.map(s => ({ ...s, life: s.life + dt }))
        return next.filter(s => s.life < s.maxLife)
      })

      // Update comets
      cometsRef.current = cometsRef.current
        .map(c => ({ ...c, x: c.x + c.vx * dt, y: c.y + c.vy * dt, life: c.life + dt }))
        .filter(c => c.life < c.maxLife)

      // Drift the aurora curtains. Own layer only, no React re-render.
      if (auroraActiveRef.current && auroraLayerRef.current) {
        const t = now / 3000
        const width = window.innerWidth
        const height = window.innerHeight
        for (let b = 0; b < 3; b++) {
          const line = auroraLineRefs.current[b]
          if (!line) continue
          line.points(auroraBandPoints(b, t, width, height))
          line.opacity(Math.max(0.02, 0.045 + Math.sin(t * 0.5 + b * 1.7) * 0.015))
        }
        auroraLayerRef.current.batchDraw()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [reducedMotion])

  // --- Show/hide home button ---
  const showHomeButton = !hideHomeButton && !selectedNote && !editingNote && !showNewPrompt && !showStats && !searchOpen

  // Search fly-to (Idea 18). Focus input when search opens.
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Search results (Idea 18). Fuzzy match on note titles.
  const searchResults = searchQuery.trim()
    ? notes
        .map(n => ({ note: n, score: fuzzyMatch(searchQuery, n.title) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
    : []

  // Fly-to-note from search (Idea 18). Reuse camera flight logic.
  const handleSearchSelect = useCallback((note) => {
    setSearchOpen(false)
    setSearchQuery('')
    // Cancel any running camera animations
    if (flyToRafRef.current) cancelAnimationFrame(flyToRafRef.current)
    if (driftRafRef.current) { cancelAnimationFrame(driftRafRef.current); driftRafRef.current = null }
    if (inertiaRafRef.current) { cancelAnimationFrame(inertiaRafRef.current); inertiaRafRef.current = null }

    if (!reducedMotion) {
      const targetScale = Math.min(3, Math.max(1.2, scale * 1.15))
      const pSel = posOf(note)
      const targetCamX = window.innerWidth / 2 - pSel.x * targetScale
      const targetCamY = window.innerHeight / 2 - pSel.y * targetScale
      const startCam = { ...camera }
      const startScale = scale
      const startTime = performance.now()
      const duration = 500
      const tick = (now) => {
        const t = Math.min((now - startTime) / duration, 1)
        const ease = 1 - (1 - t) * (1 - t) // ease-out quad
        setCamera({
          x: startCam.x + (targetCamX - startCam.x) * ease,
          y: startCam.y + (targetCamY - startCam.y) * ease,
        })
        setScale(startScale + (targetScale - startScale) * ease)
        if (t < 1) {
          flyToRafRef.current = requestAnimationFrame(tick)
        } else {
          flyToRafRef.current = null
        }
      }
      flyToRafRef.current = requestAnimationFrame(tick)
    }
    onNoteClick(note.id)
  }, [notes, onNoteClick, reducedMotion, scale, camera, posOf])

  // ─── World → screen coordinate transform ─────────────────────────────
  const worldToScreen = useCallback((wx, wy, layer) => {
    if (layer === 'bg') {
      // Background twinkle: zooms at 45% rate + pans at 45% rate (parallax depth).
      return {
        x: wx * scale * 0.45 + camera.x * 0.45,
        y: wy * scale * 0.45 + camera.y * 0.45,
      }
    }
    // Foreground note-stars: full zoom + camera pan.
    return {
      x: wx * scale + camera.x,
      y: wy * scale + camera.y,
    }
  }, [scale, camera])

  // ─── Mouse handlers ──────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (selectedNote || showNewPrompt || showStats) return
    if (e.evt.button !== 0) return // left button only
    const target = e.target
    // Any hit on a shape (a star, or one of its inner paths/labels) must
    // not pan. Only an empty-canvas hit reaches the stage itself. The old
    // name check missed the star's children, so pan engaged underneath a
    // star drag and kept chasing the cursor after release.
    if (target && target !== e.target.getStage()) return
    // Cancel entrance drift if user starts panning
    if (driftRafRef.current) {
      cancelAnimationFrame(driftRafRef.current)
      driftRafRef.current = null
    }
    // Cancel zoom-to-note flight if user starts panning
    if (flyToRafRef.current) {
      cancelAnimationFrame(flyToRafRef.current)
      flyToRafRef.current = null
    }
    // Cancel inertia if user starts a new drag
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = null
    }
    // A settle left over from a released star drag must not survive into
    // a pan (it would keep moving stars and re-arm on the pan's release).
    cancelStarSettle()
    starDragRef.current = null

    isDraggingRef.current = true
    setIsDragging(true)
    dragStartRef.current = { x: e.evt.clientX - camera.x, y: e.evt.clientY - camera.y }
    velocityRef.current = { vx: 0, vy: 0, lastX: e.evt.clientX, lastY: e.evt.clientY, lastTime: performance.now() }
  }, [camera, selectedNote, showNewPrompt, showStats])

  const handleMouseMove = useCallback((e) => {
    // Star drag (Idea 27). The pinned star snaps to the cursor; linked
    // stars wobble after it on springs, graph-view style.
    if (starDragRef.current) {
      const r = starDragRef.current
      // Released: the settle loop owns the simulation now. A stray
      // mousemove must not re-pin the star or the cursor keeps dragging
      // it (the delayed-detach feel).
      if (r.settling) return
      const dx = (e.evt.clientX - r.clientX) / scale
      const dy = (e.evt.clientY - r.clientY) / scale
      if (Math.hypot(e.evt.clientX - r.clientX, e.evt.clientY - r.clientY) > 4) {
        r.moved = true
        setPressedStar(null)
      }
      // Pinned star follows the cursor exactly.
      r.pos[r.pinned] = { x: r.startX + dx, y: r.startY + dy }
      // Spring relaxation of the linked neighborhood.
      for (let s = 0; s < STAR_DRAG_SUBSTEPS; s++) stepStarSprings(r)
      const next = {}
      for (const id in r.pos) next[id] = r.pos[id]
      setSessionPos(prev => prev ? { ...prev, ...next } : prev)
      e.target.getStage().container().style.cursor = 'grabbing'
      return
    }
    // Pan (drag to move camera). Use ref to avoid stale closure.
    if (isDraggingRef.current && dragStartRef.current) {
      const now = performance.now()
      const v = velocityRef.current
      const dt = (now - v.lastTime) / 1000
      if (dt > 0) {
        // Exponential moving average for smooth velocity
        const alpha = 0.3
        v.vx = v.vx * (1 - alpha) + ((e.evt.clientX - v.lastX) / dt) * alpha
        v.vy = v.vy * (1 - alpha) + ((e.evt.clientY - v.lastY) / dt) * alpha
      }
      v.lastX = e.evt.clientX
      v.lastY = e.evt.clientY
      v.lastTime = now
      setCamera({
        x: e.evt.clientX - dragStartRef.current.x,
        y: e.evt.clientY - dragStartRef.current.y,
      })
      return
    }
    // ── Idle cursor awareness (Idea 8) ──
    // Track cursor position and reset idle timer on every move.
    cursorRef.current = { x: e.evt.clientX, y: e.evt.clientY }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    // If we had an idle star, start a 300ms fade-out
    if (idleStar && idleFade > 0 && !reducedMotion) {
      const fadeStart = performance.now()
      const fadeDuration = 300
      if (idleFadeRafRef.current) cancelAnimationFrame(idleFadeRafRef.current)
      const tick = (now) => {
        const progress = Math.min(1, (now - fadeStart) / fadeDuration)
        setIdleFade(1 - progress)
        if (progress >= 1) {
          setIdleStar(null)
          setIdleFade(1)
          return
        }
        idleFadeRafRef.current = requestAnimationFrame(tick)
      }
      idleFadeRafRef.current = requestAnimationFrame(tick)
    } else {
      setIdleStar(null)
      setIdleFade(1)
    }
    // Schedule new idle check
    idleTimerRef.current = setTimeout(() => {
      // Find nearest note-star to cursor screen position
      if (!notes || notes.length === 0) return
      const cx = cursorRef.current.x
      const cy = cursorRef.current.y
      let nearest = null
      let minDist = Infinity
      notes.forEach(n => {
        const s = worldToScreen(posOf(n).x, posOf(n).y, 'fg')
        const dx = s.x - cx
        const dy = s.y - cy
        const dist = dx * dx + dy * dy
        if (dist < minDist) { minDist = dist; nearest = n.id }
      })
      if (nearest) {
        setIdleStar(nearest)
        setIdleFade(1)
      }
    }, IDLE_THRESHOLD_MS)
  }, [notes, worldToScreen, reducedMotion, idleStar, idleFade, scale])

  // ─── Star-drag settle + finalize ─────────────────────────────────────
  // After release, let the linked springs keep wobbling for a moment and
  // decay to rest before freezing the session positions.
  const cancelStarSettle = () => {
    if (starSettleRafRef.current) {
      cancelAnimationFrame(starSettleRafRef.current)
      starSettleRafRef.current = null
    }
  }

  const settleStarDrag = (r) => {
    let frames = 0
    const tick = () => {
      // A newer drag or press replaced us: stop silently. Finalizing
      // here would null starDragRef out from under the new drag.
      if (starDragRef.current !== r) {
        starSettleRafRef.current = null
        return
      }
      let maxV = 0
      const ids = Object.keys(r.pos)
      ids.forEach(id => { maxV = Math.max(maxV, Math.hypot(r.vel[id].x, r.vel[id].y)) })
      if (maxV < 1.0 || frames > 80) {
        starSettleRafRef.current = null
        finalizeStarDrag(r)
        return
      }
      for (let s = 0; s < STAR_DRAG_SUBSTEPS; s++) stepStarSprings(r)
      frames++
      const next = {}
      for (const id in r.pos) next[id] = r.pos[id]
      setSessionPos(prev => prev ? { ...prev, ...next } : prev)
      starSettleRafRef.current = requestAnimationFrame(tick)
    }
    cancelStarSettle() // never run two settles at once
    starSettleRafRef.current = requestAnimationFrame(tick)
  }

  const finalizeStarDrag = (r) => {
    // Only the drag we own may clear the ref; a newer drag stays intact.
    if (starDragRef.current === r) starDragRef.current = null
    cancelStarSettle()
    // Make sure the pan never stayed engaged underneath the star drag.
    isDraggingRef.current = false
    setIsDragging(false)
    dragStartRef.current = null
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
    if (stageRef.current) stageRef.current.container().style.cursor = 'default'
    // A real drag must not open the note on release.
    if (r.moved) {
      suppressClickRef.current = r.noteId
      setTimeout(() => { if (suppressClickRef.current === r.noteId) suppressClickRef.current = null }, 600)
    }
  }

  // ─── Constellation line pulse on hover (Idea 1) ───────────────────────
  // When hover leaves, trigger a 200ms fade-out pulse on previously connected lines.
  const schedulePulseFade = useCallback(() => {
    const starId = prevHoveredRef.current
    if (!starId) return
    pulseFadeRef.current = { starId, startTime: Date.now() }
    const tick = () => {
      if (!pulseFadeRef.current) return
      const elapsed = Date.now() - pulseFadeRef.current.startTime
      if (elapsed >= 200) {
        pulseFadeRef.current = null
        if (stageRef.current) stageRef.current.batchDraw()
        return
      }
      if (stageRef.current) stageRef.current.batchDraw()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  const handleMouseUp = useCallback((e) => {
    if (starDragRef.current) {
      const r = starDragRef.current
      e.target.getStage().container().style.cursor = 'default'
      // Let the linked stars' springs settle back; a lone star ends now.
      // The settling flag also stops the window-level fallback from
      // starting a second simulation for the same release.
      if (!r.settling) {
        r.settling = true
        if (r.moved && r.edges.length > 0) settleStarDrag(r)
        else finalizeStarDrag(r)
      }
      return
    }
    isDraggingRef.current = false
    setIsDragging(false)
    dragStartRef.current = null

    // Pan inertia (Idea 5). Apply deceleration if velocity is significant.
    if (!reducedMotion) {
      const v = velocityRef.current
      const speed = Math.hypot(v.vx, v.vy)
      if (speed > 200) { // only inert if moving fast enough
        const startTime = performance.now()
        const duration = 400
        const decay = { vx: v.vx, vy: v.vy }
        let lastFrameTime = startTime
        const tick = (now) => {
          const frameDt = (now - lastFrameTime) / 1000
          lastFrameTime = now
          const t = Math.min((now - startTime) / duration, 1)
          // Exponential decay
          const dampening = 1 - t
          setCamera(prev => ({
            x: prev.x + decay.vx * dampening * frameDt,
            y: prev.y + decay.vy * dampening * frameDt,
          }))
          if (t < 1) {
            inertiaRafRef.current = requestAnimationFrame(tick)
          } else {
            inertiaRafRef.current = null
          }
        }
        inertiaRafRef.current = requestAnimationFrame(tick)
      }
    }
  }, [reducedMotion])

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault()
    // Cancel inertia on wheel
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = null
    }
    const scaleBy = 1.1
    setScale(s => Math.max(0.2, Math.min(3, e.evt.deltaY > 0 ? s / scaleBy : s * scaleBy)))
  }, [])

  // Safety: end a star drag even when the pointer releases outside the
  // stage (window-level fallback).
  useEffect(() => {
    const up = () => {
      const r = starDragRef.current
      // The stage handler already started settling this release; the
      // bubble-up must not start a second, fighting simulation.
      if (r && !r.settling) {
        r.settling = true
        if (r.moved && r.edges.length > 0) settleStarDrag(r)
        else finalizeStarDrag(r)
      }
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ─── Keyboard ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // ── Search and fly-to (Idea 18) ──
      // Ctrl+K opens search always; '/' only when not in input and search not already open
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setSearchQuery('')
        setSearchIndex(0)
        return
      }
      if (e.key === '/' && !searchOpen && !e.target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        setSearchOpen(true)
        setSearchQuery('')
        setSearchIndex(0)
        return
      }
      if (e.key === 'Escape' && searchOpen) {
        e.preventDefault()
        setSearchOpen(false)
        setSearchQuery('')
        return
      }
      if (e.key === 'Escape') {
        if (showNewPrompt) { setShowNewPrompt(false); return }
        if (editingNote) { setEditingNote(null); return }
        if (showStats) { onCloseStats(); return }
        if (selectedNote) { onCloseNote(); return }
      }
      if (e.key === 'n' && !selectedNote && !showNewPrompt && !showStats && !searchOpen) {
        setShowNewPrompt(true)
      }
      if (e.key === 'e' && selectedNote && !editingNote && !showStats && !searchOpen) {
        setEditingNote(selectedNote)
        setEditBody(selectedNote.body || '')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNote, showNewPrompt, editingNote, showStats, searchOpen, onCloseNote, onCloseStats])

  // ─── Note actions ────────────────────────────────────────────────────
  const handleCreateSubmit = useCallback(async () => {
    if (newNoteTitle.trim()) {
      const note = await onCreate(newNoteTitle.trim(), selectedNote?.id || '')
      // Track arrival animation for the new star (item 4)
      if (note?.id) {
        const t = Date.now()
        setArrivingStars(prev => ({ ...prev, [note.id]: t }))
        arrivalTimersRef.current[note.id] = setTimeout(() => {
          setArrivingStars(prev => {
            const next = { ...prev }
            delete next[note.id]
            return next
          })
          delete arrivalTimersRef.current[note.id]
        }, 800)
      }
      setNewNoteTitle('')
      setShowNewPrompt(false)
    }
  }, [newNoteTitle, selectedNote, onCreate])

  const handleSaveEdit = useCallback(async () => {
    if (editingNote) {
      await onSave(editingNote.id, editingNote.title, editBody)
      setEditingNote(null)
    }
  }, [editingNote, editBody, onSave])

  // Auto-save. Saves without closing the editor.
  const handleAutoSave = useCallback(async () => {
    if (editingNote) {
      await onSave(editingNote.id, editingNote.title, editBody)
    }
  }, [editingNote, editBody, onSave])

  // Delete with departure animation (item 5). Star shrinks before removal.
  const handleDeleteRequest = useCallback((noteId) => {
    if (reducedMotion) {
      onDelete(noteId)
      return
    }
    onCloseNote()
    setDepartingStar({ id: noteId, start: Date.now() })
    departTimerRef.current = setTimeout(() => {
      setDepartingStar(null)
      onDelete(noteId)
    }, 400)
  }, [reducedMotion, onDelete, onCloseNote])

  // Note click. Fires returning pulse + camera flight (Idea 14) + session trail (Idea 20).
  const handleStarClick = useCallback((noteId) => {
    // Ignore the click that ends a real star drag.
    if (suppressClickRef.current === noteId) {
      suppressClickRef.current = null
      return
    }
    const note = notes.find(n => n.id === noteId)
    const np = note ? posOf(note) : { x: 0, y: 0 }
    if (note && daysSinceVisit(note) > 7) {
      // Prevent re-triggering pulse if one is already active for this note
      setPulseMap(prev => {
        const existing = prev[noteId]
        if (existing && (Date.now() - existing.start) < 1500) return prev
        return { ...prev, [noteId]: { type: 'returning', start: Date.now() } }
      })
    }

    // Session trail (Idea 20). Append opened note to ghost trail.
    if (note) {
      setSessionTrail(prev => {
        const now = Date.now()
        // Deduplicate: if the last entry is the same note, skip entirely
        const last = prev[prev.length - 1]
        if (last && last.id === noteId) return prev
        // Also skip if same note was added within the last 2s (prevents rapid A-B-A-B buildup)
        const recentDupe = prev.find(e => e.id === noteId && (now - e.timestamp) < 2000)
        if (recentDupe) return prev
        const next = [...prev, { id: noteId, x: np.x, y: np.y, timestamp: now }]
        // Keep only entries younger than 60s
        return next.filter(e => now - e.timestamp < SESSION_TRAIL_MAX_AGE_MS)
      })
    }

    // Camera flight (Idea 14). Pan + subtle zoom to center the star.
    if (!reducedMotion && note) {
      if (flyToRafRef.current) cancelAnimationFrame(flyToRafRef.current)
      if (driftRafRef.current) { cancelAnimationFrame(driftRafRef.current); driftRafRef.current = null }

      // Target: center the star on screen at a slightly zoomed-in scale
      const targetScale = Math.min(3, Math.max(1.2, scale * 1.15))
      const pSel = posOf(note)
      const targetCamX = window.innerWidth / 2 - pSel.x * targetScale
      const targetCamY = window.innerHeight / 2 - pSel.y * targetScale

      // Current screen position of the star
      const curScreenX = np.x * scale + camera.x
      const curScreenY = np.y * scale + camera.y
      const distFromCenter = Math.hypot(
        curScreenX - window.innerWidth / 2,
        curScreenY - window.innerHeight / 2,
      )

      // Only fly if star is more than 15% of viewport away from center
      const threshold = Math.min(window.innerWidth, window.innerHeight) * 0.15
      if (distFromCenter > threshold) {
        const startCam = { ...camera }
        const startScale = scale
        const startTime = performance.now()
        const duration = 400

        const tick = (now) => {
          const t = Math.min((now - startTime) / duration, 1)
          const ease = 1 - (1 - t) * (1 - t) // ease-out quad
          setCamera({
            x: startCam.x + (targetCamX - startCam.x) * ease,
            y: startCam.y + (targetCamY - startCam.y) * ease,
          })
          setScale(startScale + (targetScale - startScale) * ease)
          if (t < 1) {
            flyToRafRef.current = requestAnimationFrame(tick)
          } else {
            flyToRafRef.current = null
          }
        }
        flyToRafRef.current = requestAnimationFrame(tick)
      }
    }

    onNoteClick(noteId)
  }, [notes, onNoteClick, reducedMotion, scale, camera, posOf])

  // ─── Stage-up flourish trigger (called by parent after wish changes stage) ─
  useEffect(() => {
    if (onStageUp) {
      onStageUp.current = (noteId) => {
        const now = Date.now()
        // Triple-pulse sparkle (existing item 13)
        setPulseMap(prev => ({ ...prev, [noteId]: { type: 'stageUp', start: now } }))
        // Shooting star burst (Idea 2). Spawn 2-3 short streaks from star position.
        if (!reducedMotion) {
          const note = notes.find(n => n.id === noteId)
          if (note) {
            const burstId = `${noteId}-${now}`
            const streaks = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, (_, i) => ({
              id: `${burstId}-${i}`,
              startX: posOf(note).x,
              startY: posOf(note).y,
              angle: Math.random() * Math.PI * 2,
              speed: 150 + Math.random() * 200,
              length: 30 + Math.random() * 40,
              life: 0,
              maxLife: 0.5 + Math.random() * 0.4,
            }))
            setStageBursts(prev => [...prev, ...streaks])
            // Cleanup after max burst life + margin
            stageBurstTimersRef.current[burstId] = setTimeout(() => {
              setStageBursts(prev => prev.filter(s => !s.id.startsWith(burstId)))
              delete stageBurstTimersRef.current[burstId]
            }, 1200)
          }
        }
      }
    }
  }, [onStageUp, notes, reducedMotion, posOf])

  // Wish glow trigger (item 2). Fires on every successful wish.
  useEffect(() => {
    if (onWishGlow) {
      onWishGlow.current = (noteId) => {
        setPulseMap(prev => ({ ...prev, [noteId]: { type: 'wishGlow', start: Date.now() } }))
      }
    }
  }, [onWishGlow])



  // ─── Closing-the-constellation animation (item 14) ──────────────────
  const handleCloseConstellation = useCallback(() => {
    if (isClosing || reducedMotion) {
      clearTimeout(closeTimerRef.current)
      onReturnHome()
      return
    }
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false)
      onReturnHome()
    }, 600)
  }, [isClosing, reducedMotion, onReturnHome])

  // Cleanup closing timer on unmount
  useEffect(() => () => clearTimeout(closeTimerRef.current), [])
  // Cleanup inertia on unmount
  useEffect(() => () => { if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current) }, [])
  // Cleanup the star-drag settle loop on unmount
  useEffect(() => () => cancelStarSettle(), [])
  // Cleanup zoom-to-note flight on unmount
  useEffect(() => () => { if (flyToRafRef.current) cancelAnimationFrame(flyToRafRef.current) }, [])
  // Cleanup departure timer on unmount
  useEffect(() => () => clearTimeout(departTimerRef.current), [])
  // Cleanup stage burst timers on unmount
  useEffect(() => () => {
    Object.values(stageBurstTimersRef.current).forEach(clearTimeout)
  }, [])
  // Cleanup arrival timers on unmount
  useEffect(() => () => {
    Object.values(arrivalTimersRef.current).forEach(clearTimeout)
  }, [])
  // Cleanup idle cursor timers on unmount
  useEffect(() => () => {
    clearTimeout(idleTimerRef.current)
    if (idleFadeRafRef.current) cancelAnimationFrame(idleFadeRafRef.current)
  }, [])
  // Cleanup session trail expired entries (Idea 20)
  useEffect(() => {
    if (sessionTrail.length === 0) return
    const timer = setInterval(() => {
      setSessionTrail(prev => {
        const now = Date.now()
        const next = prev.filter(e => now - e.timestamp < SESSION_TRAIL_MAX_AGE_MS)
        return next.length === prev.length ? prev : next
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [sessionTrail.length])

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: isClosing ? 0 : 1, scale: isClosing ? 1.08 : 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{
        duration: isClosing ? 0.5 : motionTokens.duration.normal,
        ease: motionTokens.easing.smooth,
      }}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ background: palette.sky || colors.bg }}
      >
        {/* ── Aurora curtains (seasonal). Deepest layer, non-interactive.
            Winter nights only: soft green/violet bands, drifted by the
            rAF loop via Konva refs (no React re-render per frame). */}
        {auroraActive && (
          <Layer ref={auroraLayerRef} listening={false}>
            {[0, 1, 2].map(b => (
              <Line
                key={`aurora-${b}`}
                ref={(el) => { auroraLineRefs.current[b] = el }}
                points={auroraBandPoints(b, 0, window.innerWidth, window.innerHeight)}
                stroke={b % 2 === 0 ? '#66ffcc' : '#8b7bff'}
                strokeWidth={52 - b * 8}
                opacity={0.045}
                lineCap="round"
                listening={false}
              />
            ))}
          </Layer>
        )}

        {/* ── Far twinkle layer (deepest, non-interactive) ── */}
        <Layer listening={false}>
          {(() => {
            const P = 0.45
            const vpW = window.innerWidth / (scale * P)
            const vpH = window.innerHeight / (scale * P)
            const wxMin = -camera.x / scale
            const wyMin = -camera.y / scale
            const tiles = getVisibleTiles(wxMin, wyMin, vpW, vpH, TWINKLE_TILE_SIZE)
            const totalTiles = tiles.length
            const perTileStars = Math.max(3, Math.min(40, Math.floor((1500 * densityMul) / totalTiles)))
            const t = reducedMotion ? 0 : performance.now() / 1000
            const starColorPalette = starColor === 'warm' ? { warm: '#bba080', cool: '#b8a080', neutral: '#b8a888' }
              : starColor === 'cool' ? { warm: '#8099bb', cool: '#6f8fb8', neutral: '#7f95b0' }
              : BG_TWINKLE_COLORS
            const elements = []
            for (const { tx, ty } of tiles) {
              for (let si = 0; si < perTileStars; si++) {
                const star = makeTwinkleStar(tx, ty, si, 'far')
                const wx = tx * TWINKLE_TILE_SIZE + star.x
                const wy = ty * TWINKLE_TILE_SIZE + star.y
                const sx = wx * scale * P + camera.x * P
                const sy = wy * scale * P + camera.y * P
                const twinkleAmt = star.twinkle ? Math.sin(t * star.speed * speedMul + star.phase) : 0
                const opacity = star.baseOp * (star.twinkle ? (0.6 + 0.4 * twinkleAmt) : 1)
                elements.push(
                  <Circle
                    key={`ft${tx},${ty},${si}`}
                    x={sx}
                    y={sy}
                    radius={star.r}
                    fill={starColorPalette[star.colorTemp]}
                    opacity={opacity}
                    listening={false}
                  />
                )
              }
            }
            return elements
          })()}
        </Layer>

        {/* Nebula dust clouds (Idea 21). Deep background atmosphere. */}
        {nebulaEnabled && <Layer listening={false}>
          {(() => {
            const P = 0.3
            const vpW = window.innerWidth / (scale * P)
            const vpH = window.innerHeight / (scale * P)
            const wxMin = -camera.x / scale
            const wyMin = -camera.y / scale
            const tiles = getVisibleTiles(wxMin, wyMin, vpW, vpH, NEBULA_TILE_SIZE)
            // Seasonal nebula hue from the ambient palette when present;
            // otherwise the theme's default cloud colors.
            const nebulaColors = palette.nebula
              ? [{ fill: palette.nebula, glow: palette.nebula }]
              : NEBULA_COLORS
            const elements = []
            for (const { tx, ty } of tiles) {
              for (let ci = 0; ci < NEBULA_PER_TILE; ci++) {
                const nebula = makeNebulaCloud(tx, ty, ci, nebulaColors)
                const wx = tx * NEBULA_TILE_SIZE + nebula.x
                const wy = ty * NEBULA_TILE_SIZE + nebula.y
                const sx = wx * scale * P + camera.x * P
                const sy = wy * scale * P + camera.y * P
                elements.push(
                  <Circle
                    key={`neb${tx},${ty},${ci}`}
                    x={sx}
                    y={sy}
                    radius={nebula.radius * scale * P}
                    fill={nebula.color.fill}
                    opacity={nebula.opacity}
                    listening={false}
                  />
                )
              }
            }
            return elements
          })()}
        </Layer>}

        {/* ── Near twinkle layer (mid-depth, non-interactive) ── */}
        <Layer listening={false}>
          {(() => {
            const P = 0.45
            const vpW = window.innerWidth / (scale * P)
            const vpH = window.innerHeight / (scale * P)
            const wxMin = -camera.x / scale
            const wyMin = -camera.y / scale
            const tiles = getVisibleTiles(wxMin, wyMin, vpW, vpH, TWINKLE_TILE_SIZE)
            const totalTiles = tiles.length
            const perTileStars = Math.max(3, Math.min(30, Math.floor((1200 * densityMul) / totalTiles)))
            const starColorPalette = starColor === 'warm' ? { warm: '#bba080', cool: '#b8a080', neutral: '#b8a888' }
              : starColor === 'cool' ? { warm: '#8099bb', cool: '#6f8fb8', neutral: '#7f95b0' }
              : BG_TWINKLE_COLORS
            const t = reducedMotion ? 0 : performance.now() / 1000
            const elements = []
            for (const { tx, ty } of tiles) {
              for (let si = 0; si < perTileStars; si++) {
                const star = makeTwinkleStar(tx, ty, si, 'near')
                const wx = tx * TWINKLE_TILE_SIZE + star.x
                const wy = ty * TWINKLE_TILE_SIZE + star.y
                const sx = wx * scale * P + camera.x * P
                const sy = wy * scale * P + camera.y * P
                const twinkleAmt = star.twinkle ? Math.sin(t * star.speed * speedMul + star.phase) : 0
                const opacity = star.baseOp * (star.twinkle ? (0.6 + 0.4 * twinkleAmt) : 1)
                elements.push(
                  <Circle
                    key={`nt${tx},${ty},${si}`}
                    x={sx}
                    y={sy}
                    radius={star.r}
                    fill={starColorPalette[star.colorTemp]}
                    opacity={opacity}
                    listening={false}
                  />
                )
              }
            }
            return elements
          })()}
        </Layer>

        {/* ── Foreground layer (note-stars, constellations, particles) ── */}
        <Layer>
          {/* Constellation lines. Draw-in animation for newly earned connections. */}
          {/* Deduplicate by pairId to prevent double-rendering from duplicate backend pairs */}
          {(() => {
            const seen = new Set()
            return links.map((link) => {
            const noteA = notes.find(n => n.id === link.note_a)
            const noteB = notes.find(n => n.id === link.note_b)
            if (!noteA || !noteB) return null
            const pairId = [link.note_a, link.note_b].sort().join('-')
            if (seen.has(pairId)) return null
            seen.add(pairId)
            const a = worldToScreen(posOf(noteA).x, posOf(noteA).y, 'fg')
            const b = worldToScreen(posOf(noteB).x, posOf(noteB).y, 'fg')
            const birthTime = trailBirth[pairId]
            let drawProgress = 1
            let lineOpacity = link.dimmed ? 0.08 : 0.2
            if (birthTime && !reducedMotion) {
              const elapsed = (Date.now() - birthTime) / 450 // 450ms draw-in
              drawProgress = Math.min(1, elapsed)
              // Smooth ease-out quad for natural feel
              drawProgress = 1 - (1 - drawProgress) * (1 - drawProgress)
              // Opacity fades in during the first half of the draw
              lineOpacity = Math.min(lineOpacity, drawProgress * (link.dimmed ? 0.08 : 0.2))
            }
            // ── Pulse on hover (Idea 1) ──────────────────────────────────
            // Connected lines brighten while hovering; fade back over 200ms on leave.
            const isPulseActive = hoveredStar && (
              link.note_a === hoveredStar || link.note_b === hoveredStar
            )
            const isFading = pulseFadeRef.current && (
              link.note_a === pulseFadeRef.current.starId ||
              link.note_b === pulseFadeRef.current.starId
            )
            if (isPulseActive && !reducedMotion && drawProgress >= 1) {
              lineOpacity = 0.6
            } else if (isFading && !reducedMotion) {
              const elapsed = Date.now() - pulseFadeRef.current.startTime
              const progress = Math.min(1, elapsed / 200)
              const fadeAmount = 1 - progress
              lineOpacity = 0.2 + (0.6 - 0.2) * fadeAmount
            }
            // LOD. Constellation lines fade in as user zooms past 0.5
            const lodLine = lodFactor(scale, LOD.constellation, LOD.constellation + 0.2)
            // Interpolate endpoint for the draw-in animation
            const endX = a.x + (b.x - a.x) * drawProgress
            const endY = a.y + (b.y - a.y) * drawProgress
            return (
              <Line
                key={`c-${pairId}`}
                name="constellation"
                points={[a.x, a.y, endX, endY]}
                stroke={palette.line}
                strokeWidth={1 * scale}
                opacity={lineOpacity * lodLine}
                tension={0.3}
                listening={false}
              />
            )
          })
          })()}

          {/* Star proximity hints (Idea 10). Skip hints that overlap with existing constellation lines. */}
          {hoveredStar && !reducedMotion && (() => {
            const note = notes.find(n => n.id === hoveredStar)
            if (!note) return null
            const hp = posOf(note)
            const constellationPairs = new Set()
            links.forEach(t => {
              if (t.note_a === hoveredStar || t.note_b === hoveredStar) {
                constellationPairs.add([t.note_a, t.note_b].sort().join('-'))
              }
            })
            const nearest = notes
              .filter(n => n.id !== hoveredStar)
              .map(n => {
                const np = posOf(n)
                return {
                  id: n.id,
                  dx: np.x - hp.x,
                  dy: np.y - hp.y,
                  hasLine: constellationPairs.has([hoveredStar, n.id].sort().join('-')),
                }
              })
              .sort((a, b) => (a.dx * a.dx + a.dy * a.dy) - (b.dx * b.dx + b.dy * b.dy))
              .filter(n => !n.hasLine)
              .slice(0, 3)
            const hs = worldToScreen(hp.x, hp.y, 'fg')
            return nearest.map(n => {
              const target = notes.find(nn => nn.id === n.id)
              if (!target) return null
              const ts = worldToScreen(posOf(target).x, posOf(target).y, 'fg')
              return (
                <Line
                  key={`prox-${hoveredStar}-${n.id}`}
                  points={[hs.x, hs.y, ts.x, ts.y]}
                  stroke={palette.line}
                  strokeWidth={0.5 * scale}
                  opacity={0.04}
                  dash={[4, 4]}
                  listening={false}
                />
              )
            })
          })()}

          {/* Note-stars */}
          {notes.map((note) => {
            const np = posOf(note)
            const s = worldToScreen(np.x, np.y, 'fg')
            const days = daysSinceVisit(note)
            // Color temperature evolution (Idea 7). Blend warm/cold based on visit recency.
            const warmth = warmthFromVisits(days)
            // Species remap: the blend endpoints come from the user's
            // override palette so custom colors tint every star.
            const sp = speciesPalette(skyPrefs)
            const noteColors = blendColors(
              { core: sp.cool, glow: sp.cool, accent: sp.cool },
              { core: sp.warm, glow: sp.warm, accent: sp.warm },
              warmth,
            )
            // Hub-star sizing (Idea 27): a note with many wikilinks grows
            // into a bigger star, accumulating with its outbound link count.
            const linkCount = note.link_count || 0
            const hubBoost = 1 + Math.min(2, linkCount) * 0.45
            const baseRadius = (STAGE_RADIUS[note.stage] || 4) * hubBoost
            const radius = baseRadius * scale
            const isSelected = selectedNote?.id === note.id
            const isHovered = hoveredStar === note.id
            const pulse = pulseMap[note.id]

            // Subtle slow twinkle for real note-stars (item 8)
            const t = reducedMotion ? 0 : performance.now() / 1000
            const notePhase = note.id.charCodeAt(0) * 0.37
            const shimmer = reducedMotion ? 0 : Math.sin(t * 0.15 + notePhase) * 0.08

            // Returning pulse brightness (item 12)
            let pulseBoost = 0
            if (pulse?.type === 'returning') {
              const elapsed = (Date.now() - pulse.start) / 1000
              const progress = Math.min(elapsed / 1.0, 1)
              pulseBoost = Math.sin(progress * Math.PI) * 0.4
            }

            // Stage-up flourish (item 13). Bright sparkle pulse.
            let stageUpBoost = 0
            if (pulse?.type === 'stageUp') {
              const elapsed = (Date.now() - pulse.start) / 1000
              if (elapsed < 1.5) {
                const progress = elapsed / 1.5
                stageUpBoost = Math.sin(progress * Math.PI * 3) * Math.max(0, 1 - progress) * 0.5
              }
            }

            // Wish glow (item 2). Brief soft brightness on every wish.
            let wishGlowBoost = 0
            if (pulse?.type === 'wishGlow') {
              const elapsed = (Date.now() - pulse.start) / 1000
              if (elapsed < 0.35) {
                const progress = elapsed / 0.35
                wishGlowBoost = Math.sin(progress * Math.PI) * 0.2
              }
            }

            // Arrival animation (item 4). Scale from 0, glow burst.
            const arrivalTime = arrivingStars[note.id]
            let arrivalScale = 1
            let arrivalGlow = 0
            if (arrivalTime && !reducedMotion) {
              const elapsed = (Date.now() - arrivalTime) / 500
              if (elapsed < 1) {
                const t01 = Math.min(1, elapsed / 0.6)
                arrivalScale = 1 - (1 - t01) * (1 - t01)
                arrivalGlow = Math.sin(elapsed * Math.PI) * 0.5
              }
            }

            // Departure animation (item 5). Shrink and fade.
            let departScale = 1
            let departOpacity = 1
            if (departingStar?.id === note.id) {
              const elapsed = (Date.now() - departingStar.start) / 400
              departScale = Math.max(0, 1 - elapsed)
              departOpacity = Math.max(0, 1 - elapsed)
            }

            // ── Hover glow expansion (Idea 4) ─────────────────────────────
            // Glow radius expands 1.2× on hover; brightness bumps +0.05.
            // Clean separation from press-scale: press affects Group scale, hover affects glow paths + opacity.
            const hoverBrighten = isHovered ? 0.05 : 0
            const hoverGlowScale = isHovered ? 1.2 : 1

            // ── Idle cursor awareness (Idea 8) ─────────────────────────────
            // Nearest star to idle cursor brightens subtly (+0.05 opacity, +10% glow).
            const isIdleTarget = idleStar === note.id && idleFade > 0 && !reducedMotion
            const idleBrighten = isIdleTarget ? 0.05 * idleFade : 0
            const idleGlowScale = isIdleTarget ? 1 + 0.1 * idleFade : 1

            // Dormant star dimming (Idea 6). Render-time only.
            // Stars not visited in 21+ days dim gradually. No stage regression.
            const dormancy = dormantDimming(days)

            const glowOpacity = Math.min(1, (0.12 + shimmer + pulseBoost + stageUpBoost + wishGlowBoost + arrivalGlow + hoverBrighten + idleBrighten) * dormancy)
            const coreOpacity = Math.min(1, (0.85 + shimmer + pulseBoost + stageUpBoost + wishGlowBoost + arrivalGlow + hoverBrighten + idleBrighten) * dormancy)

            // 4-point star path from StarIcon.jsx (viewBox 24×24, center 12,12, tip extends to 10 units)
            const starD = 'M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z'
            // Scale so star tip extends to `radius` (path tip is at distance 10 from center)
            const starScale = radius / 10

            return (
              <Group
                key={note.id}
                name="star"
                x={s.x}
                y={s.y}
                scaleX={(pressedStar === note.id ? tapScale : 1) * arrivalScale * departScale}
                scaleY={(pressedStar === note.id ? tapScale : 1) * arrivalScale * departScale}
                opacity={departOpacity}
                onClick={() => handleStarClick(note.id)}
                onMouseDown={(e) => {
                  // Left-drag reposition (Idea 27). Session-only physics:
                  // the pinned star follows the cursor and linked stars
                  // wobble behind it on springs, graph-view style.
                  if (e.evt.button === 0) {
                    // Stop the browser from moving keyboard focus to the
                    // canvas during the drag (the focus-collision bug).
                    e.evt.preventDefault()
                    // A previous drag may still be settling; cancel it
                    // so its stale loop cannot fight this new drag.
                    cancelStarSettle()
                    const memberIds = new Set([note.id])
                    const queue = [note.id]
                    while (queue.length) {
                      const cur = queue.shift()
                      links.forEach(l => {
                        if (l.note_a === cur && !memberIds.has(l.note_b)) { memberIds.add(l.note_b); queue.push(l.note_b) }
                        else if (l.note_b === cur && !memberIds.has(l.note_a)) { memberIds.add(l.note_a); queue.push(l.note_a) }
                      })
                    }
                    const pos = {}
                    const vel = {}
                    memberIds.forEach(id => {
                      const p = sessionPos && sessionPos[id]
                      const nn = notes.find(x => x.id === id)
                      pos[id] = { x: p ? p.x : (nn ? nn.world_x || 0 : 0), y: p ? p.y : (nn ? nn.world_y || 0 : 0) }
                      vel[id] = { x: 0, y: 0 }
                    })
                    const edges = links
                      .filter(l => memberIds.has(l.note_a) && memberIds.has(l.note_b))
                      .map(l => [l.note_a, l.note_b])
                    starDragRef.current = {
                      noteId: note.id,
                      clientX: e.evt.clientX,
                      clientY: e.evt.clientY,
                      startX: np.x,
                      startY: np.y,
                      pos, vel, edges,
                      pinned: note.id,
                      moved: false,
                    }
                    e.target.getStage().container().style.cursor = 'grabbing'
                    return
                  }
                  if (!reducedMotion) setPressedStar(note.id)
                }}
                onMouseUp={() => setPressedStar(null)}
                onMouseEnter={(e) => {
                  e.target.getStage().container().style.cursor = 'pointer'
                  pulseFadeRef.current = null // Cancel any pending fade
                  prevHoveredRef.current = note.id
                  setHoveredStar(note.id)
                }}
                onMouseLeave={(e) => {
                  e.target.getStage().container().style.cursor = 'default'
                  setHoveredStar(null)
                  setPressedStar(null)
                  schedulePulseFade()
                }}
                listening
              >
                {/* Outer glow halo. Soft bloom behind the star. */}
                <Path
                  data={starD}
                  scale={{ x: starScale * 2 * hoverGlowScale * idleGlowScale, y: starScale * 2 * hoverGlowScale * idleGlowScale }}
                  offsetX={12}
                  offsetY={12}
                  fill={noteColors.glow}
                  opacity={glowOpacity * 0.3}
                  shadowColor={noteColors.glow}
                  shadowBlur={radius * 0.8}
                />
                {/* Inner glow. Closer bloom. */}
                <Path
                  data={starD}
                  scale={{ x: starScale * 1.5 * hoverGlowScale * idleGlowScale, y: starScale * 1.5 * hoverGlowScale * idleGlowScale }}
                  offsetX={12}
                  offsetY={12}
                  fill={noteColors.glow}
                  opacity={glowOpacity * 0.5}
                  shadowColor={noteColors.glow}
                  shadowBlur={radius * 0.5}
                />
                {/* Star core. The 4-point shape. */}
                <Path
                  data={starD}
                  scale={{ x: starScale, y: starScale }}
                  offsetX={12}
                  offsetY={12}
                  fill={noteColors.core}
                  opacity={coreOpacity}
                  shadowColor={noteColors.accent}
                  shadowBlur={(isSelected ? 20 : isHovered ? 12 : 8) * scale}
                />
                {/* Bright center point */}
                <Circle
                  radius={Math.max(1, radius * 0.15)}
                  fill="#ffffff"
                  opacity={coreOpacity * 0.7}
                />

                {/* Title label. LOD: fades in past zoom 0.8. */}
                {(note.stage === 'steadystar' || note.stage === 'brightstar' || note.stage === 'brilliantstar') && (
                  <Text
                    y={radius + 10}
                    text={note.title}
                    fontSize={11 * scale}
                    fill={palette.text}
                    align="center"
                    offsetX={note.title.length * 2.7 * scale}
                    opacity={0.5 * lodFactor(scale, LOD.labels, LOD.labels + 0.2)}
                  />
                )}
                {/* Note body preview. LOD: shows brief excerpt past zoom 1.2. */}
                {scale > LOD.preview && note.body && (
                  <Text
                    y={radius + 24}
                    text={note.body.slice(0, 60).replace(/[#*_~`>\-]/g, '').trim() + (note.body.length > 60 ? '…' : '')}
                    fontSize={9 * scale}
                    fill={palette.text}
                    align="center"
                    opacity={0.3 * lodFactor(scale, LOD.preview, LOD.preview + 0.2)}
                    width={Math.min(180 * scale, window.innerWidth * 0.4)}
                  />
                )}
              </Group>
            )
          })}

          {/* Session trail (Idea 20). Ghost path connecting recently opened notes. */}
          {/* Skip segments that overlap with existing constellation lines to prevent visual doubling */}
          {sessionTrail.length >= 2 && !reducedMotion && (() => {
            const now = Date.now()
            // Build set of existing constellation pair IDs for fast lookup
            const constellationPairs = new Set()
            links.forEach(t => {
              constellationPairs.add([t.note_a, t.note_b].sort().join('-'))
            })
            // Build screen-space points from trail entries
            const points = sessionTrail.map(e => {
              const s = worldToScreen(e.x, e.y, 'fg')
              const age = (now - e.timestamp) / SESSION_TRAIL_MAX_AGE_MS // 0→1 as it ages
              const opacity = SESSION_TRAIL_MAX_OPACITY - (SESSION_TRAIL_MAX_OPACITY - SESSION_TRAIL_MIN_OPACITY) * age
              return { ...s, opacity: Math.max(0, opacity), id: e.id }
            })
            // Draw segments between consecutive points with per-segment opacity
            return points.slice(0, -1).map((p, i) => {
              const next = points[i + 1]
              const segOpacity = Math.min(p.opacity, next.opacity) // weakest link
              if (segOpacity < 0.01) return null
              // Skip if this segment overlaps with an existing constellation line
              const pairId = [p.id, next.id].sort().join('-')
              if (constellationPairs.has(pairId)) return null
              return (
                <Line
                  key={`trail-${i}`}
                  points={[p.x, p.y, next.x, next.y]}
                  stroke={palette.line}
                  strokeWidth={1.5 * scale}
                  opacity={segOpacity}
                  listening={false}
                />
              )
            })
          })()}

          {/* Stage crossing bursts (Idea 2). Localized shooting stars. */}
          {!reducedMotion && stageBursts.map(s => {
            const progress = s.life / s.maxLife
            const opacity = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8
            const dirX = Math.cos(s.angle)
            const dirY = Math.sin(s.angle)
            const sx = s.startX * scale + camera.x
            const sy = s.startY * scale + camera.y
            const headX = sx + dirX * s.speed * progress * 0.3
            const headY = sy + dirY * s.speed * progress * 0.3
            const tailX = headX - dirX * s.length
            const tailY = headY - dirY * s.length
            return (
              <Line
                key={s.id}
                points={[tailX, tailY, headX, headY]}
                stroke="#ffe8a0"
                strokeWidth={2.5 * scale}
                opacity={Math.max(0, opacity) * 0.9}
                shadowColor="#ffcc44"
                shadowBlur={14}
                listening={false}
              />
            )
          })}

          {/* Meteors (item 4) */}
          {!reducedMotion && meteorsRef.current.map(m => {
            const progress = m.life / m.maxLife
            const opacity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7
            const dirX = m.vx / m.speed
            const dirY = m.vy / m.speed
            const tailX = m.x - dirX * m.length
            const tailY = m.y - dirY * m.length
            return (
              <Line
                key={`m${m.id}`}
                points={[tailX, tailY, m.x, m.y]}
                stroke="#e0d0a0"
                strokeWidth={2}
                opacity={Math.max(0, opacity) * 0.8}
                shadowColor="#ffcc66"
                shadowBlur={8}
                listening={false}
              />
            )
          })}

          {/* Comets (item 5) */}
          {!reducedMotion && cometsRef.current.map(c => {
            const progress = c.life / c.maxLife
            const opacity = progress < 0.15 ? progress / 0.15
              : progress > 0.85 ? (1 - progress) / 0.15
              : 1
            const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy)
            const dirX = c.vx / speed
            const dirY = c.vy / speed
            // Multi-segment tail with gradient fade
            const segments = 6
            return (
              <Group key={`ct${c.id}`} listening={false}>
                {/* Head */}
                <Circle
                  x={c.x}
                  y={c.y}
                  radius={3}
                  fill="#e8e0d0"
                  opacity={Math.max(0, opacity)}
                  shadowColor="#aabbdd"
                  shadowBlur={12}
                />
                {/* Tail segments */}
                {Array.from({ length: segments }, (_, si) => {
                  const segFrac = (si + 1) / segments
                  const segX = c.x - dirX * c.tailLength * segFrac
                  const segY = c.y - dirY * c.tailLength * segFrac
                  const segOp = Math.max(0, opacity * (1 - segFrac) * 0.5)
                  return (
                    <Circle
                      key={`cts${c.id}-${si}`}
                      x={segX}
                      y={segY}
                      radius={2.5 * (1 - segFrac * 0.5)}
                      fill="#8899bb"
                      opacity={segOp}
                    />
                  )
                })}
              </Group>
            )
          })}
        </Layer>
      </Stage>

      {/* ── Vignette overlay (item 9) ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%)',
          zIndex: 5,
        }}
      />

      {/* ── Hover tooltip (item 11) ── */}
      {hoveredStar && (() => {
        const note = notes.find(n => n.id === hoveredStar)
        if (!note) return null
        const p = posOf(note)
        const s = worldToScreen(p.x, p.y, 'fg')
        return (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(s.x + 16, 10), window.innerWidth - 150),
              top: s.y - 28,
              pointerEvents: 'none',
              zIndex: 20,
              padding: '4px 10px',
              background: 'rgba(11, 15, 25, 0.85)',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: colors.text,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
              transition: `opacity ${motionTokens.duration.fast}s ${motionTokens.easing.smooth}`,
            }}
          >
            {note.title}
          </div>
        )
      })()}

      {/* ── Search overlay (Idea 18) ── */}
      {searchOpen && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 340,
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSearchIndex(i => Math.min(i + 1, searchResults.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSearchIndex(i => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && searchResults[searchIndex]) {
                e.preventDefault()
                handleSearchSelect(searchResults[searchIndex].note)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setSearchOpen(false)
                setSearchQuery('')
              }
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(11, 15, 25, 0.92)',
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 10,
              color: colors.text,
              fontSize: 14,
              fontWeight: 500,
              outline: 'none',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                marginTop: 4,
                background: 'rgba(11, 15, 25, 0.92)',
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                overflow: 'hidden',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              {searchResults.map((r, i) => (
                <button
                  key={r.note.id}
                  type="button"
                  onClick={() => handleSearchSelect(r.note)}
                  onMouseEnter={() => setSearchIndex(i)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 14px',
                    background: i === searchIndex ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: 400,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 120ms ease-out',
                  }}
                >
                  {r.note.title}
                </button>
              ))}
            </div>
          )}
          {searchQuery && searchResults.length === 0 && (
            <div
              style={{
                marginTop: 4,
                padding: '10px 14px',
                background: 'rgba(11, 15, 25, 0.92)',
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                color: colors.textMuted,
                fontSize: 13,
                textAlign: 'center',
                backdropFilter: 'blur(12px)',
              }}
            >
              No notes match "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* ── Overlays ── */}
      <AnimatePresence>
        {!editingNote && selectedNote && !showStats && (
          <NoteOverlay
            key="note-overlay"
            note={selectedNote}
            onEdit={(note) => { setEditingNote(note); setEditBody(note.body || '') }}
            onWish={onWish}
            onDelete={handleDeleteRequest}
            onClose={onCloseNote}
          />
        )}

        {editingNote && (
          <EditOverlay
            key="edit-overlay"
            note={editingNote}
            body={editBody}
            onBodyChange={setEditBody}
            onSave={handleSaveEdit}
            onAutoSave={handleAutoSave}
            onCancel={() => setEditingNote(null)}
            onDelete={(id) => { setEditingNote(null); handleDeleteRequest(id) }}
          />
        )}

        {showNewPrompt && (
          <NewNotePrompt
            key="new-note-prompt"
            title={newNoteTitle}
            onTitleChange={setNewNoteTitle}
            onSubmit={handleCreateSubmit}
            onCancel={() => setShowNewPrompt(false)}
          />
        )}
      </AnimatePresence>

      {/* Return to Home. Quiet top-left icon, section 16 click-first. */}
      {showHomeButton && (
        <button
          type="button"
          onClick={handleCloseConstellation}
          aria-label="Return home"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 15,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(11, 15, 25, 0.5)',
            border: `1px solid ${colors.border}`,
            borderRadius: '50%',
            cursor: 'pointer',
            padding: 0,
            transition: 'border-color 160ms ease-out, transform 160ms ease-out',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderStrong }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.transform = 'scale(1)' }}
          onMouseDown={(e) => { e.currentTarget.style.transform = `scale(${tapScale})` }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <HomeIcon size={16} color={colors.textMuted} />
        </button>
      )}
    </motion.div>
  )
}
