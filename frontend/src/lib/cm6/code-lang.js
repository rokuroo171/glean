// Fence info string -> display language. The common aliases spell the
// proper name; anything not listed but known to the codeLanguages registry
// resolves through its own name; a totally unknown word just capitalizes,
// so README fence tags never render a wrong label

const NAMES = {
  js: 'JavaScript', javascript: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JSX',
  ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', rb: 'Ruby', ruby: 'Ruby',
  sh: 'Shell', bash: 'Bash', zsh: 'Zsh', shell: 'Shell', console: 'Console',
  yml: 'YAML', yaml: 'YAML', json: 'JSON', json5: 'JSON5', toml: 'TOML',
  html: 'HTML', xml: 'XML', svg: 'SVG', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
  md: 'Markdown', markdown: 'Markdown', mdx: 'MDX',
  sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
  c: 'C', h: 'C Header', cpp: 'C++', 'c++': 'C++', cxx: 'C++', cc: 'C++',
  hpp: 'C++ Header', cs: 'C#', 'c#': 'C#', csharp: 'C#',
  java: 'Java', kt: 'Kotlin', kotlin: 'Kotlin', kts: 'Kotlin',
  go: 'Go', golang: 'Go', rust: 'Rust', rs: 'Rust',
  swift: 'Swift', dart: 'Dart', scala: 'Scala', groovy: 'Groovy',
  php: 'PHP', pl: 'Perl', perl: 'Perl', lua: 'Lua',
  r: 'R', jl: 'Julia', julia: 'Julia', matlab: 'MATLAB',
  hs: 'Haskell', haskell: 'Haskell', elm: 'Elm', ex: 'Elixir', elixir: 'Elixir',
  erl: 'Erlang', erlang: 'Erlang', clj: 'Clojure', clojure: 'Clojure',
  vim: 'Vim', asm: 'Assembly', nasm: 'NASM', wat: 'WebAssembly', wasm: 'WebAssembly',
  dockerfile: 'Dockerfile', docker: 'Dockerfile', makefile: 'Makefile',
  ini: 'INI', cfg: 'Config', conf: 'Config', env: 'DotEnv',
  diff: 'Diff', patch: 'Diff', gitignore: 'Git Ignore',
  tex: 'TeX', latex: 'LaTeX', rst: 'reStructuredText',
  objc: 'Objective-C', 'obj-c': 'Objective-C', fsharp: 'F#', 'f#': 'F#',
  vb: 'Visual Basic', pas: 'Pascal', fortran: 'Fortran', cobol: 'COBOL',
  ps1: 'PowerShell', powershell: 'PowerShell', bat: 'Batch', cmd: 'Batch',
  sed: 'sed', awk: 'AWK', regex: 'Regex',
  nanopass: 'Nanopass', sol: 'Solidity', solidity: 'Solidity',
  svelte: 'Svelte', vue: 'Vue', astro: 'Astro',
}

// aliases the CM6 registry knows under different spellings; checked before
// the table so e.g. "golang" still resolves even if the registry says "go"
const REGISTRY_ALIASES = {
  clike: 'C-like', cmake: 'CMake', crystal: 'Crystal', d: 'D',
  erlang: 'Erlang', fortran: 'Fortran', fsharp: 'F#',
  'html+erb': 'HTML+ERB', octave: 'Octave', prolog: 'Prolog',
  protobuf: 'Protocol Buffers', smalltalk: 'Smalltalk', sql: 'SQL',
  vbnet: 'VB.NET', verilog: 'Verilog', vhdl: 'VHDL', zig: 'Zig',
}

export function fenceLanguageName(info) {
  if (!info) return null
  const word = info.trim().split(/\s+/)[0].toLowerCase()
  if (!word) return null
  if (NAMES[word]) return NAMES[word]
  if (REGISTRY_ALIASES[word]) return REGISTRY_ALIASES[word]
  // unknown word: title-case it, so "mylang" renders "Mylang" rather than
  // pretending to know a name glean does not have
  return word.charAt(0).toUpperCase() + word.slice(1)
}
