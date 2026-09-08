import { EditorState, Prec } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, placeholder, drawSelection,
  highlightActiveLine,
} from '@codemirror/view'
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
} from '@codemirror/commands'
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { highlightSelectionMatches } from '@codemirror/search'
import { colors } from './theme'
import { livePreviewField, taskClickPlugin } from './extensions/livePreview'
import { gleanKeymaps } from './extensions/keymaps'
import { freshField, animField, animSweeper } from './extensions/typedAnim'
import { strikethroughExtension } from './extensions/strikethrough'

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
    width: '100%',
    minWidth: '100%',
    boxSizing: 'border-box',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    overflowY: 'scroll',
    overflowX: 'auto',
    scrollbarGutter: 'stable',
    width: '100%',
    boxSizing: 'border-box',
  },
  '.cm-line': {
    padding: '0',
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
  // Live preview decoration classes
  // NOTE: fontSize is intentionally omitted from all decoration classes.
  // CM6 miscalculates line heights and caret positions when decorations
  // change the font size. Headings use fontWeight + color for distinction.
  '.glean-h1': { fontWeight: 800, color: colors.text },
  '.glean-h2': { fontWeight: 700, color: colors.text },
  '.glean-h3': { fontWeight: 700, color: colors.text },
  '.glean-h4': { fontWeight: 600, color: colors.text },
  '.glean-h5': { fontWeight: 600, color: colors.text },
  '.glean-h6': { fontWeight: 600, color: colors.textMuted },
  '.glean-bold': { fontWeight: 700 },
  '.glean-italic': { fontStyle: 'italic' },
  '.glean-strike': { textDecoration: 'line-through', opacity: 0.75 },
  '.glean-icode': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    backgroundColor: 'rgba(90, 106, 122, 0.18)',
    borderRadius: 4,
    padding: '0.5px 4px',
  },
  '.glean-link': {
    color: colors.accent,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  '.glean-image': { opacity: 0.55, fontStyle: 'italic' },
  '.glean-codeblock': {
    backgroundColor: 'rgba(90, 106, 122, 0.1)',
  },
  '.glean-quote': {
    background: `linear-gradient(to right, ${colors.borderStrong}, transparent 3px)` ,
    color: colors.textMuted,
  },
  '.glean-table-widget': {
    borderCollapse: 'collapse',
    width: '100%',
  },
  '.glean-table-widget th, .glean-table-widget td': {
    border: `1px solid ${colors.border}`,
    padding: '6px 10px',
    textAlign: 'left',
  },
  '.glean-table-widget th': {
    backgroundColor: 'rgba(91, 159, 212, 0.12)',
    fontWeight: 600,
  },
  '.glean-table-widget tbody tr:hover': {
    backgroundColor: 'rgba(180, 140, 80, 0.05)',
  },
  '.glean-tabledelim': { opacity: 0.35 },
  '.glean-hr': {
    borderTop: '1px solid rgba(90,106,122,0.3)',
    paddingTop: 16,
    paddingBottom: 16,
  },
  '.glean-tasktext': { opacity: 0.45 },
  '.glean-hide-markers .cm-line': {
    // Hide the first character (list marker) via CSS pseudo-element
  },
  // Aggressive hidden marker class - forces text invisible
  '.glean-hidden-mark': {
    visibility: 'hidden',
  },
  '.tok-listmark, .glean-hidden-marker': {
    visibility: 'hidden',
    fontSize: 0,
    width: 0,
    display: 'none',
  },
  '.glean-taskbox': { display: 'inline-flex', alignItems: 'center', margin: '0 3px' },
  '.glean-taskbox input': {
    width: 14, height: 14, accentColor: colors.accent, cursor: 'pointer',
  },
  // Callout styles are handled by CalloutWidget (inline styles for GitHub match)
  '.glean-anim': { animation: 'glean-char-fade 0.35s ease-out' },
  '.glean-math': {
    padding: '8px',
  },
  '.glean-math .katex-display': {
    margin: '8px 0',
    overflow: 'auto',
  },
  '.glean-mermaid': {
    padding: '12px',
    background: 'rgba(90, 106, 122, 0.05)',
    borderRadius: 6,
    border: '1px solid rgba(90, 106, 122, 0.1)',
  },
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
      markdown({ base: markdownLanguage, extensions: [strikethroughExtension()] }),
      history(),
      drawSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      // No defaultHighlightStyle: decorations handle all markdown styling.
      // This removes underlines, syntax colors, and other ugly CM6 defaults.
      indentUnit.of(' '.repeat(prefs?.editor?.tab_width || 2)),
      EditorState.tabSize.of(prefs?.editor?.tab_width || 2),
      prefs?.editor?.line_numbers ? lineNumbers() : [],
      placeholder('Write, the night holds what you seek.'),
      EditorView.lineWrapping,
      gleanTheme,
      animStyle,
      livePreviewField,
      taskClickPlugin,
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