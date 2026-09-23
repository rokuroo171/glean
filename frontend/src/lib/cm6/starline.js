import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { colors } from '../theme'

// Starlines render as chips while the buffer stays real text: away from the
// caret the [[ ]] brackets get opacity 0 (the only hide that keeps both the
// glyphs' layout width and Chromium caret motion), the title gets the chip
// class, and a click on the chip opens the target note. Caret strictly
// between the brackets brings the raw dim glyphs back for editing. A caret
// resting on a bracket edge still shows the chip, so typing ]] lands on a
// chip instead of a stuck raw pair

const STARLINE = /\[\[([^\[\]\n]+)\]\]/g

// Resolve a click position to a starline title. The search walks back to the
// line start, finds the last [[ before the caret, and accepts only a close
// within a bounded reach so a stray [[ never swallows a click far away
export function starlineAt(doc, pos) {
  let left = pos
  while (left > 0 && doc[left - 1] !== '\n') left--
  const text = doc.slice(left, pos)
  const open = text.lastIndexOf('[[')
  if (open < 0) return null
  const from = left + open + 2
  const close = doc.indexOf(']]', from)
  if (close < 0 || close > pos + 64) return null
  const title = doc.slice(from, close)
  if (!title || title.includes('\n')) return null
  return title
}

function decorationsFor(view, getNoteNames) {
  const head = view.state.selection.main.head
  const noteNames = getNoteNames() || {}
  const doc = view.state.doc.toString()
  const builder = new RangeSetBuilder()

  const decos = []
  STARLINE.lastIndex = 0
  for (let m; (m = STARLINE.exec(doc)); ) {
    const openStart = m.index
    const closeEnd = openStart + m[0].length
    if (head > openStart && head < closeEnd) {
      decos.push({ from: openStart, to: openStart + 2, spec: { class: 'glean-starline-raw' } })
      decos.push({ from: closeEnd - 2, to: closeEnd, spec: { class: 'glean-starline-raw' } })
      continue
    }
    const title = m[1]
    const exists = noteNames[title] != null
    // attributes.style, not a bare style field: mark specs ignore a top-level
    // style key, which would leave the brackets visibly raw
    decos.push({ from: openStart, to: openStart + 2, spec: { attributes: { style: 'opacity:0' } } })
    decos.push({ from: closeEnd - 2, to: closeEnd, spec: { attributes: { style: 'opacity:0' } } })
    decos.push({
      from: openStart + 2,
      to: closeEnd - 2,
      spec: {
        class: `glean-starline${exists ? '' : ' missing'}`,
        attributes: { 'data-tip': exists ? `Open ${title}` : `Create note ${title}` },
      },
    })
  }
  decos.sort((a, b) => a.from - b.from || a.to - b.to)
  for (const d of decos) {
    builder.add(d.from, d.to, Decoration.mark(d.spec))
  }
  return builder.finish()
}

// The click path, exported for direct testing since posAtCoords is geometry
// that unit tests cannot observe
export function chipClick(view, event, { getNoteNames, onNoteLink }) {
  const chip = event.target?.closest?.('.glean-starline')
  if (!chip) return false
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos == null) return false
  const title = starlineAt(view.state.doc.toString(), pos)
  if (!title) return false
  event.preventDefault()
  onNoteLink(title, getNoteNames()?.[title] ?? null)
  return true
}

export function starline({ getNoteNames, onNoteLink }) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = decorationsFor(view, getNoteNames)
      }
      update(update) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = decorationsFor(update.view, getNoteNames)
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(event, view) {
          return chipClick(view, event, { getNoteNames, onNoteLink })
        },
      },
    },
  )
  return plugin
}

// one shared stylesheet; the chip uses the theme accent token directly so it
// tracks theme switches without a rebuild
export const starlineTheme = EditorView.baseTheme({
  '.glean-starline': {
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    textUnderlineOffset: '3px',
  },
  '.glean-starline:hover': { textDecorationColor: 'currentColor' },
  '.glean-starline.missing': { opacity: 0.7, textDecorationStyle: 'dashed' },
  '.glean-starline-raw': { opacity: 0.55 },
})
