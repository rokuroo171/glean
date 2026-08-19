import { useState } from 'react'
import { motion } from 'motion/react'
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

// Defer runtime lookup to call time -- window.runtime may not be ready at module load.
function getOpenDirDialog() {
  return window.runtime?.OpenDirectoryDialog
}

export default function Wizard({ onComplete }) {
  const safeMotion = useSafeMotion(24)
  const [mode, setMode] = useState('brand') // brand | name | folder | ready | offer
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)

  const cleaned = validSkyName(name)

  async function pickFolder() {
    const dialog = getOpenDirDialog()
    if (dialog) {
      const dir = await dialog({ title: 'Choose your Sky folder' })
      if (!dir) return null
      return dir
    }
    // Browser/mock fallback: prompt for a path so the wizard is testable
    // in the dev server without a native dialog.
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
        // Browser/mock mode: fake the state so the wizard completes.
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
      setTimeout(() => onComplete(state), 1200)
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

  // Show the folder path once a location is picked, in both modes.
  const showPath = isFolderMode || (!isFolderMode && path)

  if (mode === 'brand') {
    return (
      <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
        <div style={{ fontSize: 40, fontWeight: 600, color: colors.text, marginBottom: space[2] }}>glean</div>
        <p style={{ ...typography.tagline, color: colors.textMuted, margin: 0 }}>
          The night holds what you seek.
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMode('name')}
          style={{ marginTop: space[5], border: `1px solid ${colors.borderStrong}`,
            background: 'none', color: colors.text, padding: '10px 24px', borderRadius: 8, cursor: 'pointer' }}
        ><Icon name="star" size={14} /> Begin</motion.button>
      </motion.div>
    )
  }

  if (mode === 'ready') {
    return (
      <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
        <div style={{ fontSize: 24, color: colors.text, marginBottom: space[2] }}>Your Sky is ready.</div>
        <p style={{ ...typography.tagline, color: colors.textMuted, margin: 0 }}>
          The first star is yours to place.
        </p>
      </motion.div>
    )
  }

  if (mode === 'offer') {
    return (
      <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
        <div style={{ ...typography.greeting, color: colors.text, margin: 0, maxWidth: 460, textAlign: 'center' }}>
          Found notes from an older glean.
        </div>
        <p style={{ ...typography.tagline, color: colors.textMuted, maxWidth: 420, textAlign: 'center' }}>
          Import them into this Sky? Your old files stay untouched either way.
        </p>
        <div style={{ display: 'flex', gap: space[3], marginTop: space[4] }}>
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
        </div>
        {report && (
          <div style={{ marginTop: space[3], fontSize: 13, color: colors.text }}>
            {report.failures && report.failures.length > 0
              ? `Imported ${report.imported} of ${report.imported + report.failures.length}. Failed: ${report.failures.join(', ')}`
              : `Imported ${report.imported}.`}
          </div>
        )}
        {report && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setMode('ready'); setTimeout(() => onComplete(), 1200) }}
            style={{ marginTop: space[3], background: colors.accent, color: '#0B0F19', border: 'none',
              borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
            <Icon name="chevron-right" size={14} /> Continue
          </motion.button>
        )}
      </motion.div>
    )
  }

  const isFolderMode = mode === 'folder'
  return (
    <motion.div initial={safeMotion.initial} animate={safeMotion.animate} exit={safeMotion.exit}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: colors.bg, zIndex: 30 }}>
      <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: space[2] }}>
        Setting up your Sky.
      </div>
      <h1 style={{ ...typography.greeting, color: colors.text, margin: 0, maxWidth: 420, textAlign: 'center' }}>
        {isFolderMode ? 'Choose your existing folder.' : "What's the name of your Sky?"}
      </h1>

      <input
        autoFocus={!isFolderMode}
        value={name}
        disabled={isFolderMode}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Sky"
        style={{ marginTop: space[4], width: 320, background: '#151a24', color: colors.text,
          border: `1px solid ${cleaned ? colors.borderStrong : colors.border}`,
          borderRadius: 8, padding: 12, fontSize: 16, outline: 'none' }}
      />
      <div style={{ marginTop: 6, fontSize: 12, color: cleaned ? colors.textMuted : colors.accentWarm, minHeight: 16 }}>
        {cleaned ? 'Name looks good.' : 'A name needs letters, and no reserved words.'}
      </div>

      {!isFolderMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[2] }}>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Documents folder"
            style={{ width: 260, background: '#151a24', color: colors.textMuted,
              border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, fontSize: 13, outline: 'none' }}
          />
          <button type="button" onClick={async () => { const d = await pickFolder(); if (d) setPath(d) }}
            style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <Icon name="search" size={13} /> Choose
          </button>
        </div>
      )}

      {error && <div style={{ marginTop: space[2], fontSize: 12, color: '#b06060' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginTop: space[4] }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy || (mode !== 'folder' && !cleaned)}
          onClick={submit}
          style={{ background: colors.accent, color: '#0B0F19', border: 'none',
            borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer',
            opacity: busy || (mode !== 'folder' && !cleaned) ? 0.4 : 1 }}>
          {busy ? 'working...' : <><Icon name="star" size={14} /> Create my Sky</>}
        </motion.button>
        {!isFolderMode && (
          <button type="button" onClick={chooseExisting}
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="panel-right" size={12} /> Use an existing folder
          </button>
        )}
      </div>
    </motion.div>
  )
}
