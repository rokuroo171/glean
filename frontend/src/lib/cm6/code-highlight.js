import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { colors } from '../theme'

// Token colors for code inside fences. The palette is glean's: keywords and
// headings carry the accent, strings warm gold, comments sink to muted,
// numbers to a soft violet. Mounted only on fenced code through the fence
// wrapper below, so markdown prose keeps the plain text face

export const gleanHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#5a6c80', fontStyle: 'italic' },
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: colors.accent },
  { tag: [t.string, t.special(t.string)], color: '#ffb366' },
  { tag: [t.number, t.bool, t.null], color: '#b08cff' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#6aabff' },
  { tag: [t.definition(t.variableName)], color: '#e8eaed' },
  { tag: [t.typeName, t.className, t.tagName], color: '#66c2a6' },
  { tag: [t.propertyName, t.attributeName], color: '#9fc4e8' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#8a9aa8' },
  { tag: [t.meta, t.processingInstruction, t.annotation], color: '#6a7a8a' },
  { tag: t.invalid, color: '#db4c40' },
])

// the markdown() language already nests code languages inside FencedCode
// through codeLanguages; this extension just carries the token colors, and
// editor.js mounts it so only code text picks them up
export const gleanSyntaxHighlighting = syntaxHighlighting(gleanHighlightStyle)
