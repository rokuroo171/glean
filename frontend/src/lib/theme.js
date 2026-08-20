/** Shared visual tokens. 8px grid, ref-aligned palette. */

export const colors = {
  bg: '#0B0F19',
  bgElevated: '#121824',
  bgTranslucent: 'rgba(11, 15, 25, 0.85)',
  bgCard: 'rgba(18, 24, 36, 0.75)',
  border: 'rgba(180, 140, 80, 0.12)',
  borderStrong: 'rgba(180, 140, 80, 0.25)',
  shadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
  text: '#e8eaed',
  textMuted: '#6a7a8a',
  textDim: '#4a5a6a',
  accent: '#5b9fd4',
  accentWarm: '#ffb366',
  starCool: '#6aabff',
  starWarm: '#ffb366',
  starHot: '#ff8050',
  starNeutral: '#d0d0d0',
  starPurple: '#b08cff',
}

export const space = {
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
}

export const typography = {
  greeting: { fontSize: 28, fontWeight: 400, lineHeight: 1.3 },
  tagline: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  sectionLabel: { fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' },
  noteTitle: { fontSize: 15, fontWeight: 500, lineHeight: 1.4 },
  notePreview: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  noteTime: { fontSize: 12, fontWeight: 400 },
  streakValue: { fontSize: 22, fontWeight: 500, lineHeight: 1.2 },
  streakLabel: { fontSize: 12, fontWeight: 400 },
}

export const speciesColor = {
  warm: colors.starWarm,
  cool: colors.starCool,
  neutral: colors.starNeutral,
  hot: colors.starHot,
}
