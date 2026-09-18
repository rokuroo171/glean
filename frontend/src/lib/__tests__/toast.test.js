import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast, subscribe, getToasts, dismiss, pause, resume } from '../toast'

const snap = () => getToasts().map((t) => ({ id: t.id, title: t.title, variant: t.variant, leaving: t.leaving }))

describe('toast store', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    for (const t of getToasts()) dismiss(t.id)
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
  })

  it('adds, auto-dismisses after the duration, then removes after the leave window', () => {
    toast('hello', { duration: 1000 })
    expect(getToasts()).toHaveLength(1)
    expect(getToasts()[0].leaving).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(getToasts()[0].leaving).toBe(true)
    vi.advanceTimersByTime(200)
    expect(getToasts()).toHaveLength(0)
  })

  it('success and error set their variants', () => {
    toast.success('ok')
    toast.error('bad')
    const s = snap()
    expect(s[0].variant).toBe('success')
    expect(s[1].variant).toBe('error')
  })

  it('dedupes by id, replacing the open toast instead of stacking', () => {
    toast('first', { id: 'conflict', duration: 5000 })
    toast('second', { id: 'conflict', duration: 5000 })
    const all = getToasts()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('second')
    expect(all[0].remaining).toBe(5000)
  })

  it('pauses the timer on hover and resumes with the remainder', () => {
    toast('hover me', { duration: 1000 })
    vi.advanceTimersByTime(400)
    pause(getToasts()[0].id)
    vi.advanceTimersByTime(5000)
    expect(getToasts()[0].leaving).toBe(false)
    resume(getToasts()[0].id)
    vi.advanceTimersByTime(300)
    expect(getToasts()[0].leaving).toBe(false)
    vi.advanceTimersByTime(350)
    expect(getToasts()[0].leaving).toBe(true)
    vi.advanceTimersByTime(200)
    expect(getToasts()).toHaveLength(0)
  })

  it('keeps action toasts longer than plain ones', () => {
    toast('plain')
    toast('with action', { action: { label: 'Do', onClick: () => {} } })
    expect(getToasts()[0].duration).toBe(4000)
    expect(getToasts()[1].duration).toBe(8000)
  })

  it('dismisses the oldest visible toast beyond the stack cap', () => {
    for (let i = 0; i < 5; i++) toast(`t${i}`, { duration: 30000 })
    const s = snap()
    expect(s).toHaveLength(5)
    expect(s.filter((t) => t.leaving).map((t) => t.title)).toEqual(['t0', 't1'])
    expect(s.filter((t) => !t.leaving).map((t) => t.title)).toEqual(['t2', 't3', 't4'])
  })

  it('notifies subscribers on every state change', () => {
    const seen = []
    const unsub = subscribe(() => seen.push(getToasts().length))
    toast('sub')
    dismiss(getToasts()[0].id)
    vi.advanceTimersByTime(200)
    unsub()
    expect(seen[0]).toBe(1)
    expect(seen[1]).toBe(1)
    expect(seen[2]).toBe(0)
  })
})

