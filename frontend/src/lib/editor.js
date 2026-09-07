import { EditorState, Prec } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, placeholder, drawSelection,
  highlightActiveLine,
} from '@codemirror/view'
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
} from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from '@codemirror/language'
import { highlightSelectionMatches } from '@codemirror/search'
import { colors } from './theme'
import { gleanKeymaps } from './extensions/keymaps'
import { freshField, animField, animSweeper } from './extensions/typedAnim'

// The glean editor theme: tokens from theme.js, dark scheme.
const gleanTheme = EditorView.theme({
  '&': {
    color: colors.text,
    backgroundColor: 'transparent',
    height: '100%',
    fontSize: '14px',
  },
  '.cm-content': {
    fontFamily: 'inherit',
    lineHeight: '1.6',
    padding: '12px 16px',
    caretColor: colors.text,
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    overflow: 'auto',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor': {
    borderLeftColor: colors.text,
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(91, 159, 212, 0.28)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(180, 140, 80, 0.05)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: colors.textDim,
    border: 'none',
    borderRight: `1px solid ${colors.border}`,
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 8px',
    minWidth: 30,
  },
  '.cm-placeholder': {
    color: colors.textDim,
    fontStyle: 'italic',
  },
  // Override defaultHighlightStyle heading underlines
  '.tok-heading1, .tok-heading2, .tok-heading3, .tok-heading4, .tok-heading5, .tok-heading6': {
    textDecoration: 'none',
  },
  '.glean-anim': { animation: 'glean-char-fade 0.35s ease-out' },
}, { dark: true })

// Keyframes for the animated typing effect, injected once.
const animStyle = EditorView.baseTheme({
  '@keyframes glean-char-fade': {
    '0%': { opacity: 0, transform: 'translateY(-4px)' },
    '60%': { opacity: 1, transform: 'translateY(0)' },
    '100%': { opacity: 1, transform: 'translateY(0)' },
  },
})

/**
 * Build a CodeMirror 6 editor bound to the given prefs and callbacks.
 * callbacks:
 *   onBodyChange(newBody)
 *   onCursorChange({line, col})
 *   onDelete(pos)        // a deletion happened at this doc position
 *   save()               // Ctrl+S
 *   openFind()           // Ctrl+F
 *   openReplace()        // Ctrl+H
 *   openImage()          // Ctrl+Shift+I
 *   onPasteImage(file)   // image pasted from the clipboard
 *   onDropImage(file, pos) // image dropped at a doc position
 *   onHistoryChange()    // undo/redo depth may have changed
 */
export function createGleanView({ parent, doc, prefs, callbacks }) {
  const prefsRef = { current: prefs }
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({ base: markdownLanguage }),
      history(),
      drawSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      indentUnit.of(' '.repeat(prefs?.editor?.tab_width || 2)),
      EditorState.tabSize.of(prefs?.editor?.tab_width || 2),
      prefs?.editor?.line_numbers ? lineNumbers() : [],
      placeholder('Write, the night holds what you seek.'),
      gleanTheme,
      animStyle,
      freshField,
      animField,
      animSweeper,
      // Image paste/drop are intercepted at the content DOM level so
      // CM6's default text insertion never runs first.
      EditorView.domEventHandlers({
        paste(event, view) {
          const items = (event.clipboardData && event.clipboardData.items) || []
          const img = Array.from(items).find(it => it.kind === 'file' && it.type && it.type.startsWith('image/'))
          if (img) {
            event.preventDefault()
            const file = img.getAsFile()
            if (file && callbacks.onPasteImage) callbacks.onPasteImage(file)
            return true
          }
          return false
        },
        drop(event, view) {
          const files = event.dataTransfer && event.dataTransfer.files
          if (!files || files.length === 0) return false
          const img = Array.from(files).find(f => f && f.type && f.type.startsWith('image/'))
          if (img && callbacks.onDropImage) {
            event.preventDefault()
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            callbacks.onDropImage(img, pos != null ? pos : view.state.selection.main.head)
            return true
          }
          return false
        },
      }),
      // Glean keymaps must win over the defaults for Tab, Enter,
      // Backspace, and the formatting shortcuts.
      Prec.high(gleanKeymaps(prefsRef, callbacks)),
      keymap.of([...defaultKeymap, ...historyKeymap, ...markdownKeymap, indentWithTab]),
      EditorView.updateListener.of(update => {
        if (update.docChanged && callbacks.onBodyChange) {
          callbacks.onBodyChange(update.state.doc.toString())
        }
        if (update.selectionSet && callbacks.onCursorChange) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          callbacks.onCursorChange({ line: line.number, col: head - line.from + 1 })
        }
        if (update.docChanged && callbacks.onDelete) {
          update.changes.iterChanges((fromA, toA, fromB) => {
            if (toA > fromA && toA - fromA <= 400) callbacks.onDelete(fromB)
          })
        }
        if ((update.docChanged || update.selectionSet) && callbacks.onHistoryChange) {
          callbacks.onHistoryChange()
        }
      }),
    ],
  })
  return new EditorView({ state, parent })
}

export { EditorView }