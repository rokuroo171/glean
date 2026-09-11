import { useMemo } from 'react'
import { colors } from '../lib/theme'

// Fixed setup window sizes. Both ends are pinned by the backend, so every
// window manager floats the window like a dialog instead of tiling it
export const WELCOME_SIZE = { w: 460, h: 340 }
export const FORM_SIZE = { w: 760, h: 500 }

export const setupCard = {
  background: colors.bgElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  boxShadow: colors.shadow,
}

// One sparse static starfield behind the pre-workspace gates. Static on
// purpose: nothing here may loop (DESIGN.md motion dial), the constellation
// view is where stars come alive later
function Starfield() {
  const stars = useMemo(() => {
    // Seeded so the sky is the same sky on every launch of the gate
    let seed = 20260910
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    return Array.from({ length: 56 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: rand() < 0.85 ? 1 : 2,
      opacity: 0.12 + rand() * 0.5,
    }))
  }, [])
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: colors.text, opacity: s.opacity,
        }} />
      ))}
    </div>
  )
}

// Invisible strip across the top so the fixed window can still be dragged
function DragStrip() {
  if (!window.runtime) return null
  return <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28,
    '--wails-draggable': 'drag', zIndex: 40 }} />
}

// Full-bleed night backdrop shared by every pre-workspace gate
export function NightShell({ children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: colors.bg, zIndex: 30 }}>
      <Starfield />
      <DragStrip />
      {children}
    </div>
  )
}

// Pin the OS window to a fixed size (the backend sets min=max so the
// window floats instead of tiling)
export function resizeSetupWindow(size) {
  if (window.go?.main?.App?.SetWindowSize) window.go.main.App.SetWindowSize(size.w, size.h)
}

// Release the fixed-size pin so the workspace resizes normally again
export function unlockWindow() {
  if (window.go?.main?.App?.UnlockWindowSize) window.go.main.App.UnlockWindowSize()
}
