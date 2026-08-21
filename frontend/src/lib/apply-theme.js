import { colors } from './theme'

/**
 * Applies a theme preset + accent color by setting CSS custom properties
 * on document.documentElement and mutating the JS colors object for
 * immediate re-render pickup.
 */

const presets = {
  midnight: {
    bg: '#0B0F19',
    bgElevated: '#121824',
    bgTranslucent: 'rgba(11, 15, 25, 0.85)',
    bgCard: 'rgba(18, 24, 36, 0.75)',
    border: 'rgba(180, 140, 80, 0.12)',
    borderStrong: 'rgba(180, 140, 80, 0.25)',
    text: '#e8eaed',
    textMuted: '#6a7a8a',
    textDim: '#4a5a6a',
    accentDefault: '#5b9fd4',
    accentWarm: '#ffb366',
    starCool: '#6aabff',
    starWarm: '#ffb366',
    starHot: '#ff8050',
    starNeutral: '#d0d0d0',
    starPurple: '#b08cff',
  },
  aurora: {
    bg: '#0a1628',
    bgElevated: '#0f1f35',
    bgTranslucent: 'rgba(10, 22, 40, 0.85)',
    bgCard: 'rgba(15, 31, 53, 0.75)',
    border: 'rgba(102, 255, 170, 0.10)',
    borderStrong: 'rgba(102, 255, 170, 0.22)',
    text: '#e0f0e8',
    textMuted: '#5a8a6a',
    textDim: '#3a6a4a',
    accentDefault: '#66ffaa',
    accentWarm: '#88ddaa',
    starCool: '#66ffcc',
    starWarm: '#88ffaa',
    starHot: '#aaff88',
    starNeutral: '#c0d8c0',
    starPurple: '#88ccff',
  },
  ember: {
    bg: '#1a0f0a',
    bgElevated: '#241610',
    bgTranslucent: 'rgba(26, 15, 10, 0.85)',
    bgCard: 'rgba(36, 22, 16, 0.75)',
    border: 'rgba(255, 136, 85, 0.12)',
    borderStrong: 'rgba(255, 136, 85, 0.25)',
    text: '#f0e8e0',
    textMuted: '#8a6a5a',
    textDim: '#6a4a3a',
    accentDefault: '#ff8855',
    accentWarm: '#ffaa66',
    starCool: '#ff9966',
    starWarm: '#ffcc66',
    starHot: '#ff6644',
    starNeutral: '#d0c0b0',
    starPurple: '#cc88ff',
  },
  ocean: {
    bg: '#0a1420',
    bgElevated: '#0f1e30',
    bgTranslucent: 'rgba(10, 20, 32, 0.85)',
    bgCard: 'rgba(15, 30, 48, 0.75)',
    border: 'rgba(68, 187, 255, 0.10)',
    borderStrong: 'rgba(68, 187, 255, 0.22)',
    text: '#e0ecf4',
    textMuted: '#5a7a9a',
    textDim: '#3a5a7a',
    accentDefault: '#44bbff',
    accentWarm: '#66aaff',
    starCool: '#44ccff',
    starWarm: '#66bbff',
    starHot: '#88aaff',
    starNeutral: '#b0c0d0',
    starPurple: '#aa88ff',
  },
  lavender: {
    bg: '#140f1a',
    bgElevated: '#1e1628',
    bgTranslucent: 'rgba(20, 15, 26, 0.85)',
    bgCard: 'rgba(30, 22, 40, 0.75)',
    border: 'rgba(176, 140, 255, 0.10)',
    borderStrong: 'rgba(176, 140, 255, 0.22)',
    text: '#ece0f4',
    textMuted: '#7a5a9a',
    textDim: '#5a3a7a',
    accentDefault: '#b08cff',
    accentWarm: '#cc99ff',
    starCool: '#aa99ff',
    starWarm: '#cc88ff',
    starHot: '#ff88cc',
    starNeutral: '#c0b0d0',
    starPurple: '#cc88ff',
  },
}

export function getPresets() {
  return Object.keys(presets)
}

export function getPreset(name) {
  return presets[name] || presets.midnight
}

/**
 * Apply theme to :root CSS custom properties.
 * @param {string} presetName - one of the preset keys
 * @param {string} accentHex - override accent color, or empty string for preset default
 */
export function applyTheme(presetName, accentHex) {
  const preset = presets[presetName] || presets.midnight
  const root = document.documentElement
  const accent = accentHex || preset.accentDefault

  // Update CSS custom properties
  root.style.setProperty('--bg', preset.bg)
  root.style.setProperty('--bg-elevated', preset.bgElevated)
  root.style.setProperty('--bg-translucent', preset.bgTranslucent)
  root.style.setProperty('--bg-card', preset.bgCard)
  root.style.setProperty('--border', preset.border)
  root.style.setProperty('--border-strong', preset.borderStrong)
  root.style.setProperty('--text', preset.text)
  root.style.setProperty('--text-muted', preset.textMuted)
  root.style.setProperty('--text-dim', preset.textDim)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-warm', preset.accentWarm)
  root.style.setProperty('--star-cool', preset.starCool)
  root.style.setProperty('--star-warm', preset.starWarm)
  root.style.setProperty('--star-hot', preset.starHot)
  root.style.setProperty('--star-neutral', preset.starNeutral)
  root.style.setProperty('--star-purple', preset.starPurple)

  // Also mutate the JS colors object so components pick up new values on re-render
  colors.bg = preset.bg
  colors.bgElevated = preset.bgElevated
  colors.bgTranslucent = preset.bgTranslucent
  colors.bgCard = preset.bgCard
  colors.border = preset.border
  colors.borderStrong = preset.borderStrong
  colors.text = preset.text
  colors.textMuted = preset.textMuted
  colors.textDim = preset.textDim
  colors.accent = accent
  colors.accentWarm = preset.accentWarm
  colors.starCool = preset.starCool
  colors.starWarm = preset.starWarm
  colors.starHot = preset.starHot
  colors.starNeutral = preset.starNeutral
  colors.starPurple = preset.starPurple
}

export { presets }
