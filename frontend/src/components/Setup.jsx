import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { motionTokens } from '../lib/motion-tokens'
import { useSafeMotion } from '../hooks/useReducedMotion'
import Icon from './Icon'

const wails = window.go?.main

// Fixed setup window sizes. Both ends are pinned by the backend, so every
// window manager floats the window like a dialog instead of tiling it
const WELCOME_SIZE = { w: 460, h: 340 }
const FORM_SIZE = { w: 760, h: 500 }

const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

function validSkyName(name) {
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '')
  if (!clean || clean.length > 60 || RESERVED.test(clean)) return null
  return clean
}

const card = {
  background: colors.bgElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  boxShadow: colors.shadow,
}

// One sparse static starfield behind every setup screen. Static on purpose:
// nothing in the setup may loop (DESIGN.md motion dial), the constellation
// view is where stars come alive later
function Starfield() {
  const stars = useMemo(() => {
    // Seeded so the sky is the same sky on every launch of the setup
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

function resize(size) {
  if (wails?.App?.SetWindowSize) wails.App.SetWindowSize(size.w, size.h)
}

export default function Setup({ onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [mode, setMode] = useState('brand') // brand | choice | name | folder | offer | ready
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)

  const cleaned = validSkyName(name)

  useEffect(() => {
    resize(WELCOME_SIZE)
    return () => {
      if (wails?.App?.UnlockWindowSize) wails.App.UnlockWindowSize()
    }
  }, [])

  function handleBrandNext() {
    resize(FORM_SIZE)
    setMode('choice')
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
  const formScreen = mode === 'name' || mode === 'folder'

  const shell = (children) => (
    <div style={{ position: 'absolute', inset: 0, background: colors.bg, zIndex: 30 }}>
      <Starfield />
      <DragStrip />
      {children}
    </div>
  )

  if (mode === 'brand') {
    return shell(
      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          {...safeMotion}
          transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
          style={{ ...card, padding: '36px 48px', textAlign: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: motionTokens.duration.normal }}
          >
            <div style={{ fontSize: 34, fontWeight: 300, color: colors.text,
              letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 10 }}>
              Welcome to<br />your night sky
            </div>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, letterSpacing: '0.04em' }}>
              A place for your thoughts to grow.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: motionTokens.duration.fast }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBrandNext}
            aria-label="Begin setup"
            style={{ width: 52, height: 44, marginTop: 32, borderRadius: 8,
              border: `1px solid ${colors.border}`, background: colors.bgCard,
              color: colors.textMuted, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="chevron-right" size={18} />
          </motion.button>
        </motion.div>
      </div>
    )
  }

  return shell(
    <AnimatePresence mode="wait">
      {mode === 'choice' && (
        <motion.div key="choice" {...safeMotion}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0, marginBottom: space[4] }}>
            How do you want to start?
          </h1>
          <div style={{ display: 'flex', gap: space[2], maxWidth: 560 }}>
            {[
              {
                id: 'create', icon: 'file-plus', title: 'Create a new Sky',
                body: 'A fresh folder under Documents. Starts empty, grows as you write.',
                action: () => { setName(''); setPath(''); setMode('name') },
              },
              {
                id: 'open', icon: 'folder-open', title: 'Open an existing folder',
                body: 'Adopt a folder of markdown files. Existing files become stars.',
                action: chooseExisting,
              },
            ].map((opt, i) => (
              <motion.button key={opt.id} type="button" onClick={opt.action}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.08, duration: motionTokens.duration.normal }}
                whileHover={{ borderColor: colors.borderStrong, y: -2 }}
                whileTap={{ scale: 0.98 }}
                style={{ ...card, flex: 1, padding: space[3], cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 10, textAlign: 'left' }}
              >
                <span style={{ color: colors.accent, display: 'inline-flex' }}>
                  <Icon name={opt.icon} size={18} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: colors.text }}>{opt.title}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textMuted }}>{opt.body}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {formScreen && (
        <motion.div key={mode} {...safeMotion}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, width: 480, padding: `${space[4]}px ${space[4]}px` }}>
            <motion.div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: space[1] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              Setting up your Sky
            </motion.div>

            <motion.h1 style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0, marginBottom: space[3] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {isFolderMode ? 'Confirm your folder' : "What's the name of your Sky?"}
            </motion.h1>

            <motion.input
              autoFocus={!isFolderMode}
              value={isFolderMode ? path : name}
              disabled={isFolderMode}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Sky"
              aria-label={isFolderMode ? 'Sky folder path' : 'Sky name'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              style={{ width: '100%', background: colors.bg, color: colors.text,
                border: `1px solid ${isFolderMode || cleaned ? colors.borderStrong : colors.border}`,
                borderRadius: 6, padding: 12, fontSize: 15, outline: 'none' }}
            />
            {!isFolderMode && (
              <motion.div style={{ marginTop: 8, fontSize: 12, color: cleaned ? colors.textMuted : colors.accentWarm, minHeight: 16 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {cleaned ? 'Name looks good.' : 'A name needs letters, and no reserved words.'}
              </motion.div>
            )}

            {error && <motion.div role="alert" style={{ marginTop: space[1], fontSize: 12, color: '#b06060' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

            <motion.div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[3] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={busy || (!isFolderMode && !cleaned)}
                onClick={submit}
                style={{ background: colors.accent, color: '#0B0F19', border: 'none',
                  borderRadius: 6, padding: '10px 24px', fontSize: 14, cursor: 'pointer',
                  opacity: busy || (!isFolderMode && !cleaned) ? 0.4 : 1 }}>
                {busy ? 'working...' : isFolderMode ? 'Open this folder' : 'Create my Sky'}
              </motion.button>
              <motion.button type="button"
                onClick={() => (isFolderMode ? setMode('choice') : chooseExisting())}
                whileHover={{ color: colors.text }}
                style={{ background: 'none', border: 'none', color: colors.textMuted,
                  cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name={isFolderMode ? 'chevron-left' : 'folder-open'} size={13} />
                {isFolderMode ? 'Back' : 'Pick a different folder'}
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {mode === 'offer' && (
        <motion.div key="offer" {...safeMotion}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...card, maxWidth: 460, padding: space[4], textAlign: 'center' }}>
            <motion.div style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Found notes from an older glean.
            </motion.div>
            <motion.p style={{ ...typography.tagline, color: colors.textMuted }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              Import them into this Sky? Your old files stay untouched either way.
            </motion.p>
            <motion.div style={{ display: 'flex', gap: space[2], justifyContent: 'center' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
                borderRadius: 6, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>
                {busy ? 'importing...' : 'Import'}
              </motion.button>
              <button type="button" disabled={busy} onClick={async () => {
                if (wails?.App?.SkipMigration) await wails.App.SkipMigration()
                setMode('ready')
                setTimeout(() => onComplete(), 1200)
              }} style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
                borderRadius: 6, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>
                Skip
              </button>
            </motion.div>
            {report && (
              <motion.div style={{ marginTop: space[2], fontSize: 13, color: colors.text }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {report.failures && report.failures.length > 0
                  ? `Imported ${report.imported} of ${report.imported + report.failures.length}. Failed: ${report.failures.join(', ')}`
                  : `Imported ${report.imported}.`}
              </motion.div>
            )}
            {report && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setMode('ready'); setTimeout(() => onComplete(), 1200) }}
                style={{ marginTop: space[2], background: colors.accent, color: '#0B0F19', border: 'none',
                  borderRadius: 6, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Continue
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {mode === 'ready' && (
        <motion.div key="ready" {...safeMotion}
          transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center' }}>
          <motion.div style={{ fontSize: 28, fontWeight: 300, color: colors.text, marginBottom: space[1] }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: motionTokens.duration.slow }}>
            Your Sky is ready.
          </motion.div>
          <motion.p style={{ ...typography.tagline, color: colors.accentWarm, margin: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            The first star is yours to place.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
