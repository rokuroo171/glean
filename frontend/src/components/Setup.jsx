import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { useSafeMotion } from '../hooks/useReducedMotion'
import Icon from './Icon'

const wails = window.go?.main

const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

function validSkyName(name) {
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '')
  if (!clean || clean.length > 60 || RESERVED.test(clean)) return null
  return clean
}

const screenIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
}

export default function Setup({ onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [mode, setMode] = useState('brand')
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [exiting, setExiting] = useState(false)

  const cleaned = validSkyName(name)

  // Resize the window for the brand screen: small card, then expand on next.
  useState(() => {
    if (wails?.App?.SetWindowSize) wails.App.SetWindowSize(560, 380)
    return () => { if (wails?.App?.SetWindowSize) wails.App.SetWindowSize(1200, 800) }
  })

  function handleBrandNext() {
    setExiting(true)
    // Wait for exit animation, then resize and transition.
    setTimeout(() => {
      if (wails?.App?.SetWindowSize) wails.App.SetWindowSize(1200, 800)
      setMode('name')
    }, 450)
  }

  async function pickFolder() {
    if (wails?.App?.PickFolder) {
      const dir = await wails.App.PickFolder()
      return dir || null
    }
    const entered = prompt('Enter a folder path for your Sky:')
    return entered && entered.trim() ? entered.trim() : null
  }

  async function chooseExisting() {
    const dir = await pickFolder()
    if (!dir) return
    setPath(dir)
    const base = dir.split(/[\\/]/).pop() || ''
    setName(base)
    setMode('folder')
    setError(null)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const dir = mode === 'folder' ? path : path || await defaultPath()
      let state
      if (wails) {
        state = mode === 'folder'
          ? await wails.App.OpenSky(dir)
          : await wails.App.SetupSky(cleaned, dir)
      } else {
        state = { configured: true, sky_missing: false, sky_name: cleaned || 'My Sky',
          sky_path: dir || 'local', has_legacy: false, registry_empty: true,
          migration_skipped: false }
      }
      setBusy(false)
      if (state.registry_empty && state.has_legacy && !state.migration_skipped) {
        setMode('offer')
        return
      }
      setMode('ready')
      setTimeout(() => onComplete(state), 2200)
    } catch (e) {
      setBusy(false)
      setError('Could not set up the sky. ' + String(e))
    }
  }

  async function defaultPath() {
    if (wails && wails.App.DefaultSkyPath) {
      return (await wails.App.DefaultSkyPath(cleaned || 'My Sky')) || ''
    }
    return ''
  }

  const isFolderMode = mode === 'folder'

  // ---- Brand screen: small centered card, no background layer. ----
  if (mode === 'brand') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={exiting
            ? { opacity: 0, scale: 0.94, y: 16 }
            : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: exiting ? 0.35 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', padding: '36px 48px' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={exiting
              ? { opacity: 0, y: -6 }
              : { opacity: 1, y: 0 }}
            transition={{ delay: exiting ? 0 : 0.15, duration: exiting ? 0.25 : 0.5 }}
          >
            <div style={{ fontSize: 40, fontWeight: 300, color: colors.text,
              letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 12 }}>
              Welcome to<br />your night sky
            </div>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, letterSpacing: '0.04em' }}>
              A place for your thoughts to grow.
            </p>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={exiting
                ? { opacity: 0, y: -4 }
                : { opacity: 1, y: 0 }}
              transition={{ delay: exiting ? 0.05 : 0.4, duration: exiting ? 0.2 : 0.4 }}
              whileHover={exiting ? {} : { scale: 1.06 }}
              whileTap={exiting ? {} : { scale: 0.94 }}
              onClick={handleBrandNext}
              disabled={exiting}
              style={{ width: 56, height: 48, borderRadius: 10,
                border: `1px solid ${colors.border}`, background: colors.bgElevated,
                color: colors.textMuted, cursor: exiting ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="chevron-right" size={20} />
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ---- Ready screen. ----
  if (mode === 'ready') {
    return (
      <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
        <AnimatePresence mode="wait">
          <motion.div key="ready"
            {...screenIn} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center' }}>
            <motion.div style={{ fontSize: 28, fontWeight: 300, color: colors.text, marginBottom: space[2] }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}>
              Your Sky is ready.
            </motion.div>
            <motion.p style={{ ...typography.tagline, color: colors.textMuted, margin: 0 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              The first star is yours to place.
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    )
  }

  // ---- Migration offer screen. ----
  if (mode === 'offer') {
    return (
      <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
        <AnimatePresence mode="wait">
          <motion.div key="offer" {...screenIn} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', maxWidth: 460 }}>
            <motion.div style={{ ...typography.greeting, color: colors.text, margin: 0 }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              Found notes from an older glean.
            </motion.div>
            <motion.p style={{ ...typography.tagline, color: colors.textMuted, maxWidth: 420 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              Import them into this Sky? Your old files stay untouched either way.
            </motion.p>
            <motion.div style={{ display: 'flex', gap: space[3], marginTop: space[4], justifyContent: 'center' }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={async () => {
                setBusy(true)
                try {
                  const r = await wails.App.MigrateSky()
                  setBusy(false)
                  setReport(r)
                } catch (e) {
                  setBusy(false)
                  setError('Migration failed. ' + String(e))
                }
              }} style={{ background: colors.accent, color: '#0B0F19', border: 'none',
                borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
                {busy ? 'importing...' : <><Icon name="sparkle" size={14} /> Import</>}
              </motion.button>
              <button type="button" disabled={busy} onClick={async () => {
                if (wails?.App.SkipMigration) await wails.App.SkipMigration()
                setMode('ready')
                setTimeout(() => onComplete(), 1200)
              }} style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
                borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
                <Icon name="x" size={14} /> Skip
              </button>
            </motion.div>
            {report && (
              <motion.div style={{ marginTop: space[3], fontSize: 13, color: colors.text }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {report.failures && report.failures.length > 0
                  ? `Imported ${report.imported} of ${report.imported + report.failures.length}. Failed: ${report.failures.join(', ')}`
                  : `Imported ${report.imported}.`}
              </motion.div>
            )}
            {report && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setMode('ready'); setTimeout(() => onComplete(), 1200) }}
                style={{ marginTop: space[3], background: colors.accent, color: '#0B0F19', border: 'none',
                  borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Icon name="chevron-right" size={14} /> Continue
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    )
  }

  // ---- Name / folder screens (setup forms). ----
  return (
    <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
      <AnimatePresence mode="wait">
        <motion.div key={mode} {...screenIn} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 480 }}>

          <motion.div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: space[2] }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
            Setting up your Sky.
          </motion.div>

          <motion.h1 style={{ ...typography.greeting, color: colors.text, margin: 0, textAlign: 'center' }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {isFolderMode ? 'Choose your existing folder.' : "What's the name of your Sky?"}
          </motion.h1>

          <motion.input
            autoFocus={!isFolderMode}
            value={name}
            disabled={isFolderMode}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Sky"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ marginTop: space[4], width: 320, background: '#151a24', color: colors.text,
              border: `1px solid ${cleaned ? colors.borderStrong : colors.border}`,
              borderRadius: 8, padding: 12, fontSize: 16, outline: 'none' }}
          />
          <motion.div style={{ marginTop: 6, fontSize: 12, color: cleaned ? colors.textMuted : colors.accentWarm, minHeight: 16 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {cleaned ? 'Name looks good.' : 'A name needs letters, and no reserved words.'}
          </motion.div>

          {!isFolderMode && (
            <motion.div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[2] }}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <motion.button type="button" onClick={async () => { const d = await pickFolder(); if (d) { setPath(d); setMode('folder') } }}
                whileHover={{ borderColor: colors.borderStrong }}
                style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
                  borderRadius: 8, padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Icon name="search" size={13} /> Choose folder
              </motion.button>
            </motion.div>
          )}

          {error && <motion.div style={{ marginTop: space[2], fontSize: 12, color: '#b06060' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

          <motion.div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginTop: space[4] }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={busy || (mode !== 'folder' && !cleaned)}
              onClick={submit}
              style={{ background: colors.accent, color: '#0B0F19', border: 'none',
                borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer',
                opacity: busy || (mode !== 'folder' && !cleaned) ? 0.4 : 1 }}>
              {busy ? 'working...' : <><Icon name="sparkle" size={14} /> Create my Sky</>}
            </motion.button>
            {!isFolderMode && (
              <motion.button type="button" onClick={chooseExisting}
                whileHover={{ color: colors.text }}
                style={{ background: 'none', border: 'none', color: colors.textMuted,
                  cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="panel-right" size={12} /> Use an existing folder
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
