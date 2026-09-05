import { useState, useEffect } from 'react'
import { colors, space } from '../lib/theme'
import Icon from './Icon'

const wails = window.go?.main
const REPO_URL = 'https://github.com/rokuroo171/glean'
const OCTOCAT = 'https://avatars.githubusercontent.com/u/9919?s=200'

const sectionTitle = {
  fontSize: 11,
  fontWeight: 500,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: space[2],
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: space[5] }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ background: colors.bgCard, border: '1px solid ' + colors.border, borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', gap: 16, fontSize: 13,
      borderBottom: last ? 'none' : '1px solid ' + colors.border,
    }}>
      <span style={{ color: colors.textMuted, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  )
}

function ActionButton({ label, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid ' + colors.border,
        borderRadius: 6,
        color: color || colors.text,
        fontSize: 12,
        padding: '5px 12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function openLink(url) {
  if (wails) {
    wails.App.OpenURL(url)
  } else {
    window.open(url, '_blank')
  }
}

export default function SettingsPane({ skyName, skyPath, version, systemInfo, prefs, onUpdatePrefs }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [stars, setStars] = useState(null)

  useEffect(() => {
    fetch('https://api.github.com/repos/rokuroo171/glean')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStars(d.stargazers_count) })
      .catch(() => {})
  }, [])

  const handleOpenFolder = async () => {
    if (wails) await wails.App.OpenVaultFolder()
  }

  const handleExport = async () => {
    if (!wails) return
    const b64 = await wails.App.ExportSky()
    if (!b64) return
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (skyName || 'sky') + '.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!wails) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return
      const buf = await file.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      await wails.App.ImportNotes(b64)
    }
    input.click()
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (wails) await wails.App.DeleteSky()
    setConfirmDelete(false)
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space[5], color: colors.text }}>
      <h2 style={{ margin: '0 0 ' + space[4] + 'px', fontSize: 18, fontWeight: 500 }}>Settings</h2>

      <Section title="About">
        <Row label="Version"><span style={{ color: colors.text }}>{version}</span></Row>
        <Row label="License">
          <span style={{ color: colors.text }}>GNU General Public License v3.0 or later</span>
        </Row>
        <Row label="Source">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => openLink(REPO_URL)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.accent,
                fontSize: 13,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <img
                src={OCTOCAT}
                alt=""
                style={{ width: 18, height: 18, borderRadius: '50%' }}
              />
              <span>rokuroo171/glean</span>
              <Icon name="external-link" size={12} color={colors.accent} />
            </button>
            {stars !== null && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                background: 'rgba(180, 140, 80, 0.1)',
                border: '1px solid ' + colors.border,
                borderRadius: 10,
                padding: '1px 8px',
                fontSize: 11,
                color: colors.accentWarm,
              }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/>
                </svg>
                {stars}
              </span>
            )}
          </div>
        </Row>
        {systemInfo && (
          <Row label="System" last>
            <span style={{ color: colors.textMuted, fontSize: 12 }}>
              {systemInfo.os} {systemInfo.arch}
            </span>
          </Row>
        )}
        {!systemInfo && <Row label="System" last><span style={{ color: colors.textMuted, fontSize: 12 }}>-</span></Row>}
      </Section>

      <Section title="Sky">
        <Row label="Name"><span style={{ color: colors.text }}>{skyName}</span></Row>
        <Row label="Path">
          <span style={{ color: colors.textMuted, fontSize: 11, maxWidth: 280, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skyPath || 'local'}</span>
        </Row>
        <Row label="Actions" last>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton label="Open folder" onClick={handleOpenFolder} />
            <ActionButton label="Export" onClick={handleExport} />
            <ActionButton label="Import" onClick={handleImport} />
            <ActionButton
              label={confirmDelete ? 'Confirm delete' : 'Delete'}
              color={confirmDelete ? '#ff5555' : colors.textMuted}
              onClick={handleDelete}
            />
          </div>
        </Row>
      </Section>

      <div style={{ fontSize: 12, color: colors.textDim, marginTop: space[2] }}>
        Everything you write is plain markdown in that folder. Move it, and locate it again from the recovery screen.
      </div>
    </div>
  )
}
