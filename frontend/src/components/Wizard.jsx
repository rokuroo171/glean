import { useState } from 'react'
import { motion } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { useSafeMotion } from '../hooks/useReducedMotion'

const wails = window.go?.main
const { OpenDirectoryDialog } = window.runtime ?? {}

const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

function validSkyName(name) {
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '')
  if (!clean || clean.length > 60 || RESERVED.test(clean)) return null
  return clean
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
    if (OpenDirectoryDialog) {
      const dir = await OpenDirectoryDialog({ title: 'Choose your Sky folder' })
      if (!dir) return null
      return dir
    }
    // Mock fallback: browser devs type a path.
    return path || null
  }

  async function chooseExisting() {
    const dir = await pickFolder()
    if (!dir) return
    setPath(dir)
    const base = dir.split(/[\\/]/).pop() || ''
    setName(base)
    setMode('folder')
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const dir = mode === 'folder' ? path : path || await defaultPath()
      const state = mode === 'folder'
        ? await wails.App.OpenSky(dir)
        : await wails.App.SetupSky(cleaned, dir)
      setBusy(false)
      if (state.registry_empty && state.has_legacy && !state.migration_skipped) {
        setMode('offer') // completed in Task 4
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
        >Begin</motion.button>
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
            {busy ? 'importing...' : 'Import'}
          </motion.button>
          <button type="button" disabled={busy} onClick={async () => {
            if (wails?.App.SkipMigration) await wails.App.SkipMigration()
            setMode('ready')
            setTimeout(() => onComplete(), 1200)
          }} style={{ background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
            borderRadius: 8, padding: '10px 26px', fontSize: 14, cursor: 'pointer' }}>
            Skip
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
            Continue
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
              borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 13 }}>
            choose location
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
          {busy ? 'working...' : 'Create my Sky'}
        </motion.button>
        {!isFolderMode && (
          <button type="button" onClick={chooseExisting}
            style={{ background: 'none', border: 'none', color: colors.textMuted,
              cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
            use an existing folder instead
          </button>
        )}
      </div>
    </motion.div>
  )
}
