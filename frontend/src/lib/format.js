/** Display formatting helpers. Cosmetic layer only. */

export function relativeTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function wordCount(text) {
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning.'
  if (hour >= 12 && hour < 17) return 'Good afternoon.'
  if (hour >= 17 && hour < 21) return 'Good evening.'
  return 'Good night.'
}

/**
 * pickGreeting. Extends timeGreeting() with contextual observations from activity data.
 * All phrasing is observation, not notification: "Your sky has been quiet lately" ✓
 * "You haven't visited in 3 days!" ✗
 */
export function pickGreeting(stats, notes) {
  const timePart = timeGreeting()

  // No data yet, just time greeting
  if (!stats || !notes || notes.length === 0) return timePart

  const now = Date.now()
  const dayMs = 86400000
  const streak = stats.current_streak ?? 0

  // Notes visited in the last 7 days
  const recentCount = notes.filter(n => {
    const lv = new Date(n.last_visited || n.created_at).getTime()
    return (now - lv) < 7 * dayMs
  }).length

  // Most-visited note in the last 14 days
  const recentNotes = notes
    .filter(n => {
      const lv = new Date(n.last_visited || n.created_at).getTime()
      return (now - lv) < 14 * dayMs && (n.visit_count || 0) > 1
    })
    .sort((a, b) => (b.visit_count || 0) - (a.visit_count || 0))
  const brightNote = recentNotes[0]

  // Pick observation. One sentence that captures a feeling.
  let observation = 'The night holds what you seek.'

  if (recentCount === 0 && notes.length > 2) {
    observation = 'Your sky has been quiet lately.'
  } else if (streak >= 5) {
    observation = `A ${streak}-day constellation is forming.`
  } else if (streak >= 3) {
    observation = 'Your stars have been bright this week.'
  } else if (recentCount >= 3) {
    observation = `You revisited ${recentCount} stars recently.`
  } else if (brightNote && (brightNote.visit_count || 0) >= 5) {
    observation = `${brightNote.title} has been bright lately.`
  }

  return `${timePart} ${observation}`
}

export function bodyPreview(body, maxLen = 56) {
  if (!body || !body.trim()) return '(empty)'
  // Strip markdown syntax for preview. Headers, bold, italic, code, links.
  const stripped = body
    .replace(/^#{1,6}\s+/gm, '')        // # headers
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/`{1,3}[^`]*`{1,3}/g, m => m.replace(/`/g, '')) // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url)
    .replace(/^[-*+]\s+/gm, '')          // list bullets
    .replace(/^\d+\.\s+/gm, '')         // numbered lists
    .replace(/^>\s+/gm, '')              // blockquotes
  const line = stripped.replace(/\s+/g, ' ').trim()
  if (line.length <= maxLen) return line
  return `${line.slice(0, maxLen - 1)}…`
}
