import Prism from 'prismjs'

// Curated language set for note-taking. Import order matters:
// jsx clones `javascript`, tsx clones `jsx`, so bases must load first.
import 'prismjs/components/prism-markup.js'      // html, xml, svg
import 'prismjs/components/prism-clike.js'        // base for c-family
import 'prismjs/components/prism-javascript.js'   // js
import 'prismjs/components/prism-css.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-jsx.js'
import 'prismjs/components/prism-typescript.js'   // ts
import 'prismjs/components/prism-tsx.js'
import 'prismjs/components/prism-bash.js'         // bash, sh, shell
import 'prismjs/components/prism-python.js'       // py
import 'prismjs/components/prism-go.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-rust.js'
import 'prismjs/components/prism-yaml.js'         // yml
import 'prismjs/components/prism-markdown.js'     // md
import 'prismjs/components/prism-diff.js'
import 'prismjs/components/prism-c.js'
import 'prismjs/components/prism-cpp.js'
import 'prismjs/components/prism-java.js'
import 'prismjs/components/prism-ruby.js'
import 'prismjs/components/prism-markup-templating.js' // required by php (tokenizePlaceholders)
import 'prismjs/components/prism-php.js'
import 'prismjs/components/prism-toml.js'
import 'prismjs/components/prism-ini.js'
import 'prismjs/components/prism-http.js'
import 'prismjs/components/prism-docker.js'

/**
 * Highlight code with Prism. Returns an HTML string of token spans,
 * or null when the language is unknown (caller renders plain text).
 * @param {string} code
 * @param {string} lang - fenced code language id, e.g. "js", "python"
 */
export function highlightCode(code, lang) {
  const grammar = Prism.languages[lang]
  if (!grammar) return null
  try {
    return Prism.highlight(code, grammar, lang)
  } catch {
    return null
  }
}