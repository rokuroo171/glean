import { useCallback, useEffect, useState } from 'react'
import { colors, space } from '../lib/theme'
import Icon from './Icon'

const POP_W = 300
const CARD_H = 200 // safe estimate: title + body + nav + padding

function measure(target) {
  if (!target) return null
  const el = document.querySelector(target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return r
}

/**
 * Step-by-step onboarding popover. Each step either targets a CSS selector
 * (element gets a highlight ring and the popover anchors to it) or has no
 * target (popover renders as a centered card).
 *
 * steps: [{ title, body, target? }]
 */
export default function OnboardingTour({ steps, onDone, onSkip }) {
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState(null)
  const [pop, setPop] = useState(null)
  const [visible, setVisible] = useState(false)
  const [missing, setMissing] = useState(false)

  const step = steps[index] || steps[0]
  const target = step.target || null
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  const place = useCallback(() => {
    const rect = measure(target)
    setSpot(rect)
    setMissing(!!target && !rect)
    if (!rect) {
      setPop(null)
      return
    }
    let left = rect.left + rect.width / 2 - POP_W / 2
    left = Math.min(Math.max(left, 12), window.innerWidth - POP_W - 12)
    const below = rect.bottom + 14
    const above = rect.top - 14
    let top, side
    if (below + CARD_H <= window.innerHeight) {
      top = below
      side = 'below'
    } else if (above - CARD_H >= 0) {
      // Card sits above the target: its bottom edge lands 14px above it.
      top = above - CARD_H
      side = 'above'
    } else {
      // Neither side fits cleanly; clamp the card inside the viewport.
      top = Math.max(12, window.innerHeight - CARD_H)
      side = 'above'
    }
    setPop({ left, top, side, anchorX: rect.left + rect.width / 2 })
  }, [target])

  useEffect(() => {
    let t1, t2
    // Wait a beat for the workspace to settle, then measure.
    t1 = setTimeout(() => {
      place()
      t2 = setTimeout(place, 150)
    }, 60)
    window.addEventListener('resize', place)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', place)
    }
  }, [place])

  // Entrance animation per step.
  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onSkip && onSkip()
        return
      }
      if (e.key === 'Enter') {
        if (index >= steps.length - 1) onDone && onDone()
        else setIndex(i => Math.min(i + 1, steps.length - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip, onDone, index, steps.length])

  const go = (dir) => {
    const next = index + dir
    if (next < 0 || next >= steps.length) return
    setIndex(next)
  }

  const cardStyle = {
    position: 'fixed', zIndex: 950,
    background: colors.bgElevated,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 14, boxShadow: colors.shadow,
    width: POP_W, padding: 18,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  }

  return (
    <>
      {/* Soft dim over the app */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(4, 8, 16, 0.35)', pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
      }} />

      {/* Highlight ring around the target */}
      {spot && (
        <div style={{
          position: 'fixed', zIndex: 910, pointerEvents: 'none',
          left: spot.left - 5, top: spot.top - 5,
          width: spot.width + 10, height: spot.height + 10,
          borderRadius: 10,
          border: `2px solid ${colors.accent}`,
          boxShadow: '0 0 0 4px rgba(91, 159, 212, 0.18), 0 0 24px rgba(91, 159, 212, 0.35)',
          transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      )}

      {/* Popover anchored to the target */}
      {pop && spot && (
        <div style={{
          ...cardStyle,
          left: pop.left, top: pop.top,
        }}>
          <div style={{
            position: 'absolute',
            left: pop.anchorX - pop.left - 5,
            top: pop.side === 'below' ? -5 : undefined,
            bottom: pop.side === 'above' ? -5 : undefined,
            width: 10, height: 10,
            background: colors.bgElevated,
            borderLeft: `1px solid ${colors.borderStrong}`,
            borderTop: `1px solid ${colors.borderStrong}`,
            transform: pop.side === 'below' ? 'rotate(45deg)' : 'rotate(225deg)',
          }} />
          <StepBody step={step} index={index} count={steps.length}
            isFirst={isFirst} isLast={isLast} onPrev={() => go(-1)}
            onNext={() => (isLast ? (onDone && onDone()) : go(1))}
            onSkip={onSkip} />
        </div>
      )}

      {/* Centered card for steps without a target, or when the target
          cannot be measured (e.g. explorer collapsed) so the tour never
          dead-ends with nothing on screen. */}
      {(!target || missing) && (
        <div style={{
          ...cardStyle,
          left: '50%', top: '42%',
          transform: `translate(-50%, -50%) ${visible ? 'translateY(0)' : 'translateY(8px)'}`,
          textAlign: 'center',
        }}>
          <StepBody step={step} index={index} count={steps.length}
            isFirst={isFirst} isLast={isLast} onPrev={() => go(-1)}
            onNext={() => (isLast ? (onDone && onDone()) : go(1))}
            onSkip={onSkip} />
        </div>
      )}
    </>
  )
}

function StepBody({ step, index, count, isFirst, isLast, onPrev, onNext, onSkip }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
      }}>
        <Icon name="sparkle" size={13} style={{ color: colors.accentWarm, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, flex: 1 }}>
          {step.title}
        </div>
        <button type="button" onClick={onSkip}
          style={{
            background: 'none', border: 'none', color: colors.textDim,
            cursor: 'pointer', fontSize: 11, padding: 2,
          }}>
          Skip
        </button>
      </div>
      <div style={{
        fontSize: 12, color: colors.textMuted, lineHeight: 1.55, marginBottom: 14,
      }}>
        {step.body}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: colors.textDim }}>
          {index + 1} / {count}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={onPrev} disabled={isFirst} aria-label="Previous tip"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
              background: 'none', border: 'none', color: colors.textMuted,
              opacity: isFirst ? 0.35 : 1,
            }}>
            <Icon name="chevron-left" size={14} />
          </button>
          <button type="button" onClick={onNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
              background: colors.accent, color: '#0B0F19', border: 'none',
              fontSize: 12, fontWeight: 600,
            }}>
            {isLast ? 'Done' : 'Next'}
            {!isLast && <Icon name="chevron-right" size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
}
