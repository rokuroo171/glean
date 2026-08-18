import { useState } from 'react'
import { motion } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { useSafeMotion } from '../hooks/useReducedMotion'

const wails = window.go?.main
const { OpenDirectoryDialog } = window.runtime ?? {}

export default function Recovery({ onCreateNew, onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function locate() {
    const dir = OpenDirectoryDialog ? await OpenDirectoryDialog({ title: 'Locate your Sky folder' }) : null
    if (!dir) return
    setBusy(true)
    setError(null)
    try {
      const state = await wails.App.OpenSky(dir)
      onComplete(state)
    } catch (e) {
      setBusy(false)
      setError('Could not open that folder. ' + String(e))
    }
  }

  return (
    <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
      <div style={{ ...typography.greeting, color: colors.text, margin: 0 }}>Your Sky is missing.</div>
      <p style={{ ...typography.tagline, color: colors.textMuted, maxWidth: 400, textAlign: 'center' }}>
        The folder was moved or deleted. Locate it, or start a fresh sky.
      </p>
      {error && <div style={{ marginTop: space[2], fontSize: 12, color: '#b06060' }}>{error}</div>}
      <div style={{ display: 'flex', gap: space[3], marginTop: space[4] }}>
        <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={locate}
          style={{ background: colors.accent, color: '#0B0F19', border: 'none',
            borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
          {busy ? 'opening...' : 'Locate folder'}
        </motion.button>
        <button type="button" onClick={onCreateNew}
          style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
            borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
          Create a new one
        </button>
      </div>
    </motion.div>
  )
}
