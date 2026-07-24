import { useMemo } from 'react'
import { motion } from 'motion/react'
import StarIcon from './StarIcon'
import { colors, space, typography } from '../lib/theme'
import { bodyPreview, relativeTime, pickGreeting } from '../lib/format'
import { springs, motionTokens } from '../lib/motion-tokens'
import { useSafeMotion, useReducedMotion } from '../hooks/useReducedMotion'

/** Decorative background stars for Home. Static, right-weighted per ref. */
const DECOR_STARS = [
  { x: '72%', y: '18%', size: 28, color: colors.starCool },
  { x: '85%', y: '32%', size: 20, color: colors.starPurple },
  { x: '68%', y: '45%', size: 16, color: colors.starWarm },
  { x: '78%', y: '58%', size: 24, color: colors.starCool },
  { x: '88%', y: '72%', size: 14, color: colors.starNeutral },
  { x: '62%', y: '28%', size: 10, color: colors.textDim },
  { x: '90%', y: '48%', size: 8, color: colors.textDim },
  { x: '75%', y: '80%', size: 12, color: colors.textDim },
]

function HomeBackground({ onEnterSky }) {
  return (
    <button
      type="button"
      onClick={onEnterSky}
      aria-label="Enter the sky"
      style={{
        position: 'absolute',
        inset: 0,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: colors.bg,
        zIndex: 0,
      }}
    >
      {/* Fine starfield */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.35) 50%, transparent 50%),
            radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,0.25) 50%, transparent 50%),
            radial-gradient(1px 1px at 55% 15%, rgba(255,255,255,0.2) 50%, transparent 50%),
            radial-gradient(1px 1px at 70% 85%, rgba(255,255,255,0.3) 50%, transparent 50%),
            radial-gradient(1px 1px at 85% 40%, rgba(255,255,255,0.25) 50%, transparent 50%),
            radial-gradient(1px 1px at 95% 10%, rgba(255,255,255,0.2) 50%, transparent 50%)
          `,
          backgroundSize: '100% 100%',
        }}
      />
      {/* Nebula wash. Right side. */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: '10%',
          width: '55%',
          height: '70%',
          background: 'radial-gradient(ellipse at 70% 40%, rgba(60,80,120,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {DECOR_STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: star.x,
            top: star.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <StarIcon color={star.color} size={star.size > 20 ? 'lg' : star.size > 14 ? 'md' : 'sm'} />
        </div>
      ))}
    </button>
  )
}

function StreakRing({ streak }) {
  const r = 22
  const circumference = 2 * Math.PI * r
  const progress = Math.min(streak, 7) / 7
  const dash = circumference * progress

  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} viewBox="0 0 56 56" aria-hidden style={{ display: 'block' }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(90,106,122,0.2)" strokeWidth={2} />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 28 28)"
          style={{ filter: `drop-shadow(0 0 4px ${colors.accent}66)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StarIcon color={colors.accent} size="sm" />
      </div>
    </div>
  )
}

export default function Home({ notes, stats, onNoteClick, onEnterSky, onOpenStats, onNewNote }) {
  const safeMotion = useSafeMotion(12)
  const reducedMotion = useReducedMotion()
  const tapScale = reducedMotion ? 1 : motionTokens.scale.press

  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        const aTime = new Date(a.last_visited || a.created_at || 0).getTime()
        const bTime = new Date(b.last_visited || b.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 5)
  }, [notes])

  const streak = stats?.current_streak ?? 0
  const streakLabel = streak === 1 ? '1 day' : `${streak} days`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <HomeBackground onEnterSky={onEnterSky} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          padding: `${space[6]}px ${space[4]}px`,
          pointerEvents: 'none',
        }}
      >
        {/* Greeting */}
        <div style={{ marginBottom: space[5], pointerEvents: 'none' }}>
          <h1 style={{ ...typography.greeting, color: colors.text, margin: 0 }}>
            {pickGreeting(stats, notes)}
          </h1>
          <p style={{ ...typography.tagline, color: colors.textMuted, margin: `${space[1]}px 0 0` }}>
            The night holds what you seek.
          </p>
        </div>

        {/* Recent notes */}
        <div style={{ pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] }}>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted }}>
              Recent notes
            </div>
            <button
              type="button"
              onClick={onNewNote}
              aria-label="Create new note"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 12,
                color: colors.textMuted,
                transition: 'border-color 160ms ease-out, color 160ms ease-out, transform 160ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.accent
                e.currentTarget.style.color = colors.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.color = colors.textMuted
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = `scale(${tapScale})` }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              new note
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <p style={{ ...typography.notePreview, color: colors.textDim }}>
              No notes yet. Enter the sky to begin.
            </p>
          ) : (
            recentNotes.map((note, i) => (
              <button
                key={note.id}
                type="button"
                onClick={() => onNoteClick(note.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: space[2],
                  width: '100%',
                  padding: `${space[2]}px 0`,
                  background: 'none',
                  border: 'none',
                  borderTop: i > 0 ? `1px solid ${colors.border}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'opacity 160ms ease-out',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = `scale(${tapScale})` }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <div style={{ paddingTop: 2 }}>
                  <StarIcon species={note.species} size="sm" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: space[1] }}>
                    <span style={{ ...typography.noteTitle, color: colors.text }}>{note.title}</span>
                    <span style={{ ...typography.noteTime, color: colors.textMuted, flexShrink: 0 }}>
                      {relativeTime(note.last_visited || note.created_at)}
                    </span>
                  </div>
                  <div style={{ ...typography.notePreview, color: colors.textMuted, marginTop: 2 }}>
                    {bodyPreview(note.body)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Streak card */}
        <motion.button
          type="button"
          onClick={onOpenStats}
          aria-label="View sky overview"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
            marginTop: space[5],
            padding: `${space[2]}px ${space[3]}px`,
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            cursor: 'pointer',
            pointerEvents: 'auto',
            width: 'fit-content',
            transition: 'border-color 160ms ease-out, transform 160ms ease-out',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderStrong }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.transform = 'scale(1)' }}
          onMouseDown={(e) => { e.currentTarget.style.transform = `scale(${tapScale})` }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          animate={streak > 0 && !reducedMotion ? {
            boxShadow: [
              '0 0 0px rgba(180,140,80,0)',
              '0 0 12px rgba(180,140,80,0.15)',
              '0 0 0px rgba(180,140,80,0)',
            ],
          } : {}}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <StreakRing streak={streak} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ ...typography.streakLabel, color: colors.textMuted }}>Writing streak</div>
            <div style={{ ...typography.streakValue, color: colors.text }}>{streakLabel}</div>
            <div style={{ ...typography.streakLabel, color: colors.textMuted, marginTop: 2 }}>
              {streak > 0 ? 'Keep it going.' : 'Start one today.'}
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
