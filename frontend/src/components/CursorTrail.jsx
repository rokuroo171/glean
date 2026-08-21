/**
 * CursorTrail renders a canvas overlay on top of a textarea with three
 * animated cursor trail effects:
 *
 * - kitty:  A single morphing blob that stretches from the old cursor
 *           position to the new one with organic wobble, then settles
 *           back into a thin beam. Inspired by Kitty terminal.
 * - sparkle: Glowing star particles that emit and drift outward.
 * - ink:     Smooth bezier brush stroke that follows the cursor and fades.
 */

// Work In Progress!
import { useEffect, useRef, useCallback } from 'react'
import { usePreferences } from '../lib/preferences-context'
export default function CursorTrail({ textareaRef, containerRef }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const prevPos = useRef(null)
  const blobs = useRef([])
  const sparkles = useRef([])
  const inkStroke = useRef({ points: [], active: false })
  const { prefs } = usePreferences()

  const enabled = prefs.editor.cursor_trail_enabled !== false
  const mode = prefs.editor.cursor_trail_mode
  const intensity = prefs.editor.cursor_trail_intensity
  const trailColor =
    prefs.editor.cursor_trail_color === 'accent'
      ? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b9fd4'
      : prefs.editor.cursor_trail_color

  const intensityMap = { subtle: 0.6, normal: 1, vivid: 1.6 }
  const mul = intensityMap[intensity] || 1

  // --- helpers ---

  /** Convert textarea selection to pixel coordinates */
  const getCursorPixelPos = useCallback(() => {
    const ta = textareaRef?.current
    if (!ta) return null
    const pos = ta.selectionStart
    const text = ta.value.slice(0, pos)
    const lines = text.split('\n')
    const lineIdx = lines.length - 1
    const colIdx = lines[lineIdx].length

    const s = getComputedStyle(ta)
    const fs = parseFloat(s.fontSize) || 14
    const lh = parseFloat(s.lineHeight) || fs * 1.6
    const pl = parseFloat(s.paddingLeft) || 24
    const pt = parseFloat(s.paddingTop) || 24
    const cw = fs * 0.6 // approx monospace char width

    return { x: pl + colIdx * cw, y: pt + lineIdx * lh - ta.scrollTop }
  }, [textareaRef])

  /** Parse trail color to {r,g,b} */
  const colorRGB = (() => {
    const hex = trailColor.replace('#', '')
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  })()

  // resize canvas

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef?.current
    if (!canvas || !container) return
    const obs = new ResizeObserver(() => {
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [containerRef])

  // cursor tracking

  useEffect(() => {
    const ta = textareaRef?.current
    if (!ta) return

    function onMove() {
      const pos = getCursorPixelPos()
      if (!pos) return
      if (prevPos.current) {
        const dx = pos.x - prevPos.current.x
        const dy = pos.y - prevPos.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 2) {
          if (mode === 'kitty') spawnBlob(prevPos.current, pos, dist)
          else if (mode === 'sparkle') spawnSparkles(prevPos.current, dist)
          else if (mode === 'ink') inkStroke.current.points.push({ ...pos, t: 1 })
        }
      }
      prevPos.current = pos
    }

    ta.addEventListener('keyup', onMove)
    ta.addEventListener('click', onMove)
    const onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key))
        setTimeout(onMove, 0)
    }
    ta.addEventListener('keydown', onKeyDown)
    return () => {
      ta.removeEventListener('keyup', onMove)
      ta.removeEventListener('click', onMove)
      ta.removeEventListener('keydown', onKeyDown)
    }
  }, [textareaRef, getCursorPixelPos, mode])

  // kitty blob spawner

  function spawnBlob(from, to, dist) {
    blobs.current.push({
      // start at from, animate toward to
      sx: from.x, sy: from.y,
      tx: to.x, ty: to.y,
      // wobble control points (offsets from center, relative)
      wobble: Array.from({ length: 8 }, () => ({
        angle: Math.random() * Math.PI * 2,
        amp: 2 + Math.random() * 4, // max wobble amplitude
        freq: 3 + Math.random() * 4, // oscillation speed
        phase: Math.random() * Math.PI * 2,
      })),
      progress: 0,
      speed: 0.035 + Math.min(dist / 800, 0.02), // travel speed (fraction per frame)
      alpha: 0.7 * mul,
      life: 1,
      // beam settle: after arriving, morph into thin vertical line
      settling: false,
      settleProgress: 0,
      color: colorRGB,
    })
    // cap active blobs
    if (blobs.current.length > 6) blobs.current.shift()
  }

  // sparkle spawner

  function spawnSparkles(pos, dist) {
    const count = Math.floor(5 + Math.min(dist / 30, 8)) * mul
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 2.5
      sparkles.current.push({
        x: pos.x + (Math.random() - 0.5) * 8,
        y: pos.y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3.5,
        alpha: (0.6 + Math.random() * 0.4) * mul,
        life: 1,
        decay: 0.012 + Math.random() * 0.008,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        color: colorRGB,
      })
    }
    if (sparkles.current.length > 120) sparkles.current.splice(0, sparkles.current.length - 120)
  }

  // animation loop

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let running = true

    function frame() {
      if (!running) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // draw kitty blobs
      for (let i = blobs.current.length - 1; i >= 0; i--) {
        const b = blobs.current[i]

        if (!b.settling) {
          // Travel phase: interpolate position
          b.progress = Math.min(1, b.progress + b.speed)
          const t = easeOutCubic(b.progress)
          const cx = b.sx + (b.tx - b.sx) * t
          const cy = b.sy + (b.ty - b.sy) * t

          if (b.progress >= 1) {
            b.settling = true
            b.cx = b.tx
            b.cy = b.ty
          } else {
            // Draw wobbly blob
            const time = performance.now() / 1000
            const baseRadius = (5 + Math.min(Math.sqrt((b.tx - b.sx) ** 2 + (b.ty - b.sy) ** 2) * 0.06, 10)) * mul
            // Stretch along travel direction
            const angle = Math.atan2(b.ty - b.sy, b.tx - b.sx)
            const stretch = 1 + (1 - b.progress) * 1.2

            ctx.save()
            ctx.globalAlpha = b.alpha * (0.5 + b.progress * 0.5)
            ctx.translate(cx, cy)
            ctx.rotate(angle)

            // Draw organic blob using wobble control points
            ctx.beginPath()
            const segments = 48
            for (let s = 0; s <= segments; s++) {
              const a = (s / segments) * Math.PI * 2
              let r = baseRadius
              // Apply wobble from each control point
              for (const w of b.wobble) {
                r += Math.sin(a * w.freq + time * w.freq + w.phase) * w.amp * (1 - b.progress * 0.5)
              }
              // Stretch along travel axis
              const rx = r * stretch
              const ry = r / stretch
              const px = Math.cos(a) * rx
              const py = Math.sin(a) * ry
              if (s === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            }
            ctx.closePath()

            // Glow fill
            const { r: cr, g: cg, b: cb } = b.color
            ctx.shadowColor = `rgba(${cr},${cg},${cb},0.6)`
            ctx.shadowBlur = 12 * mul
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.85)`
            ctx.fill()
            // Inner bright core
            ctx.shadowBlur = 0
            ctx.fillStyle = `rgba(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)},0.4)`
            ctx.fill()
            ctx.restore()
          }
        }

        if (b.settling) {
          // Settle phase: morph from blob into thin vertical beam
          b.settleProgress = Math.min(1, b.settleProgress + 0.06)
          const t = easeOutCubic(b.settleProgress)
          const alpha = b.alpha * (1 - t * 0.8)

          if (b.settleProgress >= 1) {
            blobs.current.splice(i, 1)
            continue
          }

          const { r: cr, g: cg, b: cb } = b.color
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.translate(b.cx, b.cy)

          // Morphing: wide blob -> thin vertical line
          const blobWidth = 10 * mul * (1 - t)
          const blobHeight = 10 * mul * (1 - t) + 14 * t // grow into beam height
          const beamWidth = 1.5 * t

          // Draw as rounded rect that narrows
          const w = Math.max(beamWidth, blobWidth)
          const h = blobHeight
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`
          ctx.shadowColor = `rgba(${cr},${cg},${cb},0.4)`
          ctx.shadowBlur = 6 * (1 - t)
          roundRect(ctx, -w / 2, -h / 2, w, h, w / 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // draw sparkles
      for (let i = sparkles.current.length - 1; i >= 0; i--) {
        const p = sparkles.current[i]
        p.life -= p.decay
        if (p.life <= 0) { sparkles.current.splice(i, 1); continue }

        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.vy += 0.02 // slight gravity
        p.rotation += p.rotSpeed

        const a = p.alpha * p.life
        const sz = p.size * (0.3 + p.life * 0.7)
        const { r: cr, g: cg, b: cb } = p.color

        ctx.save()
        ctx.globalAlpha = a
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)

        // Glow halo
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.8)`
        ctx.shadowBlur = 8 * mul

        // 4-pointed star
        ctx.beginPath()
        for (let j = 0; j < 4; j++) {
          const ang = (j * Math.PI) / 2
          const outerR = sz
          const innerR = sz * 0.25
          const midR = sz * 0.55
          const angMid = ang + Math.PI / 4

          if (j === 0) ctx.moveTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
          else ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
          ctx.lineTo(Math.cos(angMid) * midR, Math.sin(angMid) * midR)
          ctx.lineTo(Math.cos(ang + Math.PI / 2) * outerR, Math.sin(ang + Math.PI / 2) * outerR)
        }
        ctx.closePath()

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz)
        grad.addColorStop(0, `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 80)},${Math.min(255, cb + 80)},1)`)
        grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.8)`)
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.fillStyle = grad
        ctx.fill()

        // Bright center dot
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.arc(0, 0, sz * 0.15, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,0.9)`
        ctx.fill()

        ctx.restore()
      }

      // draw ink stroke
      const pts = inkStroke.current.points
      if (pts.length > 1) {
        // Decay old points
        for (let i = pts.length - 1; i >= 0; i--) {
          pts[i].t -= 0.012
          if (pts[i].t <= 0) pts.splice(i, 1)
        }
        if (pts.length > 1) {
          ctx.save()
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          const { r: cr, g: cg, b: cb } = colorRGB

          // Draw smooth bezier through points
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[Math.max(0, i - 1)]
            const p1 = pts[i]
            const alpha = p1.t * 0.8 * mul
            // Pressure: thicker in middle, thin at ends
            const pressure = Math.sin((i / pts.length) * Math.PI)
            const width = (1.5 + pressure * 3) * mul

            ctx.globalAlpha = alpha
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},1)`
            ctx.lineWidth = width
            ctx.shadowColor = `rgba(${cr},${cg},${cb},0.4)`
            ctx.shadowBlur = 4

            ctx.beginPath()
            ctx.moveTo(p0.x, p0.y)
            // Smooth curve via quadratic bezier
            const mx = (p0.x + p1.x) / 2
            const my = (p0.y + p1.y) / 2
            ctx.quadraticCurveTo(p0.x, p0.y, mx, my)
            ctx.stroke()
          }

          // Ink splatter at the leading edge
          if (pts.length > 2) {
            const lead = pts[pts.length - 1]
            ctx.globalAlpha = lead.t * 0.3 * mul
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.6)`
            ctx.beginPath()
            ctx.arc(lead.x, lead.y, 2 + Math.random(), 0, Math.PI * 2)
            ctx.fill()
          }

          ctx.restore()
        }
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [trailColor, mul, colorRGB])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    />
  )
}

// utilities

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
