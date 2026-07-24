/**
 * Motion tokens. Durations, easings, distances, scales.
 * All component animation values must come from here.
 */
export const motionTokens = {
  duration: {
    instant: 0.08,
    fast:    0.18,
    normal:  0.35,
    slow:    0.6,
    crawl:   1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp:  [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
  },
  scale: {
    subtle: 0.98,
    press:  0.97,
    pop:    1.04,
  },
}

/**
 * Named spring presets. Use these everywhere, no inline stiffness/damping.
 */
export const springs = {
  snappy:  { type: 'spring', stiffness: 300, damping: 30 },
  gentle:  { type: 'spring', stiffness: 120, damping: 14 },
  bouncy:  { type: 'spring', stiffness: 400, damping: 10 },
  instant: { type: 'spring', stiffness: 600, damping: 35 },
  release: { type: 'spring', stiffness: 200, damping: 20, restDelta: 0.001 },
}
