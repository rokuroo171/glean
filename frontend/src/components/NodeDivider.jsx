import { colors } from '../lib/theme'
import StarPoint from './StarPoint'

/** Hairline section divider with a node point at its center */
export default function NodeDivider({ style }) {
  return (
    <div style={{ position: 'relative', height: 1, ...style }}>
      <div style={{ position: 'absolute', inset: 0, background: colors.border }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)', lineHeight: 0 }}>
        <StarPoint size={7} color={colors.borderStrong} />
      </div>
    </div>
  )
}
