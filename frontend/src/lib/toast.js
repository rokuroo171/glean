// App-wide toast store, no dependencies. Behavior contract follows the
// sonner reference: newest toast at the bottom of a bottom-right stack,
// three visible at once (oldest starts leaving beyond that), hover pauses
// the timer, toasts carrying actions live longer than plain ones, an id
// dedupes (re-firing replaces the open toast instead of stacking), any
// button press closes the toast, and leaving toasts animate out
import { colors } from './theme'

export const TOAST_VARIANTS = {
  info: { dot: colors.accent },
  success: { dot: '#66cc99' },
  error: { dot: colors.danger },
}

const DEFAULT_DURATION = 4000
const ACTION_DURATION = 8000
const MAX_VISIBLE = 3
const LEAVE_MS = 160

let toasts = []
const listeners = new Set()
const timers = new Map()
let nextId = 1

function emit() {
  for (const fn of listeners) fn()
}

function schedule(id, duration) {
  clearTimer(id)
  const t = toasts.find((x) => x.id === id)
  if (!t) return
  t.remaining = duration
  t.startedAt = Date.now()
  timers.set(id, setTimeout(() => dismiss(id), duration))
}

function clearTimer(id) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function remove(id) {
  clearTimer(id)
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function dismiss(id) {
  const t = toasts.find((x) => x.id === id)
  if (!t || t.leaving) return
  clearTimer(id)
  t.leaving = true
  emit()
  timers.set(id, setTimeout(() => remove(id), LEAVE_MS))
}

export function pause(id) {
  const t = toasts.find((x) => x.id === id)
  const timer = timers.get(id)
  if (!t || t.leaving || !timer) return
  clearTimeout(timer)
  timers.delete(id)
  t.remaining -= Date.now() - t.startedAt
}

export function resume(id) {
  const t = toasts.find((x) => x.id === id)
  if (!t || t.leaving) return
  schedule(id, Math.max(t.remaining, 400))
}

function add(title, opts) {
  const { id = `toast-${nextId++}`, description, variant = 'info',
    action, cancel, duration = action ? ACTION_DURATION : DEFAULT_DURATION } = opts || {}
  const existing = toasts.find((t) => t.id === id)
  if (existing) {
    clearTimer(id)
    toasts = toasts.filter((t) => t.id !== id)
  }
  toasts = [...toasts, { id, title, description, variant, action, cancel, duration, remaining: duration, startedAt: Date.now(), leaving: false }]
  const visible = toasts.filter((t) => !t.leaving)
  if (visible.length > MAX_VISIBLE) dismiss(visible[0].id)
  emit()
  schedule(id, duration)
  return id
}

export const toast = (title, opts) => add(title, opts)
toast.success = (title, opts) => add(title, { ...opts, variant: 'success' })
toast.error = (title, opts) => add(title, { ...opts, variant: 'error' })
toast.dismiss = dismiss
toast.pause = pause
toast.resume = resume

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getToasts() {
  return toasts
}
