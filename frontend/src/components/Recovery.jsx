import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { motionTokens } from '../lib/motion-tokens'
import { useSafeMotion } from '../hooks/useReducedMotion'
import { NightShell, primaryButton, ghostButton, FORM_SIZE, resizeSetupWindow, unlockWindow } from './SetupChrome'
import Icon from './Icon'

const wails = window.go?.main

export default function Recovery({ onCreateNew, onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Recovery can be the boot gate when a configured sky vanished, so it
  // owns the window pin the same way Setup does
  useEffect(() => {
    resizeSetupWindow(FORM_SIZE)
    return () => unlockWindow()
  }, [])

  async function locate() {
    // Native OS folder picker via the Go backend (window.runtime has no
    // directory dialog, so the old prompt() fallback is replaced)
    let dir = wails?.App?.PickFolder ? await wails.App.PickFolder() : null
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
    <NightShell>
      <motion.div {...safeMotion}
        transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 460, textAlign: 'center' }}>
          <motion.div style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0, marginBottom: space[1] }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Your Sky is missing.
          </motion.div>
          <motion.p style={{ ...typography.tagline, color: colors.textMuted, margin: 0, marginBottom: space[4] }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            The folder was moved or deleted. Locate it, or start a fresh sky.
          </motion.p>

          {error && <motion.div role="alert" style={{ marginBottom: space[2], fontSize: 12, color: '#b06060' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

          <motion.div style={{ display: 'flex', gap: space[2], justifyContent: 'center' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={locate}
              style={{ ...primaryButton, display: 'flex', alignItems: 'center', gap: 6,
                opacity: busy ? 0.4 : 1 }}>
              {busy ? 'opening...' : <><Icon name="search" size={14} /> Locate folder</>}
            </motion.button>
            <button type="button" onClick={onCreateNew}
              style={{ ...ghostButton, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="plus" size={14} /> Create a new one
            </button>
          </motion.div>
        </div>
      </motion.div>
    </NightShell>
  )
}
