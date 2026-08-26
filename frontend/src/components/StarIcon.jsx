import { colors } from '../lib/theme'
import { usePreferences, speciesPalette } from '../lib/preferences-context'

const SIZE_MAP = { sm: 14, md: 18, lg: 24 }

/** Four-point star icon. Color from note species or explicit color prop. */
export default function StarIcon({ species = 'neutral', color, size = 'md', glow = true }) {
  const { prefs } = usePreferences()
  const palette = speciesPalette(prefs.sky || {})
  const fill = color || palette[species] || colors.starNeutral
  const px = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, filter: glow ? `drop-shadow(0 0 ${px * 0.4}px ${fill}88)` : undefined }}
    >
      <path
        d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
        fill={fill}
      />
    </svg>
  )
}
