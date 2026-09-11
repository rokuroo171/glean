// Verifies the syntax reveal plugin in plain node against a schema shaped
// like milkdown's (node and mark names match the real editor schema)
// Run with: node scripts/verify-syntax-reveal.mjs
import { EditorState, TextSelection } from 'prosemirror-state'
import { Schema } from 'prosemirror-model'
import { syntaxReveal } from '../src/lib/extensions/syntaxReveal.js'

// The plugin builds widget DOM on demand, give it a bare object to fill
globalThis.document = {
  createElement: () => ({ setAttribute() {}, style: {} }),
}

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    bullet_list: { group: 'block', content: 'list_item+' },
    ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 } } },
    list_item: { content: 'paragraph block*' },
    code_block: { group: 'block', content: 'text*', marks: '' },
    text: { group: 'inline' },
  },
  marks: {
    strong: {},
    emphasis: {},
    inlineCode: {},
    strike_through: {},
    link: { attrs: { href: { default: '' } } },
  },
})

const plugin = syntaxReveal()

function stateWith(doc, caret) {
  return EditorState.create({
    doc,
    plugins: [plugin],
    selection: TextSelection.create(doc, caret),
  })
}

function revealedMarks(state) {
  const set = plugin.getState(state)
  if (!set) return []
  return set.find().map((deco) => {
    const el = deco.type.toDOM()
    return { pos: deco.from, text: el.textContent }
  })
}

let failures = 0
function expect(name, actual, want) {
  const a = JSON.stringify(actual)
  const w = JSON.stringify(want)
  if (a === w) {
    console.log(`ok   ${name}`)
  } else {
    failures++
    console.log(`FAIL ${name}`)
    console.log(`  want: ${w}`)
    console.log(`  got:  ${a}`)
  }
}

const { heading, paragraph, blockquote, bullet_list, ordered_list, code_block } = schema.nodes
const { strong, emphasis, inlineCode, strike_through: strike, link } = schema.marks
const t = (text, marks) => schema.text(text, marks)

// heading reveal and escape
{
  const doc = schema.nodes.doc.create(null, [
    heading.create({ level: 1 }, t('Hello world')),
    paragraph.create(null, t('second')),
  ])
  const inside = stateWith(doc, 4)
  const marks = revealedMarks(inside)
  expect('heading prefix at caret inside h1', marks, [{ pos: 0, text: '# ' }])
  const styled = inside.doc.child(0).type.name
  expect('heading node unchanged', styled, 'heading')

  const outside = stateWith(doc, 17)
  expect('heading prefix gone outside h1', revealedMarks(outside), [])

  const doc2 = schema.nodes.doc.create(null, [heading.create({ level: 2 }, t('Two'))])
  expect('h2 gets two hashes', revealedMarks(stateWith(doc2, 2)), [{ pos: 0, text: '## ' }])
}

// inline mark pairs
{
  const doc = schema.nodes.doc.create(null, [
    paragraph.create(null, [
      t('plain '),
      t('bold', [strong.create()]),
      t(' it ', [emphasis.create()]),
      t('code', [inlineCode.create()]),
      t(' gone', [strike.create()]),
      t(' here', [link.create({ href: 'https://x.y' })]),
    ]),
  ])
  // paragraph 0..27 content 25 chars: plain(6) bold(4) ' it '(4) code(4) ' gone'(5) ' here'(5)
  // positions are doc absolute: paragraph content starts at 1
  const strongState = stateWith(doc, 8)
  expect('bold pair around caret', revealedMarks(strongState), [
    { pos: 7, text: '**' },
    { pos: 11, text: '**' },
  ])

  const emState = stateWith(doc, 12)
  expect('emphasis pair around caret', revealedMarks(emState), [
    { pos: 11, text: '*' },
    { pos: 15, text: '*' },
  ])

  const codeState = stateWith(doc, 16)
  expect('code pair around caret', revealedMarks(codeState), [
    { pos: 15, text: '`' },
    { pos: 19, text: '`' },
  ])

  const strikeState = stateWith(doc, 20)
  expect('strike pair around caret', revealedMarks(strikeState), [
    { pos: 19, text: '~~' },
    { pos: 24, text: '~~' },
  ])

  const linkState = stateWith(doc, 26)
  expect('link brackets with href around caret', revealedMarks(linkState), [
    { pos: 24, text: '[' },
    { pos: 29, text: '](https://x.y)' },
  ])

  const outsideState = stateWith(doc, 2)
  expect('no inline marks away from caret', revealedMarks(outsideState), [])
}

// blockquote prefix
{
  const doc = schema.nodes.doc.create(null, [
    blockquote.create(null, paragraph.create(null, t('quoted'))),
  ])
  expect('blockquote prefix', revealedMarks(stateWith(doc, 4)), [{ pos: 0, text: '> ' }])
}

// list prefixes
{
  const bdoc = schema.nodes.doc.create(null, [
    bullet_list.create(null, schema.nodes.list_item.create(null, paragraph.create(null, t('item')))),
  ])
  expect('bullet item dash prefix', revealedMarks(stateWith(bdoc, 5)), [{ pos: 1, text: '- ' }])

  const odoc = schema.nodes.doc.create(null, [
    ordered_list.create({ order: 3 }, schema.nodes.list_item.create(null, paragraph.create(null, t('n')))),
  ])
  expect('ordered item uses order attr', revealedMarks(stateWith(odoc, 4)), [{ pos: 1, text: '3. ' }])
}

// code fence pair
{
  const doc = schema.nodes.doc.create(null, [code_block.create(null, t('let x = 1'))])
  expect('code fence open and close', revealedMarks(stateWith(doc, 4)), [
    { pos: 0, text: '```' },
    { pos: 11, text: '```' },
  ])
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall syntax reveal checks passed')
