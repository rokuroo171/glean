import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import StarIcon from './StarIcon'
import { colors, space } from '../lib/theme'
import { formatDate, wordCount, relativeTime } from '../lib/format'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useSafeMotion, useReducedMotion } from '../hooks/useReducedMotion'

/* ── Toolbar icons (SVG, 16px) ─────────────────────────── */

function IconEdit({ size = 16, active = false }) {
  const c = active ? colors.accent : colors.textMuted
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function IconSave({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconTrash({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
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

function ToolbarBtn({ children, onClick, title, active = false, reducedMotion }) {
  return (
    <motion.button
      whileHover={{ scale: motionTokens.scale.pop }}
      whileTap={{ scale: reducedMotion ? 1 : motionTokens.scale.press }}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ ...iconBtn, background: active ? `${colors.accent}22` : undefined }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(90,106,122,0.12)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none' }}
    >
      {children}
    </motion.button>
  )
}

/* Edit overlay, centered panel per EDITOR ref */

export default function EditOverlay({ note, body, onBodyChange, onSave, onAutoSave, onCancel, onDelete }) {
  const safeMotion = useSafeMotion(motionTokens.distance.md)
  const reducedMotion = useReducedMotion()

  // ─── Debounced autosave ──────────────────────────────────────────────
  // 'saved' | 'unsaved' | 'saving'
  const [saveStatus, setSaveStatus] = useState('saved')
  const debounceRef = useRef(null)
  const AUTOSAVE_DELAY = 1500 // 1.5s after last keystroke

  // Keep a ref to the latest onAutoSave so the debounce timer never holds a stale closure
  const onAutoSaveRef = useRef(onAutoSave)
  onAutoSaveRef.current = onAutoSave

  // Track body changes and trigger autosave
  const handleBodyChange = useCallback((newBody) => {
    onBodyChange(newBody)
    setSaveStatus('unsaved')
    // Reset debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onAutoSaveRef.current()
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, AUTOSAVE_DELAY)
  }, [onBodyChange])

  // Clean up debounce timer on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  if (!note) return null

  const words = wordCount(body || '')
  const created = formatDate(note.created_at)
  const lastOpened = relativeTime(note.last_visited)

  return (
    <motion.div
      initial={safeMotion.initial}
      animate={safeMotion.animate}
      exit={safeMotion.exit}
      transition={springs.gentle}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 14, 20, 0.85)',
        zIndex: 20,
        padding: space[4],
      }}
    >
      <div style={{
        background: '#1a2030',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        width: '100%',
        maxWidth: 640,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header: title + toolbar */}
        <div style={{
          padding: `${space[3]}px ${space[3]}px ${space[2]}px`,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2], minWidth: 0 }}>
              <StarIcon species={note.species} size="md" />
              <h2 style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 500,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {note.title}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <ToolbarBtn title="Edit" active reducedMotion={reducedMotion}>
                <IconEdit size={16} active />
              </ToolbarBtn>
              <ToolbarBtn title="Save" onClick={async () => {
                if (debounceRef.current) clearTimeout(debounceRef.current)
                await onSave() // closes editor via handleSaveEdit, no status update needed
              }} reducedMotion={reducedMotion}>
                <IconSave size={16} />
              </ToolbarBtn>
              <ToolbarBtn title="Delete" onClick={() => onDelete?.(note.id)} reducedMotion={reducedMotion}>
                <IconTrash size={16} />
              </ToolbarBtn>
              <ToolbarBtn title="Close" onClick={onCancel} reducedMotion={reducedMotion}>
                <IconClose size={16} />
              </ToolbarBtn>
            </div>
          </div>
          <div style={{ marginTop: space[1], fontSize: 12, color: colors.textMuted }}>
            Created {created} · {words} {words === 1 ? 'word' : 'words'}
          </div>
        </div>

        {/* Textarea: raw markdown, monospace, visible border */}
        <div style={{ padding: space[3], flex: 1, display: 'flex', minHeight: 0 }}>
          <textarea
            autoFocus
            value={body || ''}
            onChange={(e) => handleBodyChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: '50vh',
              background: '#151a24',
              color: '#d0e0d0',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              padding: space[3],
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 160ms ease-out',
            }}
            onFocus={(e) => { e.target.style.borderColor = colors.borderStrong }}
            onBlur={(e) => { e.target.style.borderColor = colors.border }}
          />
        </div>

        {/* Footer metadata: inline, not side panel */}
        <div style={{
          padding: `${space[2]}px ${space[3]}px`,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
          fontSize: 12,
          color: colors.textMuted,
        }}>
          <span>{note.visit_count} visits</span>
          <span>·</span>
          <span>Last opened {lastOpened}</span>
          <span style={{ marginLeft: 'auto' }}>
            {saveStatus === 'saving' && <span style={{ color: colors.textMuted, opacity: 0.6 }}>saving...</span>}
            {saveStatus === 'saved' && <span style={{ color: colors.textMuted, opacity: 0.6 }}>saved</span>}
            {saveStatus === 'unsaved' && <span style={{ color: colors.accent, opacity: 0.8 }}>unsaved</span>}
            {' '}{words} words
          </span>
        </div>
      </div>
    </motion.div>
  )
}
