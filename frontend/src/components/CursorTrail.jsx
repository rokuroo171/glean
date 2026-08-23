/**
 * CursorTrail -- replaces the native text caret and draws a beam that
 * morphs into a smear on jumps.
 *
 * The native textarea caret cannot transform (the OS/webview draws it),
 * so when this component is enabled the native caret is hidden
 * (caret-color: transparent) and we draw our own:
 *
 * - At rest: a blinking beam (rounded, ~2px wide, full line height).
 * - On a caret jump (typing, arrows, clicks, undo/redo): instead of a
 *   long smear spanning the whole move, the caret itself flows -- the
 *   drawn position eases toward the new caret with a short tapered
 *   comet tail behind it that fades out in ~150ms. The head bulges
 *   into a soft drop while moving and settles back into a beam.
 *
 * Styles:
 * - beam (default): the fluid morphing caret above.
 * - sparkle: star particles emit at the old caret position and fade.
 * - ink: bezier stroke that follows the caret path and fades tail->head.
 */

import { useEffect, useRef } from 'react'
import { usePreferences } from '../lib/preferences-context'

const ACCENT_FALLBACK = '#5b9fd4'
const INTENSITY = { subtle: 0.6, normal: 1, vivid: 1.6 }
// The stretch band fires on ANY caret move (including per-character
// typing): typing right leaves `---o0|` behind the advancing head,
// typing left / backspace leaves `|0o---` behind. Only sub-pixel
// jitter and the starting plant are exempt.
const BAND_MIN = 1.2

// "beam" is the default trail style. Older prefs may still hold the
// previous mode name - alias it so saved settings survive.
function normalizeMode(m) {
  if (m === 'kitty') return 'beam'
  return m || 'beam'
}

export default function CursorTrail({ textareaRef, containerRef }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const posRef = useRef(null) // drawn caret position (eases toward target)
  const samplesRef = useRef([]) // recent drawn positions for the tail
  const targetRef = useRef(null)
  const jumpRef = useRef(null) // { fx, fy, at } origin of the current 0o---o0 band
  const lastMoveAtRef = useRef(0) // fade clock: refreshed on real movement
  const sparklesRef = useRef([])
  const inkPointsRef = useRef([])
  const focusRef = useRef(false)
  const prefsRef = useRef({})
  const colorRef = useRef(ACCENT_FALLBACK)

  const { prefs } = usePreferences()
  const ed = prefs.editor || {}

  // Live prefs + accent color for the RAF loop (no re-subscribing).
  prefsRef.current = ed
  colorRef.current = ed.cursor_trail_color === 'accent'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || ACCENT_FALLBACK)
    : (ed.cursor_trail_color || ACCENT_FALLBACK)

  const enabled = ed.cursor_trail_enabled !== false

  // Canvas sizing, devicePixelRatio aware.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef?.current
    if (!canvas || !container) return
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(container.offsetWidth * dpr))
      canvas.height = Math.max(1, Math.round(container.offsetHeight * dpr))
    }
    fit()
    const obs = new ResizeObserver(fit)
    obs.observe(container)
    return () => obs.disconnect()
  }, [containerRef, enabled])

  // Caret tracking. Always hides the native caret and draws our own
  // (the custom caret is always visible). Trail effects inside measure
  // are gated on `enabled`.
  useEffect(() => {
    const ta = textareaRef?.current
    if (!ta) return

    // Always draw our own caret.
    const onFocus = () => { focusRef.current = true }
    const onBlur = () => { focusRef.current = false }
    ta.style.caretColor = 'transparent'
    ta.addEventListener('focus', onFocus)
    ta.addEventListener('blur', onBlur)

    const spawnSparkles = (from, dist, mul) => {
      const count = Math.round((4 + Math.min(dist / 40, 6)) * mul)
      const halfH = (from.h || 22) / 2
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.6 + Math.random() * 2.2
        sparklesRef.current.push({
          x: from.x + (Math.random() - 0.5) * 8,
          y: from.y + halfH + (Math.random() - 0.5) * 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.5 + Math.random() * 3.5,
          maxA: (0.5 + Math.random() * 0.5) * mul,
          born: performance.now(),
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.08,
        })
      }
      const cap = 140
      if (sparklesRef.current.length > cap) {
        sparklesRef.current.splice(0, sparklesRef.current.length - cap)
      }
    }

    const measure = (fromScroll) => {
      const pos = getCursorPixelPos(ta, containerRef?.current)
      if (!pos) return
      const e = prefsRef.current || {}
      const threshold = e.cursor_trail_start_threshold ?? 4
      const mode = normalizeMode(e.cursor_trail_mode)
      const prev = targetRef.current
      if (!prev) {
        // First position: plant the drawn position and target.
        posRef.current = { ...pos }
        targetRef.current = pos
        lastMoveAtRef.current = performance.now()
        return
      }
      const dist = Math.hypot(pos.x - prev.x, pos.y - prev.y)
      if (dist <= 0.5) return // jitter: ignore entirely
      // The caret is always chased, so it flows to the new position
      // even between big jumps; every real move (however small)
      // refreshes the fade clock so the trail stays alive while typing.
      // The threshold only gates the 0o---o0 band and bursts.
      targetRef.current = pos
      // Scroll re-measures move the caret with the text but are not
      // caret jumps: no stretch band, no burst. The band also needs a
      // real jump distance (BAND_MIN) so per-keystroke typing stays a
      // quiet fluid follow instead of a smear over the characters.
      if (!fromScroll && dist > Math.max(threshold, BAND_MIN)) {
        // The stretch band: from the PREVIOUS caret position to this
        // new one, both captured as fixed points so the ghost persists
        // after the caret lands (typing right leaves `---o0|` behind).
        jumpRef.current = { fx: prev.x, fy: prev.y + (prev.h || 0) / 2, tx: pos.x, ty: pos.y + (pos.h || 0) / 2, fh: (prev.h || 22) / 2, th: (pos.h || 22) / 2, t: performance.now(), dist }
        if (mode === 'beam') { inkPointsRef.current.length = 0; sparklesRef.current.length = 0; samplesRef.current.length = 0 }
        if (mode === 'sparkle') { inkPointsRef.current.length = 0; samplesRef.current.length = 0 }
        if (mode === 'ink') { samplesRef.current.length = 0; sparklesRef.current.length = 0 }
      }
      lastMoveAtRef.current = performance.now()
      // Trail effects only when the toggle is on.
      if (enabled) {
        if (mode === 'ink' && !fromScroll && dist > 1) {
          inkPointsRef.current.push({ x: pos.x, y: pos.y + (pos.h || 22) / 2, t: performance.now() })
        }
        if (!fromScroll && dist > threshold && mode === 'sparkle') {
          spawnSparkles(prev, dist, INTENSITY[e.cursor_trail_intensity] || 1)
        }
      }
    }

    const onScroll = () => measure(true)

    const onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        setTimeout(measure, 0)
      }
    }

    ta.addEventListener('keydown', onKeyDown)
    ta.addEventListener('keyup', () => measure(false))
    ta.addEventListener('input', () => measure(false))
    ta.addEventListener('click', () => measure(false))
    ta.addEventListener('focus', () => measure(false))
    ta.addEventListener('scroll', onScroll)
    // In single-edit mode the WRAPPER is the scrollable (the textarea is
    // height:100% and never scrolls), so listen for its scroll in the
    // capture phase too - scroll events don't bubble.
    const containerNode = containerRef?.current
    if (containerNode) containerNode.addEventListener('scroll', onScroll, true)
    return () => {
      ta.style.caretColor = ''
      ta.removeEventListener('focus', onFocus)
      ta.removeEventListener('blur', onBlur)
      ta.removeEventListener('keydown', onKeyDown)
      ta.removeEventListener('keyup', () => measure(false))
      ta.removeEventListener('input', () => measure(false))
      ta.removeEventListener('click', () => measure(false))
      ta.removeEventListener('focus', () => measure(false))
      ta.removeEventListener('scroll', onScroll)
      if (containerNode) containerNode.removeEventListener('scroll', onScroll, true)
    }
  }, [textareaRef])

  // Animation loop. Always runs (custom caret is always visible).
  // Trail effects are gated on `enabled` inside the frame.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let running = true
    let last = performance.now()
    let lastFrame = 0

    const frame = (now) => {
      if (!running) return
      lastFrame = now
      const dt = Math.min(now - last, 50)
      last = now
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

      const e = prefsRef.current || {}
      const mode = normalizeMode(e.cursor_trail_mode)
      const mul = INTENSITY[e.cursor_trail_intensity] || 1
      const fast = e.cursor_trail_decay_fast || 80
      const slow = e.cursor_trail_decay_slow || 300
      const length = e.cursor_trail_length || 12
      const rgb = parseHex(colorRef.current)
      const target = targetRef.current

      // Ease the drawn position toward the real caret for ALL modes,
      // not just beam - otherwise sparkle/ink leave the caret stuck
      // at its initial plant position.
      const pos = posRef.current
      if (pos && target) {
        const k = 1 - Math.pow(2, (-10 * dt) / 70)
        pos.x += (target.x - pos.x) * k
        pos.y += (target.y - pos.y) * k
      }

      // Trail effects only fire when the toggle is on.
      if (enabled) {
        if (mode === 'beam') {
          drawBeam(ctx, now, dt, { fast, slow, length, mul, rgb },
            { targetRef, posRef, samplesRef, jumpRef })
        } else if (mode === 'sparkle') {
          drawSparkles(ctx, now, { fast, slow, mul, rgb }, sparklesRef)
        } else if (mode === 'ink') {
          drawInk(ctx, now, { fast, slow, length, mul, rgb }, inkPointsRef)
        }
      }

      // The caret always draws when a target exists. No focus gating:
      // a lost-focus blip must never make the caret vanish, and the
      // trail position rides the eased head so it flows, not teleports.
      if (target) {
        const drawn = posRef.current || target
        // Slight dim when the window is unfocused, never hidden.
        const dim = document.hasFocus() || focusRef.current ? 1 : 0.45
        drawCaret(ctx, now, drawn, now - lastMoveAtRef.current, rgb, dim)
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    // Some environments throttle rAF while the window is occluded or the
    // compositor is offscreen, which would freeze the caret. A watchdog
    // keeps the loop stepping (at least ~10fps) until rAF recovers.
    const watchdog = setInterval(() => {
      const now = performance.now()
      if (running && now - lastFrame > 120) frame(now)
    }, 100)

    return () => {
      running = false
      clearInterval(watchdog)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [enabled])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    />
  )
}

// --- beam (default fluid morphing-caret) engine ---

function drawBeam(ctx, now, dt, p, refs) {
  const { targetRef, posRef, samplesRef, jumpRef } = refs
  const target = targetRef.current
  const pos = posRef.current
  if (!target || !pos) return

  // The animation loop eases posRef toward target for all modes.
  // Here we only read the distance for band/tail decisions.
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.hypot(dx, dy)

  // The 0o---o0 stretch band: a PERSISTENT ghost from the previous
  // caret to the new caret, fading purely on age (not on the head's
  // travel), so after the caret lands the dash still reads. Typing
  // right leaves `---o0|` tail-left; typing left / backspace leaves
  // `|0o---`. The head bump stays at the landing end until it fades.
  const jmp = jumpRef?.current
  if (jmp) {
    const age = now - jmp.t
    const BT = 220
    if (age > BT) {
      jumpRef.current = null
      ctx.globalAlpha = 1
    } else {
      const fade = Math.exp(-age / 85)
      // Comet taper: NOTHING at the old caret (t=0), FAT at the
      // landing caret (t=1). The shape is a teardrop/comet, not a
      // symmetric 0o---o0 double-bump.
      const headW = (jmp.th || 9) * p.mul * Math.min(1, age / 30)
      const pts = []
      const N = 10
      for (let s = 0; s <= N; s++) {
        const t = s / N
        const w = headW * t * t
        pts.push({ x: jmp.fx + (jmp.tx - jmp.fx) * t, y: jmp.fy + (jmp.ty - jmp.fy) * t, w, a: fade * (0.2 + 0.8 * t) })
      }
      drawRibbon(ctx, pts, p.rgb, 1, 1)
      ctx.globalAlpha = 1
      // The band IS the trail for this move: skip the samples tail while
      // it lives so the two never compete. The head itself still eases
      // and is drawn on top by the caller's drawCaret.
      return
    }
  }

  // Sample the head's actual path. The tail is capped to a short fixed
  // distance behind the head so a far teleport reads as a head sweeping
  // to the target, never a long streak spanning the whole jump.
  if (dist > 1.2) {
    samplesRef.current.push({ x: pos.x, y: pos.y, t: now })
  }
  const tailLen = Math.max(24, Math.min(60, p.length * 3))
  const list = samplesRef.current
  if (list.length > 1) {
    while (list.length > 2 && Math.hypot(list[1].x - pos.x, list[1].y - pos.y) > tailLen) {
      list.shift()
    }
  }
  // Age cap, then cull anything still beyond the tail cap.
  const maxAge = Math.max(80, p.slow * 0.8)
  while (list.length > 0 && now - list[0].t > maxAge) list.shift()
  while (list.length > 0 && Math.hypot(list[0].x - pos.x, list[0].y - pos.y) > tailLen * 1.5) list.shift()
  if (list.length < 1) {
    // Nothing to draw yet: rest state is the beam drawn by drawCaret.
    ctx.globalAlpha = 1
    return
  }

  // Tapered tail, centered vertically on the caret line: reads as
  // the caret stretching, never a blob or flag.
  const ttl = Math.max(70, Math.min(110, p.fast * 1.2))
  const halfH = (pos.h || 22) / 2
  const headW = 3.5 * p.mul
  const all = [...list, { x: pos.x, y: pos.y, t: now }]
  const pts = []
  for (let i = 0; i < all.length; i++) {
    const s = all[i]
    const t = i / (all.length - 1 || 1)
    const d = Math.hypot(s.x - pos.x, s.y - pos.y)
    const age = now - s.t
    const fade = 0.55 * Math.exp(-age / ttl) + 0.45 * (1 - d / (tailLen * 1.5))
    const w = 2.2 * p.mul + (headW - 2.2 * p.mul) * Math.pow(t, 0.7)
    pts.push({ x: s.x, y: s.y + halfH, w, a: 0.9 * p.mul * fade })
  }
  pts.push({ x: pos.x, y: pos.y + halfH, w: headW, a: 0.95 * p.mul })
  drawRibbon(ctx, pts, p.rgb, 1, 1)
  ctx.globalAlpha = 1
}

// The line at rest: a chunky rounded beam that blinks like the native
// one (it is solid briefly after a movement, then a normal ~1s on/off
// blink).
function drawCaret(ctx, now, target, elapsed, rgb, dim) {
  const h = target.h || 22
  const w = Math.max(1.8, 2.2)
  // Always solid (no blink) so it's capturable; dims slightly when the
  // window is unfocused instead of disappearing.
  ctx.globalAlpha = 0.9 * (dim == null ? 1 : dim)
  ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`
  ctx.lineCap = 'round'
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(target.x - w / 2, target.y)
  ctx.lineTo(target.x - w / 2, target.y + h)
  ctx.stroke()
  ctx.globalAlpha = 1
}

// Fill the ribbon as per-segment quads so width and alpha can vary along
// the path smoothly (fatter at the caret ends, thinner in the middle).
function drawRibbon(ctx, pts, rgb, widthScale, alphaScale) {
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const len = Math.hypot(dx, dy)
    if (len < 0.01) continue
    const nx = -dy / len
    const ny = dx / len
    const w0 = p0.w * widthScale
    const w1 = p1.w * widthScale
    const a = Math.max(0, Math.min(1, p1.a * alphaScale))
    if (a < 0.004) continue
    ctx.globalAlpha = a
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`
    ctx.beginPath()
    ctx.moveTo(p0.x + nx * w0, p0.y + ny * w0)
    ctx.lineTo(p1.x + nx * w1, p1.y + ny * w1)
    ctx.lineTo(p1.x - nx * w1, p1.y - ny * w1)
    ctx.lineTo(p0.x - nx * w0, p0.y - ny * w0)
    ctx.closePath()
    ctx.fill()
  }
}

function drawSparkles(ctx, now, p, sparklesRef) {
  const list = sparklesRef.current
  for (let i = list.length - 1; i >= 0; i--) {
    const sp = list[i]
    const age = now - sp.born
    if (age > p.slow * 3) { list.splice(i, 1); continue }
    sp.x += sp.vx
    sp.y += sp.vy
    sp.vx *= 0.96
    sp.vy *= 0.96
    sp.rotation += sp.rotSpeed

    // Two-stage fade: fast initial pop, slower tail.
    const a = sp.maxA * (0.5 * Math.exp(-age / p.fast) + 0.5 * Math.exp(-age / p.slow))
    if (a < 0.004) { list.splice(i, 1); continue }
    const sz = sp.size * (0.3 + Math.exp(-age / (p.slow * 0.6)) * 0.7)

    ctx.save()
    ctx.globalAlpha = Math.min(1, a)
    ctx.translate(sp.x, sp.y)
    ctx.rotate(sp.rotation)

    ctx.shadowColor = `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},0.8)`
    ctx.shadowBlur = 8 * p.mul

    // 4-pointed star.
    ctx.beginPath()
    for (let j = 0; j < 4; j++) {
      const ang = (j * Math.PI) / 2
      const outerR = sz
      const midR = sz * 0.55
      const angMid = ang + Math.PI / 4
      if (j === 0) ctx.moveTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
      else ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
      ctx.lineTo(Math.cos(angMid) * midR, Math.sin(angMid) * midR)
      ctx.lineTo(Math.cos(ang + Math.PI / 2) * outerR, Math.sin(ang + Math.PI / 2) * outerR)
    }
    ctx.closePath()

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz)
    grad.addColorStop(0, `rgba(${Math.min(255, p.rgb.r + 80)},${Math.min(255, p.rgb.g + 80)},${Math.min(255, p.rgb.b + 80)},1)`)
    grad.addColorStop(0.5, `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},0.8)`)
    grad.addColorStop(1, `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},0)`)
    ctx.fillStyle = grad
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(0, 0, sz * 0.15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()

    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawInk(ctx, now, p, inkPointsRef) {
  const pts = inkPointsRef.current
  if (pts.length < 2) return

  // Duration scales with intensity: subtle = short, vivid = long.
  const maxAge = p.slow * (1.5 + p.mul * 1.5)
  while (pts.length > 0 && now - pts[0].t > maxAge) pts.shift()
  const cap = Math.max(16, p.length * 8)
  if (pts.length > cap) pts.splice(0, pts.length - cap)
  if (pts.length < 2) return

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = `rgba(${p.rgb.r},${p.rgb.g},${p.rgb.b},0.3)`
  ctx.shadowBlur = 2

  // Pre-compute speed for each point (inverse of time gap).
  // Slow moves = thick, fast moves = thin.
  const speeds = []
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { speeds.push(0); continue }
    const dt = Math.max(1, pts[i].t - pts[i - 1].t)
    const dd = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    speeds.push(dd / dt) // px/ms
  }

  // Smooth the speeds so width transitions aren't jarring.
  const smooth = []
  for (let i = 0; i < speeds.length; i++) {
    const prev = speeds[Math.max(0, i - 1)]
    const curr = speeds[i]
    const next = speeds[Math.min(speeds.length - 1, i + 1)]
    smooth.push((prev + curr * 2 + next) / 4)
  }

  // Map speed to width: slow (0 px/ms) = thick, fast (>0.5 px/ms) = thin.
  const THIN = 0.6 * p.mul
  const THICK = 4.5 * p.mul
  const SPEED_RANGE = 0.5

  // Draw as a single continuous bezier stroke with varying width.
  // Use cubic bezier segments for smoother curves than quadratic.
  ctx.beginPath()
  let started = false
  let lastW = THIN

  for (let i = 0; i < pts.length; i++) {
    const age = now - pts[i].t
    const a = 0.85 * p.mul * (0.4 * Math.exp(-age / p.fast) + 0.6 * Math.exp(-age / p.slow))
    if (a < 0.004) continue

    const spd = Math.min(1, smooth[i] / SPEED_RANGE)
    const w = THICK + (THIN - THICK) * spd
    const alpha = Math.min(1, a)

    if (!started) {
      ctx.moveTo(pts[i].x, pts[i].y)
      started = true
      lastW = w
      continue
    }

    // Cubic bezier tension: control points pull toward the midpoint
    // for smoother curves than raw quadratic.
    const prev = pts[i - 1]
    const curr = pts[i]
    const tension = 0.35
    const mx = (prev.x + curr.x) / 2
    const my = (prev.y + curr.y) / 2

    // Draw segment with interpolated width (average of prev and curr).
    const segW = (lastW + w) / 2
    ctx.globalAlpha = alpha
    ctx.strokeStyle = `rgb(${p.rgb.r},${p.rgb.g},${p.rgb.b})`
    ctx.lineWidth = segW
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.quadraticCurveTo(
      prev.x + (mx - prev.x) * tension + (prev.x - mx) * 0,
      prev.y + (my - prev.y) * tension + (prev.y - my) * 0,
      mx, my
    )
    ctx.quadraticCurveTo(
      curr.x + (mx - curr.x) * tension,
      curr.y + (my - curr.y) * tension,
      curr.x, curr.y
    )
    ctx.stroke()

    lastW = w
  }

  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

// --- utilities ---

// Real caret geometry: mirror the textarea's text into a hidden div with
// identical styles and read the caret marker's actual layout position.
// This is exact under line wrapping, fonts, word-break, tabs, etc. -
// no character-width estimation that drifts on wrapped paragraphs.
// Find the nearest scrollable ANCESTOR of the textarea (skip the
// textarea itself - a mirror can't live inside one). The mirror must
// LIVE inside the scroller so its marker moves with the text.
function findScroller(el) {
  let n = el.parentElement
  while (n && n !== document.body) {
    const cs = getComputedStyle(n)
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) {
      return n
    }
    n = n.parentElement
  }
  return el.parentElement || el
}

function getCursorPixelPos(ta, container) {
  if (!ta || !container) return null
  const s = getComputedStyle(ta)
  const fs = parseFloat(s.fontSize) || 14
  const lh = parseFloat(s.lineHeight) || fs * 1.6
  const pl = parseFloat(s.paddingLeft) || 0
  const pr = parseFloat(s.paddingRight) || 0

  // The scroller is where the text lives: the textarea itself (split
  // mode) or a scrollable ancestor wrapper (single-edit mode). The
  // mirror must be inside it so it scrolls with the text.
  const scroller = findScroller(ta)

  // The mirror must align to the TEXTAREA's text box, not the scroller's
  // padding: in single-edit mode the textarea sits inside the scrollable
  // wrapper with its own padding, so the text starts scroller-padding +
  // textarea-padding. Compute the textarea's offset relative to the
  // scroller and offset the mirror by that plus the textarea's padding.
  const trect = ta.getBoundingClientRect()
  const srect = scroller.getBoundingClientRect()
  const mLeft = trect.left - srect.left + (parseFloat(getComputedStyle(ta).paddingLeft) || 0)
  const mTop = trect.top - srect.top + (parseFloat(getComputedStyle(ta).paddingTop) || 0)

  let mirror = ta._gleanMirror
  if (mirror && mirror._c !== scroller) {
    mirror.remove()
    mirror = null
  }
  if (!mirror) {
    mirror = document.createElement('div')
    mirror._c = scroller
    Object.assign(mirror.style, {
      position: 'absolute',
      left: mLeft + 'px',
      top: mTop + 'px',
      width: Math.max(1, ta.clientWidth - pl - pr) + 'px',
      height: 'auto',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontStyle: s.fontStyle,
      fontWeight: s.fontWeight,
      letterSpacing: s.letterSpacing,
      lineHeight: s.lineHeight,
      tabSize: s.tabSize,
    })
    scroller.appendChild(mirror)
    ta._gleanMirror = mirror
  } else {
    mirror.style.width = Math.max(1, ta.clientWidth - pl - pr) + 'px'
    // Recompute offsets on every measure: the scroller can move between
    // measures (resize, split mode toggle).
    mirror.style.left = mLeft + 'px'
    mirror.style.top = mTop + 'px'
  }

  const sel = ta.selectionEnd ?? ta.selectionStart ?? 0
  mirror.textContent = ta.value.slice(0, sel)
  const marker = document.createElement('span')
  mirror.appendChild(marker)

  // Viewport-relative rects: if the WRAPPER scrolls (single-edit mode),
  // the mirror lives inside it and its marker rect already reflects the
  // scroll. If the TEXTAREA scrolls (split mode), the mirror is a fixed
  // sibling so the textarea's own scroll must be subtracted. This
  // covers both: subtract ta.scroll* (0 when the wrapper scrolls).
  const m = marker.getBoundingClientRect()
  const cv = container.getBoundingClientRect()
  return {
    x: m.left - cv.left - (ta.scrollLeft || 0),
    y: m.top - cv.top - (ta.scrollTop || 0),
    h: lh,
    w: fs * 0.6,
  }
}

function parseHex(hex) {
  const h = (hex || ACCENT_FALLBACK).replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16) || 91,
    g: parseInt(h.slice(2, 4), 16) || 159,
    b: parseInt(h.slice(4, 6), 16) || 212,
  }
}