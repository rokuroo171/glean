import { EditorState, Compartment, Transaction } from '@codemirror/state'
import {
  EditorView, keymap, drawSelection, dropCursor, rectangularSelection,
  crosshairCursor, highlightSpecialChars, lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, undoDepth, redoDepth } from '@codemirror/commands'
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search'
import { starline, starlineTheme } from './starline'
import { blocks, blocksTheme } from './blocks'
import { reveal, revealTheme } from './reveal'
import { gleanKeymap, modKeymap, gleanIndentUnit, fenceKeymap } from './keymaps'
import { widgets, widgetAtomic, blockWidgets, widgetsTheme } from './widgets'
import { linkTips, linkHandlers, linksTheme } from './links'
import { highlight, highlightTheme } from './highlight'
import { images, imagesTheme } from './images'
import { footnotes, footnoteHandlers, footnotesTheme } from './footnotes'
import { tableKeymap } from './tables'
import { htmlPairs, htmlPairsTheme } from './html'

// One renderer, one truth: the buffer holds the file's markdown bytes and
// nothing in this module ever rewrites them outside a dispatched transaction

export const styleCompartment = new Compartment()
export const wrapCompartment = new Compartment()
export const sepCompartment = new Compartment()
export const gutterCompartment = new Compartment()

// The file's bytes, whatever line endings it holds. CRLF documents configure
// state.lineSeparator so CM6 splits and joins on \r\n throughout; the emit
// path uses sliceDoc which honors it. toString() always joins \n and must
// never be used for the file payload
export function emitMarkdown(view) {
  return view.state.sliceDoc()
}

// CM6 splits the doc on one configured separator. Picking the file's own
// separator at load time keeps CRLF notes byte-true; LF notes use the default
export function lineSeparatorFor(md) {
  return md.includes('\r\n') ? EditorState.lineSeparator.of('\r\n') : []
}

// Visual line numbers: one number per wrapped line, from the view's own
// layout. The gutter is compartmentalized so the pref toggles it live
export function editorTheme(fontFamily, fontSize, lineHeight) {
  // The scroller carries the type prefs, not just the root: the base theme
  // sets font-family and line-height on .cm-scroller at equal specificity,
  // and rules mounted later win, so a root-only rule never reached the text
  const type = {
    fontFamily: fontFamily || 'inherit',
    fontSize: `${fontSize || 14}px`,
    lineHeight: lineHeight || 1.6,
  }
  return EditorView.theme({
    '&': {
      color: 'inherit',
      ...type,
      height: '100%',
      background: 'transparent',
    },
    '.cm-scroller': {
      ...type,
      overflowY: 'auto',
      overflowX: 'hidden',
    },
    '.cm-content': { caretColor: 'currentColor', paddingBottom: '30vh' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': {
      background: 'transparent',
      border: 'none',
      color: '#4a5a6a',
      fontSize: '11px',
      paddingLeft: '2px',
    },
  })
}

export function createEditor({
  parent,
  markdown: initialMarkdown,
  onMarkdownChange,
  onSelectionChange,
  wrap = true,
  style = {},
  starline: starlineOpts = null,
  livePreview = true,
}) {
  const emit = (view) => {
    if (onMarkdownChange) onMarkdownChange(emitMarkdown(view))
  }

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) emit(update.view)
    if ((update.selectionSet || update.docChanged) && onSelectionChange) {
      const head = update.state.selection.main.head
      onSelectionChange(null, { head })
    }
  })

  const state = EditorState.create({
    doc: initialMarkdown,
    extensions: [
      sepCompartment.of(lineSeparatorFor(initialMarkdown)),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      blockWidgets,
      search({ top: true }),
      highlightSelectionMatches(),
      markdown({ base: markdownLanguage, indentUnit: gleanIndentUnit }),
      keymap.of(markdownKeymap),
      keymap.of(fenceKeymap),
      keymap.of(tableKeymap),
      keymap.of(gleanKeymap),
      keymap.of(searchKeymap),
      keymap.of(modKeymap),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      ...(livePreview ? [blocks, blocksTheme, reveal, revealTheme, widgets, widgetAtomic, widgetsTheme, highlight, highlightTheme, images, imagesTheme, footnotes, footnoteHandlers, footnotesTheme, htmlPairs, htmlPairsTheme] : []),
      ...(starlineOpts ? [starline(starlineOpts), starlineTheme] : []),
      ...(livePreview ? [linkTips, linkHandlers, linksTheme] : []),
      gutterCompartment.of(style.line_numbers ? lineNumbers() : []),
      styleCompartment.of(editorTheme(style.fontFamily, style.fontSize, style.lineHeight)),
      wrapCompartment.of(wrap ? EditorView.lineWrapping : []),
      updateListener,
    ],
  })

  return new EditorView({ state, parent })
}

// Note loads and external reloads ride outside undo history so Ctrl+Z after a
// switch can never pour one note's content into another
export function loadMarkdown(view, md, { history: withHistory = false } = {}) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: md },
    effects: sepCompartment.reconfigure(lineSeparatorFor(md)),
    annotations: Transaction.addToHistory.of(withHistory),
  })
}

export function histState(view) {
  return { canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 }
}
