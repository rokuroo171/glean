import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { motionTokens } from '../lib/motion-tokens'
import { useSafeMotion } from '../hooks/useReducedMotion'
import { NightShell, primaryButton, ghostButton, WELCOME_SIZE, FORM_SIZE, resizeSetupWindow } from './SetupChrome'
import Icon from './Icon'

const wails = window.go?.main

const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

function validSkyName(name) {
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '')
  if (!clean || clean.length > 60 || RESERVED.test(clean)) return null
  return clean
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
    resizeSetupWindow(WELCOME_SIZE)
  }, [])

  function handleBrandNext() {
    resizeSetupWindow(FORM_SIZE)
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

  const shell = (children) => <NightShell>{children}</NightShell>

  if (mode === 'brand') {
    return shell(
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleBrandNext() }}>
        <motion.div
          {...safeMotion}
          transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
          style={{ textAlign: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: motionTokens.duration.normal }}
          >
            <div style={{ fontSize: 38, fontWeight: 300, color: colors.text,
              letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 12 }}>
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
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleBrandNext}
            aria-label="Begin setup"
            style={{ ...primaryButton, marginTop: 40, padding: '11px 40px' }}
          >
            Begin
          </motion.button>
          <motion.div style={{ marginTop: 14, fontSize: 12, color: colors.textDim }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            press Enter
          </motion.div>
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
          <div style={{ display: 'flex', gap: space[2], maxWidth: 620 }}>
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
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onFocus={(e) => { e.currentTarget.style.background = colors.bgCard }}
                onBlur={(e) => { e.currentTarget.style.background = 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgCard }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                style={{ flex: 1, padding: space[3], cursor: 'pointer', background: 'transparent',
                  border: 'none', borderRadius: 6, textAlign: 'left',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 10, transition: 'background 150ms ease' }}
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
          <div style={{ width: 460 }}>
            <motion.div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: space[1] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
              Setting up your Sky
            </motion.div>

            <motion.h1 style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0, marginBottom: space[4] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {isFolderMode ? 'Confirm your folder' : "What's the name of your Sky?"}
            </motion.h1>

            <motion.input
              autoFocus={!isFolderMode}
              value={isFolderMode ? path : name}
              disabled={isFolderMode}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && cleaned && !busy) submit() }}
              placeholder="My Sky"
              aria-label={isFolderMode ? 'Sky folder path' : 'Sky name'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              onFocus={(e) => { e.target.style.borderColor = colors.accent }}
              onBlur={(e) => { e.target.style.borderColor = colors.borderStrong }}
              style={{ width: '100%', background: colors.bg, color: colors.text,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 6, padding: 12, fontSize: 15, outline: 'none',
                transition: 'border-color 150ms ease' }}
            />
            {!isFolderMode && (
              <motion.div style={{ marginTop: 8, fontSize: 12, color: cleaned ? colors.textMuted : colors.textDim, minHeight: 16 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {cleaned ? 'Name looks good.' : 'A name needs letters, and no reserved words.'}
              </motion.div>
            )}

            {error && <motion.div role="alert" style={{ marginTop: space[1], fontSize: 12, color: '#b06060' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

            <motion.div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[4] }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={busy || (!isFolderMode && !cleaned)}
                onClick={submit}
                style={{ ...primaryButton, opacity: busy || (!isFolderMode && !cleaned) ? 0.4 : 1 }}>
                {busy ? 'working...' : isFolderMode ? 'Open this folder' : 'Create my Sky'}
              </motion.button>
              <motion.button type="button"
                onClick={() => (isFolderMode ? setMode('choice') : chooseExisting())}
                whileHover={{ color: colors.text }}
                style={{ ...ghostButton, display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <motion.div style={{ ...typography.greeting, fontWeight: 300, color: colors.text, margin: 0 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              Found notes from an older glean.
            </motion.div>
            <motion.p style={{ ...typography.tagline, color: colors.textMuted, marginBottom: space[4] }}
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
              }} style={{ ...primaryButton, opacity: busy ? 0.4 : 1 }}>
                {busy ? 'importing...' : 'Import'}
              </motion.button>
              <button type="button" disabled={busy} onClick={async () => {
                if (wails?.App?.SkipMigration) await wails.App.SkipMigration()
                setMode('ready')
                setTimeout(() => onComplete(), 1200)
              }} style={{ ...ghostButton }}>
                Skip
              </button>
            </motion.div>
            {error && <motion.div role="alert" style={{ marginTop: space[2], fontSize: 12, color: '#b06060' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}
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
                style={{ ...primaryButton, marginTop: space[3] }}
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
          <motion.div style={{ fontSize: 30, fontWeight: 300, color: colors.text, marginBottom: space[1] }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: motionTokens.duration.slow }}>
            Your Sky is ready.
          </motion.div>
          <motion.p style={{ ...typography.tagline, color: colors.accent, margin: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            The first star is yours to place.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
