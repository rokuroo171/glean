import { useState, useEffect } from 'react'

/**
 * Hook that returns true when the user prefers reduced motion.
 * Wraps matchMedia safely for SSR/client hydration.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

/**
 * Returns initial/animate/exit props that respect reduced motion.
 * When reduced: opacity-only fade, no transforms.
 * When normal: subtle slide-up + fade.
 */
export function useSafeMotion(distance = 16) {
  const reduce = useReducedMotion()
  return {
    initial: { opacity: 0, y: reduce ? 0 : distance },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: reduce ? 0 : -distance },
  }
}
