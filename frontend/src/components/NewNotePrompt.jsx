import { motion } from 'motion/react'
import { colors, space } from '../lib/theme'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useSafeMotion, useReducedMotion } from '../hooks/useReducedMotion'

/* ── Toolbar icons (SVG, 16px) ─────────────────────────── */

function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/* ── Icon button wrapper ───────────────────────────────── */

const iconBtn = {
  background: 'none',
  border: 'none',
  padding: 6,
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 160ms ease-out, transform 160ms ease-out',
}

/* New note prompt. Visible Create/Cancel buttons. */

export default function NewNotePrompt({ title, onTitleChange, onSubmit, onCancel }) {
  const safeMotion = useSafeMotion(motionTokens.distance.md)
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press

  return (
    <motion.div
      initial={safeMotion.initial}
      animate={safeMotion.animate}
      exit={safeMotion.exit}
      transition={springs.gentle}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10, 14, 20, 0.75)',
        zIndex: 20,
      }}
    >
      <div style={{
        background: '#1a2030', border: `1px solid ${colors.border}`,
        borderRadius: 12, padding: space[3], color: colors.text,
        width: 340,
      }}>
        <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: space[2] }}>title</div>
        <input
          autoFocus
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width: '100%', background: '#151a24', color: '#d0e0d0',
            border: `1px solid ${colors.border}`, borderRadius: 6, padding: 10,
            fontSize: 14, outline: 'none',
            transition: 'border-color 160ms ease-out',
          }}
          onFocus={(e) => { e.target.style.borderColor = colors.borderStrong }}
          onBlur={(e) => { e.target.style.borderColor = colors.border }}
        />
        {/* Visible Create / Cancel buttons. Section 16 click-first. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: space[2] }}>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={onCancel}
            title="Cancel"
            aria-label="Cancel"
            style={{ ...iconBtn }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(90,106,122,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
          >
            <IconClose size={16} />
          </motion.button>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={onSubmit}
            title="Create note"
            aria-label="Create note"
            style={{ ...iconBtn, background: `${colors.accent}22` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${colors.accent}33` }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${colors.accent}22` }}
          >
            <IconCheck size={16} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
