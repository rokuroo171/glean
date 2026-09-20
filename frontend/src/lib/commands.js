// Scores one haystack against the query. Higher wins, -1 means no match.
// Prefix beats word start beats substring beats in-order subsequence.
function scoreText(haystack, q) {
  const idx = haystack.indexOf(q)
  if (idx === 0) return 100
  if (idx > 0) return haystack[idx - 1] === ' ' ? 90 : 70
  let hi = 0
  for (let qi = 0; qi < q.length; qi++) {
    hi = haystack.indexOf(q[qi], hi)
    if (hi === -1) return -1
    hi++
  }
  return 50
}

// Filters palette items against the query, best match first. An item
// matches on its label or any keyword; an empty query keeps input order.
export function filterCommands(items, query) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  const scored = []
  for (const item of items) {
    let best = scoreText(item.label.toLowerCase(), q)
    for (const kw of item.keywords || []) {
      best = Math.max(best, scoreText(kw.toLowerCase(), q) - 5)
    }
    if (best > 0) scored.push({ item, best })
  }
  scored.sort((a, b) => b.best - a.best)
  return scored.map((s) => s.item)
}
