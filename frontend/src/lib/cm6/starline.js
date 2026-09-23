import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { colors } from '../theme'

// Starlines render as chips while the buffer stays real text: away from the
// caret the [[ ]] brackets collapse to zero width via Decoration.replace and
// are registered atomic so arrows step over them instead of parking inside,
// the title gets the chip class, and a click on the chip opens the target
// note. Caret strictly between the brackets brings the raw dim glyphs back
// for editing. A caret resting on a bracket edge still shows the chip, so
// typing ]] lands on a chip instead of a stuck raw pair. The PM-era opacity
// hide does not carry over: CM6 caret motion is buffer-position based, so
// the honest hide is replace + atomicRanges and opacity leaves phantom
// layout width behind

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
  const doc = view.state.doc
  const text = doc.toString()

  const marks = []
  const replaces = []
  const atomic = []

  STARLINE.lastIndex = 0
  for (let m; (m = STARLINE.exec(text)); ) {
    const openStart = m.index
    const closeEnd = openStart + m[0].length
    if (head > openStart && head < closeEnd) {
      marks.push({ from: openStart, to: openStart + 2, spec: { class: 'glean-starline-raw' } })
      marks.push({ from: closeEnd - 2, to: closeEnd, spec: { class: 'glean-starline-raw' } })
      continue
    }
    const title = m[1]
    const exists = noteNames[title] != null
    replaces.push({ from: openStart, to: openStart + 2 })
    replaces.push({ from: closeEnd - 2, to: closeEnd })
    atomic.push({ from: openStart, to: openStart + 2 })
    atomic.push({ from: closeEnd - 2, to: closeEnd })
    marks.push({
      from: openStart + 2,
      to: closeEnd - 2,
      spec: {
        class: `glean-starline${exists ? '' : ' missing'}`,
        attributes: { 'data-tip': exists ? `Open ${title}` : `Create note ${title}` },
      },
    })
  }

  marks.sort((a, b) => a.from - b.from || a.to - b.to)
  const markBuilder = new RangeSetBuilder()
  for (const d of marks) markBuilder.add(d.from, d.to, Decoration.mark(d.spec))

  replaces.sort((a, b) => a.from - b.from || a.to - b.to)
  const replaceBuilder = new RangeSetBuilder()
  for (const r of replaces) replaceBuilder.add(r.from, r.to, Decoration.replace({}))

  atomic.sort((a, b) => a.from - b.from || a.to - b.to)
  const atomicBuilder = new RangeSetBuilder()
  for (const r of atomic) atomicBuilder.add(r.from, r.to, Decoration.replace({}))

  return { marks: markBuilder.finish(), hidden: replaceBuilder.finish(), atomic: atomicBuilder.finish() }
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
        const b = decorationsFor(view, getNoteNames)
        this.marks = b.marks
        this.hidden = b.hidden
        this.atomic = b.atomic
      }
      update(update) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          const b = decorationsFor(update.view, getNoteNames)
          this.marks = b.marks
          this.hidden = b.hidden
          this.atomic = b.atomic
        }
      }
    },
    {
      decorations: (v) => v.marks,
      provide: (plugin) => [
        EditorView.decorations.of((view) => {
          const inst = view.plugin(plugin)
          return inst ? inst.hidden : Decoration.none
        }),
        EditorView.atomicRanges.of((view) => {
          const inst = view.plugin(plugin)
          return inst ? inst.atomic : Decoration.none
        }),
      ],
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
