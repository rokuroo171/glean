import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { colors, space, typography } from '../lib/theme'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useSafeMotion, useReducedMotion } from '../hooks/useReducedMotion'
import StarIcon from './StarIcon'
import Icon from './Icon'

const wails = window.go?.main

export default function ManageSky({ currentSky, onSwitch, onClose }) {
  const [knownSkies, setKnownSkies] = useState([])
  const [loading, setLoading] = useState(true)
  const safeMotion = useSafeMotion(motionTokens.distance.md)
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press

  useEffect(() => {
    loadKnownSkies()
  }, [])

  async function loadKnownSkies() {
    try {
      const skies = wails ? await wails.App.GetKnownSkies() : []
      setKnownSkies(skies || [])
    } catch {
      setKnownSkies([])
    }
    setLoading(false)
  }

  async function handleSwitch(path) {
    if (path === currentSky?.path) return
    try {
      const name = wails ? await wails.App.SwitchSky(path) : null
      if (onSwitch) onSwitch(path, name)
    } catch {}
    onClose()
  }

  async function handleOpenExisting() {
    if (!wails) return
    const path = await wails.App.PickFolder()
    if (!path) return
    // Switch to the picked folder
    try {
      const name = await wails.App.SwitchSky(path)
      if (onSwitch) onSwitch(path, name)
    } catch {}
    onClose()
  }

  async function handleRemove(path) {
    if (!wails) return
    try {
      await wails.App.RemoveKnownSky(path)
      await loadKnownSkies()
    } catch {}
  }

  return (
    <motion.div
      initial={safeMotion.initial}
      animate={safeMotion.animate}
      exit={safeMotion.exit}
      transition={springs.gentle}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10, 14, 20, 0.8)', zIndex: 30,
      }}
    >
      <div style={{
        display: 'flex', width: 640, height: 420,
        background: '#121824', border: `1px solid ${colors.border}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Left: known skies list */}
        <div style={{
          width: 220, borderRight: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: `${space[2]}px ${space[2]}px ${space[1]}px`,
            ...typography.sectionLabel, color: colors.textMuted,
          }}>
            Skies
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: space[2], fontSize: 12, color: colors.textDim }}>Loading...</div>
            ) : knownSkies.length === 0 ? (
              <div style={{ padding: space[2], fontSize: 12, color: colors.textDim }}>No skies yet.</div>
            ) : (
              knownSkies.map(ks => {
                const active = ks.path === currentSky?.path
                return (
                  <div key={ks.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', cursor: 'pointer',
                      background: active ? 'rgba(91, 159, 212, 0.1)' : 'transparent',
                      borderLeft: active ? `2px solid ${colors.accent}` : '2px solid transparent',
                      transition: 'background 120ms ease-out',
                    }}
                    onClick={() => handleSwitch(ks.path)}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(180, 140, 80, 0.06)' }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <StarIcon species="warm" size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: active ? colors.text : colors.textMuted,
                        fontWeight: active ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ks.name}
                      </div>
                      <div style={{ fontSize: 10, color: colors.textDim,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ks.path}
                      </div>
                    </div>
                    {active && <span style={{ fontSize: 10, color: colors.accent }}>&#10003;</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right: actions + info */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: space[4], gap: space[3],
        }}>
          <StarIcon species="warm" size="lg" />
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.text }}>glean</div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>v1.1.0</div>

          <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 8, marginTop: space[2] }}>
            {/* Open existing folder */}
            <button type="button" onClick={handleOpenExisting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'rgba(180, 140, 80, 0.08)',
                border: `1px solid ${colors.border}`, borderRadius: 8,
                cursor: 'pointer', width: '100%',
                transition: 'border-color 160ms ease-out, background 160ms ease-out',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderStrong; e.currentTarget.style.background = 'rgba(180, 140, 80, 0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = 'rgba(180, 140, 80, 0.08)' }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>Open folder as sky</div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>Choose an existing folder of notes.</div>
              </div>
              <span style={{
                padding: '4px 12px', background: colors.accent, color: '#fff',
                borderRadius: 6, fontSize: 12, fontWeight: 500,
              }}>Open</span>
            </button>
          </div>

          {/* Close */}
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            style={{
              marginTop: space[2], background: 'none', border: 'none',
              color: colors.textMuted, cursor: 'pointer', padding: '6px 16px',
              fontSize: 12, borderRadius: 6,
              transition: 'color 160ms ease-out',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = colors.text }}
            onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted }}
          >
            Close
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
