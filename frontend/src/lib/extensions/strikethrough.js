/**
 * GFM Strikethrough extension for CodeMirror 6.
 *
 * Adds `~~text~~` as a parsed `Strikethrough` node type so the live
 * preview decorations can style it and hide the `~~` delimiters.
 */
import { tags } from '@lezer/highlight'

export const StrikethroughTag = tags.strikethrough

/**
 * Inline parser that recognizes `~~...~~` (double tilde) strikethrough.
 * Single `~` is NOT parsed (strict GFM).
 */
export const strikethroughParser = {
  name: 'Strikethrough',
  token(view, chain) {
    const pos = view.pos
    const ch = view.sliceDoc(pos, pos + 2)
    if (ch !== '~~') return false

    // Find closing ~~
    const closePos = view.sliceDoc(pos + 2).indexOf('~~')
    if (closePos < 0) return false

    // Must have content between the delimiters
    if (closePos === 0) return false

    const from = pos
    const to = pos + 2 + closePos + 2 // include closing ~~

    chain
      .enter('Strikethrough', from, 1)
      .addNode('StrikethroughMark', from, from + 2)
      .eat(to)
      .addNode('StrikethroughMark', to - 2, to)
      .leave()
    return true
  }
}

/**
 * Syntax extension that adds the strikethrough inline parser
 * and the node type to the markdown language.
 */
export function strikethroughExtension() {
  return {
    defineNodes: [
      { name: 'Strikethrough', group: 'Inline' },
      { name: 'StrikethroughMark', group: 'Inline' },
    ],
    parseInline: [strikethroughParser],
  }
}
