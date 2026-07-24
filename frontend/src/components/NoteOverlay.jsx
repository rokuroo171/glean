import { useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { colors } from '../lib/theme'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useSafeMotion, useReducedMotion } from '../hooks/useReducedMotion'
import { renderMarkdown } from '../lib/markdown'

const btnStyle = {
  background: 'none', border: `1px solid ${colors.border}`, color: colors.textMuted,
  padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
  transition: 'background 160ms ease-out, color 160ms ease-out',
}

export default function NoteOverlay({ note, onEdit, onWish, onDelete, onClose }) {
  const safeMotion = useSafeMotion(motionTokens.distance.md)
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press
  const [wishMsg, setWishMsg] = useState(null)

  const handleWish = useCallback(async () => {
    setWishMsg(null)
    const ok = await onWish(note.id)
    if (ok) {
      setWishMsg('Wish granted!')
    } else {
      setWishMsg('Already wished today.')
    }
    // Clear message after 2.5s
    setTimeout(() => setWishMsg(null), 2500)
  }, [note.id, onWish])

  if (!note) return null

  return (
    <>
    <style>{`
      .note-overlay-scroll::-webkit-scrollbar { width: 6px; }
      .note-overlay-scroll::-webkit-scrollbar-track { background: transparent; }
      .note-overlay-scroll::-webkit-scrollbar-thumb {
        background: rgba(90, 106, 122, 0.25);
        border-radius: 3px;
      }
      .note-overlay-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(90, 106, 122, 0.4);
      }
    `}</style>
    <motion.div
      initial={safeMotion.initial}
      animate={safeMotion.animate}
      exit={safeMotion.exit}
      transition={springs.gentle}
      style={{
        position: 'absolute', bottom: 20, left: 20, right: 20,
        background: '#1a2030', border: `1px solid ${colors.border}`,
        borderRadius: 8, padding: 20, color: colors.text,
        maxHeight: '40vh', overflow: 'auto',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(90, 106, 122, 0.25) transparent',
      }}
      className="note-overlay-scroll"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: colors.text }}>{note.title}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={() => onEdit(note)}
            style={btnStyle}
          >edit</motion.button>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={handleWish}
            style={btnStyle}
          >wish</motion.button>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={() => onDelete(note.id)}
            style={{...btnStyle, color: '#b06060'}}
          >delete</motion.button>
          <motion.button
            whileHover={{ scale: motionTokens.scale.pop }}
            whileTap={{ scale: tapScale }}
            onClick={onClose}
            style={btnStyle}
          >close</motion.button>
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {note.body ? renderMarkdown(note.body) : <span style={{ color: colors.textDim }}>(empty)</span>}
      </div>
      {/* Wish feedback message, visible per section 16 click-first */}
      {wishMsg && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 4,
            background: wishMsg.includes('Already') ? 'rgba(180,120,60,0.15)' : 'rgba(80,160,100,0.15)',
            color: wishMsg.includes('Already') ? '#c0a060' : '#80c090',
            fontSize: 12,
          }}
        >
          {wishMsg}
        </motion.div>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: colors.textDim }}>
        {note.visit_count} visits
      </div>
    </motion.div>
    </>
  )
}
