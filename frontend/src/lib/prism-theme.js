/**
 * Prism token theme mapped onto glean's CSS custom properties so code
 * highlighting adapts to every theme preset (midnight, paper, catppuccin, ...).
 * Injected once in main.jsx.
 */
export const prismThemeCss = `
code[class*="language-"],
pre[class*="language-"] {
  text-shadow: none;
}

.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: var(--text-dim);
  font-style: italic;
}

.token.punctuation {
  color: var(--text-muted);
}

.token.keyword,
.token.atrule,
.token.attr-value,
.token.important {
  color: var(--accent-warm);
}

.token.string,
.token.char,
.token.builtin,
.token.inserted,
.token.attr-value {
  color: var(--accent);
}

.token.number,
.token.boolean,
.token.constant,
.token.symbol,
.token.deleted {
  color: var(--star-hot);
}

.token.function {
  color: var(--star-cool);
}

.token.class-name,
.token.variable,
.token.regex {
  color: var(--star-purple);
}

.token.property,
.token.attr-name,
.token.selector {
  color: var(--star-cool);
}

.token.tag {
  color: var(--star-hot);
}

.token.operator,
.token.entity,
.token.url {
  color: var(--text-muted);
}

.token.bold {
  font-weight: 600;
}

.token.italic {
  font-style: italic;
}
`