import { useState } from 'react'
import { motion } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { useSafeMotion } from '../hooks/useReducedMotion'
import Icon from './Icon'

const wails = window.go?.main

export default function Recovery({ onCreateNew, onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function locate() {
    let dir
    const dialog = window.runtime?.OpenDirectoryDialog
    if (dialog) {
      dir = await dialog({ title: 'Locate your Sky folder' })
    } else {
      const entered = prompt('Enter the path to your Sky folder:')
      dir = entered && entered.trim() ? entered.trim() : null
    }
    if (!dir) return
    setBusy(true)
    setError(null)
    try {
      const state = wails
        ? await wails.App.OpenSky(dir)
        : { configured: true, sky_missing: false, sky_name: 'My Sky',
            sky_path: dir, has_legacy: false, registry_empty: true,
            migration_skipped: false }
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
          {busy ? 'opening...' : <><Icon name="search" size={14} /> Locate folder</>}
        </motion.button>
        <button type="button" onClick={onCreateNew}
          style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
            borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={14} /> Create a new one
        </button>
      </div>
    </motion.div>
  )
}
