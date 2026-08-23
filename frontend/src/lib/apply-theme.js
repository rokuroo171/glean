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
  nord: {
    bg: '#2e3440',
    bgElevated: '#3b4252',
    bgTranslucent: 'rgba(46, 52, 64, 0.92)',
    bgCard: 'rgba(59, 66, 82, 0.75)',
    border: 'rgba(136, 192, 208, 0.12)',
    borderStrong: 'rgba(136, 192, 208, 0.25)',
    text: '#eceff4',
    textMuted: '#7b88a1',
    textDim: '#4c566a',
    accentDefault: '#88c0d0',
    accentWarm: '#ebcb8b',
    starCool: '#81a1c1',
    starWarm: '#ebcb8b',
    starHot: '#bf616a',
    starNeutral: '#d8dee9',
    starPurple: '#b48ead',
  },
  gruvbox: {
    bg: '#282828',
    bgElevated: '#3c3836',
    bgTranslucent: 'rgba(40, 40, 40, 0.92)',
    bgCard: 'rgba(60, 56, 54, 0.75)',
    border: 'rgba(131, 165, 152, 0.12)',
    borderStrong: 'rgba(131, 165, 152, 0.25)',
    text: '#ebdbb2',
    textMuted: '#928374',
    textDim: '#665c54',
    accentDefault: '#83a598',
    accentWarm: '#fabd2f',
    starCool: '#83a598',
    starWarm: '#fabd2f',
    starHot: '#fb4934',
    starNeutral: '#d5c4a1',
    starPurple: '#d3869b',
  },
  'tokyo-night': {
    bg: '#1a1b26',
    bgElevated: '#24283b',
    bgTranslucent: 'rgba(26, 27, 38, 0.92)',
    bgCard: 'rgba(36, 40, 59, 0.75)',
    border: 'rgba(122, 162, 247, 0.10)',
    borderStrong: 'rgba(122, 162, 247, 0.22)',
    text: '#c0caf5',
    textMuted: '#565f89',
    textDim: '#3b4261',
    accentDefault: '#7aa2f7',
    accentWarm: '#e0af68',
    starCool: '#7dcfff',
    starWarm: '#e0af68',
    starHot: '#f7768e',
    starNeutral: '#a9b1d6',
    starPurple: '#bb9af7',
  },
  'catppuccin-mocha': {
    bg: '#1e1e2e',
    bgElevated: '#313244',
    bgTranslucent: 'rgba(30, 30, 46, 0.92)',
    bgCard: 'rgba(49, 50, 68, 0.75)',
    border: 'rgba(137, 180, 250, 0.10)',
    borderStrong: 'rgba(137, 180, 250, 0.22)',
    text: '#cdd6f4',
    textMuted: '#6c7086',
    textDim: '#45475a',
    accentDefault: '#89b4fa',
    accentWarm: '#f9e2af',
    starCool: '#89dceb',
    starWarm: '#f9e2af',
    starHot: '#f38ba8',
    starNeutral: '#bac2de',
    starPurple: '#cba6f7',
  },
  paper: {
    bg: '#f5f5f0',
    bgElevated: '#ebebea',
    bgTranslucent: 'rgba(245, 245, 240, 0.92)',
    bgCard: 'rgba(235, 235, 234, 0.75)',
    border: 'rgba(120, 120, 110, 0.15)',
    borderStrong: 'rgba(120, 120, 110, 0.30)',
    text: '#2c2c2c',
    textMuted: '#777770',
    textDim: '#a0a098',
    accentDefault: '#3d7ab5',
    accentWarm: '#c47a2a',
    starCool: '#3d7ab5',
    starWarm: '#c47a2a',
    starHot: '#c44b3d',
    starNeutral: '#888880',
    starPurple: '#7b5ea7',
  },
  'catppuccin-latte': {
    bg: '#eff1f5',
    bgElevated: '#e6e9ef',
    bgTranslucent: 'rgba(239, 241, 245, 0.92)',
    bgCard: 'rgba(230, 233, 239, 0.75)',
    border: 'rgba(100, 110, 130, 0.15)',
    borderStrong: 'rgba(100, 110, 130, 0.30)',
    text: '#4c4f69',
    textMuted: '#8c8fa1',
    textDim: '#acb0be',
    accentDefault: '#1e66f5',
    accentWarm: '#df8e1d',
    starCool: '#209fb5',
    starWarm: '#df8e1d',
    starHot: '#d20f39',
    starNeutral: '#9ca0b0',
    starPurple: '#8839ef',
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
