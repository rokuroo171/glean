// Real-browser verification for the autoPair plugin: boots vite, opens the
// editor on a starter note, and drives page.keyboard so contenteditable,
// beforeinput, and Milkdown's plugin stack all run exactly as real typing
// does. Unit tests call handleTextInput directly, which proved not to be
// evidence of real typing behavior
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
let vite
const failures = []
const results = []

function check(name, ok, detail) {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// the whole process group must die with the spec: killing the npx wrapper
// alone orphans the real vite child, which keeps serving stale transforms
// on this port and poisons every later run
global.viteGroup = null
function startVite() {
  return new Promise((resolve, reject) => {
    vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true })
    global.viteGroup = -vite.pid
    const timer = setTimeout(() => reject(new Error('vite did not start in 20s')), 20000)
    vite.stdout.on('data', (d) => {
      if (String(d).includes('Local:')) { clearTimeout(timer); resolve() }
    })
    vite.stderr.on('data', (d) => process.stderr.write(d))
    vite.on('exit', (code) => { if (code) reject(new Error(`vite exited with ${code}`)) })
  })
}
function killVite() {
  if (global.viteGroup) try { process.kill(-global.viteGroup, 'SIGKILL') } catch (_) {}
  global.viteGroup = null
  if (vite) try { vite.kill('SIGKILL') } catch (_) {}
}

// first load on a cold cache transforms the whole dep graph and can take
// minutes on a slow box, so only wait for the shell then poll for the hook
async function openEditor(browser) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console.error] ${m.text()}`) })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByText('Welcome', { exact: true }).first().click({ timeout: 120000 })
  await page.waitForFunction(() => !!window.__gleanView, null, { timeout: 60000 })
  return page
}

// every case starts from a single empty paragraph in the live editor
async function clearEditor(page) {
  await page.click('.milkdown .editor')
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  if (process.env.E2E_DEBUG) await page.evaluate(() => { window.__autoPairDebug = true })
  await page.waitForFunction(() => {
    const v = window.__gleanView
    return v && v.state.doc.childCount === 1 && v.state.doc.firstChild.content.size === 0
  }, null, { timeout: 5000 })
}

// Load markdown directly through the app's own parser and wait for the doc
// to match. Typing cannot build multi-block structures like footnote
// definitions or GFM alerts reliably, and the parse path is exactly what a
// saved note goes through on open
async function loadMarkdown(page, markdown) {
  await page.evaluate((md) => {
    const view = window.__gleanView
    const doc = window.__gleanParse(md)
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
      .setMeta('addToHistory', false))
  }, markdown)
  await page.waitForFunction(() => window.__gleanView && window.__gleanView.state.doc.childCount > 0, null, { timeout: 5000 })
}

async function state(page) {
  return page.evaluate(() => {
    const { state } = window.__gleanView
    const $from = state.selection.$from
    const marks = []
    state.doc.nodesBetween(0, state.doc.content.size, (node) => {
      for (const m of node.marks) marks.push(m.type.name)
    })
    return {
      parent: $from.parent.type.name,
      text: $from.parent.textContent,
      caret: $from.parentOffset,
      head: state.selection.head,
      doc: state.doc.toString(),
      marks,
    }
  })
}

async function main() {
  // reuse a server that is already up (dev loop), otherwise boot one
  const up = await fetch(BASE).then((r) => r.ok).catch(() => false)
  if (!up) await startVite()
  const browser = await chromium.launch()
  const page = await openEditor(browser)

  // the flow that dead-ended before: fence, exit
  await clearEditor(page)
  await page.keyboard.type('```')
  let s = await state(page)
  check('fence opens a code block', s.parent === 'code_block', JSON.stringify(s))

  await page.keyboard.type('js')
  await page.keyboard.press('Escape')
  s = await state(page)
  check('escape exits to the paragraph below', s.parent === 'paragraph' && s.doc.includes('code_block'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('$')
  s = await state(page)
  check('dollar pairs', s.text === '$$' && s.head === 2, JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('$x$')
  s = await state(page)
  check('typing the dollar close skips over', s.text === '$x$', JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('[[')
  s = await state(page)
  check('starline completes on the second bracket', s.text === '[[]]' && s.caret === 2, JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('~')
  s = await state(page)
  check('tilde pairs', s.text === '~~~~' && s.head === 3, JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('~hi~~')
  s = await state(page)
  check('strike completes to a real mark', s.text === 'hi' && s.marks.includes('strike_through'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('**x**')
  s = await state(page)
  check('strong completes with no stray asterisk', s.text === 'x' && s.marks.includes('strong'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('=x==')
  s = await state(page)
  check('highlight completes to a real mark', s.text === 'x' && s.marks.includes('glean_highlight'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('`x`')
  s = await state(page)
  check('inline code completes to a real mark', s.text === 'x' && s.marks.includes('inlineCode'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('`')
  await page.keyboard.press('Backspace')
  s = await state(page)
  check('backspace dissolves the empty pair', s.text === '', JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('abc')
  await page.keyboard.press('Home')
  await page.keyboard.type('`')
  s = await state(page)
  check('no pair before a word char', s.text === '`abc', JSON.stringify(s))

  // Enter in a code block: after code it stays and newlines, on an empty
  // line it exits below, straight from the fence it exits immediately
  await clearEditor(page)
  await page.keyboard.type('```')
  await page.keyboard.type('x')
  await page.keyboard.press('Enter')
  s = await state(page)
  check('enter after code stays in the block', s.parent === 'code_block' && s.text === 'x\n', JSON.stringify(s))
  await page.keyboard.press('Enter')
  s = await state(page)
  check('enter on an empty block line exits below', s.parent === 'paragraph', JSON.stringify(s))
  await clearEditor(page)
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  s = await state(page)
  check('enter straight after the fence exits below', s.parent === 'paragraph', JSON.stringify(s))

  // caret walks the revealed raw syntax one position per press: the
  // revealed marks are widgets, so a skip (step beyond one) or a trap
  // (stuck before reaching the open side) is the failure
  await clearEditor(page)
  await page.keyboard.type('~hi~~')
  s = await state(page)
  check('strike is a real mark before the walk', s.marks.includes('strike_through'), JSON.stringify(s))
  const headsLeft = []
  for (let i = 0; i < 5; i++) {
    headsLeft.push(await page.evaluate(() => window.__gleanView.state.selection.head))
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(80)
  }
  headsLeft.push(await page.evaluate(() => window.__gleanView.state.selection.head))
  const stepsLeft = headsLeft.slice(1).map((h, i) => h - headsLeft[i])
  check('caret walks revealed strike syntax left without skipping', stepsLeft.every((d) => d >= -1 && d <= 0) && headsLeft.includes(1), JSON.stringify({ headsLeft, stepsLeft }))
  const headsRight = []
  for (let i = 0; i < 5; i++) {
    headsRight.push(await page.evaluate(() => window.__gleanView.state.selection.head))
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(80)
  }
  headsRight.push(await page.evaluate(() => window.__gleanView.state.selection.head))
  const stepsRight = headsRight.slice(1).map((h, i) => h - headsRight[i])
  check('caret walks revealed strike syntax right without skipping', stepsRight.every((d) => d >= 0 && d <= 1) && headsRight.includes(3), JSON.stringify({ headsRight, stepsRight }))
  await clearEditor(page)
  await page.keyboard.type('# Title')
  s = await state(page)
  check('heading formed before the prefix walk', s.parent === 'heading', JSON.stringify(s))
  const headsHead = []
  for (let i = 0; i < 9; i++) {
    headsHead.push(await page.evaluate(() => window.__gleanView.state.selection.head))
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(80)
  }
  headsHead.push(await page.evaluate(() => window.__gleanView.state.selection.head))
  const stepsHead = headsHead.slice(1).map((h, i) => h - headsHead[i])
  check('caret walks the revealed heading prefix without skipping', stepsHead.every((d) => d >= -1 && d <= 0) && headsHead.includes(1), JSON.stringify({ headsHead, stepsHead }))

  // reveal walks, part 2: footnote, alert, hr. loadMarkdown can leave the
  // selection anywhere, so every walk starts from the doc start and steps
  // down with settled reads, asserting the reveal state per step
  await loadMarkdown(page, 'Hello\n\n[^1]: the footnote body\n\ntrailing\n')
  await page.keyboard.press('Control+Home')
  await page.waitForTimeout(80)
  const fnSteps = []
  for (let i = 0; i < 14; i++) {
    fnSteps.push(await page.evaluate(() => {
      const v = window.__gleanView
      const sel = v.state.selection
      return {
        head: sel.head,
        inFn: sel.$from.node(1)?.type.name === 'footnote_definition',
        revealed: !!document.querySelector('dl[data-type="footnote_definition"].glean-fn-def-active'),
      }
    }))
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
  }
  const fnVisited = fnSteps.some((p) => p.inFn && p.revealed)
  const fnLeft = fnSteps[fnSteps.length - 1]
  const fnBounded = fnSteps.every((p, i) => i === 0 || (p.head >= fnSteps[i - 1].head - 1 && p.head - fnSteps[i - 1].head <= 30))
  check('caret walks through the footnote revealing raw syntax', fnVisited && !fnLeft.inFn && fnBounded, JSON.stringify(fnSteps))

  await loadMarkdown(page, '> [!NOTE]\n> remembered\n\nafter text\n')
  await page.keyboard.press('Control+Home')
  await page.waitForTimeout(80)
  const alSteps = []
  for (let i = 0; i < 12; i++) {
    alSteps.push(await page.evaluate(() => {
      const v = window.__gleanView
      return {
        head: v.state.selection.head,
        active: !!document.querySelector('.glean-alert-marker-active'),
        header: !!document.querySelector('.glean-alert-head'),
      }
    }))
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
  }
  const alMarker = alSteps.some((p) => p.active && !p.header)
  const alPast = await page.evaluate(() => {
    const v = window.__gleanView
    const sel = v.state.selection
    return sel.$from.parent.type.name === 'paragraph' && sel.$from.parent.textContent === 'after text'
  })
  const alBounded = alSteps.every((p, i) => i === 0 || (p.head >= alSteps[i - 1].head - 1 && p.head - alSteps[i - 1].head <= 30))
  check('caret crosses the alert marker revealing raw syntax', alMarker && alPast && alBounded, JSON.stringify(alSteps))

  await loadMarkdown(page, 'above\n\n---\n\nbelow\n')
  await page.keyboard.press('Control+Home')
  await page.waitForTimeout(80)
  const hrHop = []
  for (let i = 0; i < 12; i++) {
    hrHop.push(await page.evaluate(() => {
      const sel = window.__gleanView.state.selection
      return { head: sel.head, node: sel.node ? sel.node.type.name : null }
    }))
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
  }
  const passedHr = hrHop.filter((p, i) => i > 0 && p.head < hrHop[i - 1].head).length === 0
  const landedBelow = await page.evaluate(() => {
    const v = window.__gleanView
    return v.state.selection.$from.parent.type.name === 'paragraph'
      && v.state.selection.$from.parent.textContent === 'below'
  })
  check('caret crosses the hr without skipping', passedHr && landedBelow, JSON.stringify({ hrHop, landedBelow }))

  // html comment chips stay visible and selectable in their raw form; an
  // image reveals its raw syntax as a node decoration while selected
  await loadMarkdown(page, 'before <!-- keep secret --> after\n\n![alt text](https://example.com/cat.png "A cat")\n\nend\n')
  const chipVisible = await page.evaluate(() => {
    const chip = document.querySelector('.milkdown span[data-comment]')
    if (!chip) return { found: false }
    const cs = getComputedStyle(chip)
    return { found: true, zero: cs.fontSize === '0px' || cs.display === 'none', text: chip.textContent }
  })
  check('html comment renders as a visible chip', chipVisible.found && !chipVisible.zero && chipVisible.text.includes('keep secret'), JSON.stringify(chipVisible))
  const imgFound = await page.evaluate(() => {
    let found = false
    window.__gleanView.state.doc.descendants((n) => { if (n.type.name === 'image') found = true })
    return found
  })
  await page.click('.milkdown img')
  await page.waitForTimeout(120)
  const rawShown = await page.evaluate(() => {
    const el = document.querySelector('.milkdown img.glean-img-selected')
    return { shown: !!el, raw: el ? el.getAttribute('data-glean-raw') : null }
  })
  check('selecting an image reveals its raw syntax', imgFound && rawShown.shown && (rawShown.raw || '').includes('![alt text](https://example.com/cat.png "A cat")'), JSON.stringify({ imgFound, rawShown }))
  await page.keyboard.press('ArrowDown')
  const rawGone = await page.evaluate(() => !document.querySelector('.milkdown img.glean-img-selected'))
  check('image raw syntax hides when deselected', rawGone, JSON.stringify({ rawGone }))

  // sub/sup html pairs render as honest raw chips; a caret after a close
  // chip (or a chip selection) tints the whole pair, an unpaired chip
  // tints nothing
  await loadMarkdown(page, 'x <sub>2</sub>y+<sup>n</sup>z\n\nplain\n')
  const chipRaw = await page.evaluate(() => {
    const open = document.querySelector('.milkdown span[data-html-open="sub"]')
    const close = document.querySelector('.milkdown span[data-html-close="sub"]')
    return {
      open: open ? getComputedStyle(open, '::before').content : null,
      close: close ? getComputedStyle(close, '::before').content : null,
      tinted: !!document.querySelector('.glean-html-pair-selected'),
    }
  })
  check('sub chips render their raw tags', chipRaw.open === '"<sub>"' && chipRaw.close === '"</sub>"' && !chipRaw.tinted, JSON.stringify(chipRaw))
  await page.click('.milkdown p')
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(120)
  const supTint = await page.evaluate(() => {
    const hits = document.querySelectorAll('.milkdown .glean-html-pair-selected')
    return { count: hits.length, any: hits.length > 0 }
  })
  check('caret by a sup chip tints the whole pair', supTint.count === 3, JSON.stringify(supTint))
  await page.keyboard.press('Control+End')
  await page.waitForTimeout(120)
  const tintGone = await page.evaluate(() => !document.querySelector('.glean-html-pair-selected'))
  check('pair tint clears when the caret leaves', tintGone, JSON.stringify({ tintGone }))
  await loadMarkdown(page, 'a <sub>lonely\n\nplain\n')
  await page.click('.milkdown p')
  await page.keyboard.press('End')
  await page.waitForTimeout(120)
  const noPair = await page.evaluate(() => !document.querySelector('.glean-html-pair-selected'))
  check('an unpaired chip reveals nothing', noPair, JSON.stringify({ noPair }))

  // sub/sup html pair content renders with real vertical alignment,
  // caret-independently, including one level of nesting; stray chips
  // decorate nothing
  await loadMarkdown(page, 'H<sub>2</sub>O and x<sup>y</sup>\n\nplain\n')
  const styled = await page.evaluate(() => {
    const sub = document.querySelector('.milkdown .glean-html-sub')
    const sup = document.querySelector('.milkdown .glean-html-sup')
    return {
      sub: sub ? { text: sub.textContent, va: getComputedStyle(sub).verticalAlign } : null,
      sup: sup ? { text: sup.textContent, va: getComputedStyle(sup).verticalAlign } : null,
    }
  })
  check('sub and sup content renders styled', styled.sub?.text === '2' && styled.sup?.text === 'y' && styled.sub.va === 'sub' && styled.sup.va === 'super', JSON.stringify(styled))
  const paras = await page.$$('.milkdown p')
  await paras[paras.length - 1].click()
  await page.waitForTimeout(120)
  const stillStyled = await page.evaluate(() => !!document.querySelector('.milkdown .glean-html-sub'))
  check('styling holds when the caret moves away', stillStyled, JSON.stringify({ stillStyled }))
  await loadMarkdown(page, 'x</sub>stray<sub>y\n\nplain\n')
  await page.waitForTimeout(120)
  const stray = await page.evaluate(() => !document.querySelector('.glean-html-sub') && !document.querySelector('.glean-html-sup'))
  check('stray chips decorate nothing', stray, JSON.stringify({ stray }))

  // kbd and mark html pairs get their real element styling, mirroring the
  // read view; an unterminated pair decorates nothing
  await loadMarkdown(page, 'Press <kbd>Ctrl</kbd><kbd>K</kbd> then <mark>keep</mark> this\n\nplain\n')
  const tagStyled = await page.evaluate(() => {
    const kbd = document.querySelector('.milkdown .glean-html-kbd')
    const mark = document.querySelector('.milkdown .glean-html-mark')
    return {
      kbd: kbd ? { text: kbd.textContent, shadow: getComputedStyle(kbd).boxShadow !== 'none' } : null,
      mark: mark ? { text: mark.textContent, bg: getComputedStyle(mark).backgroundColor } : null,
    }
  })
  check('kbd and mark pairs render styled', tagStyled.kbd?.text === 'Ctrl' && tagStyled.kbd?.shadow && tagStyled.mark?.text === 'keep' && tagStyled.mark?.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(tagStyled))
  const parasAfter = await page.$$('.milkdown p')
  await parasAfter[parasAfter.length - 1].click()
  await page.waitForTimeout(120)
  const tagStillStyled = await page.evaluate(() => !!document.querySelector('.milkdown .glean-html-kbd'))
  check('html pair styling holds when the caret moves away', tagStillStyled, JSON.stringify({ tagStillStyled }))
  await loadMarkdown(page, 'a <kbd>unterminated\n\nplain\n')
  await page.waitForTimeout(120)
  const noKbd = await page.evaluate(() => !document.querySelector('.glean-html-kbd'))
  check('an unterminated html pair decorates nothing', noKbd, JSON.stringify({ noKbd }))

  // editing inside a styled html pair keeps the round-trip byte-true: type
  // into the kbd content, then serialize the live doc and compare
  await loadMarkdown(page, 'Press <kbd>Ctrl</kbd> twice\n\nplain\n')
  await page.click('.milkdown .glean-html-kbd')
  await page.keyboard.press('End')
  await page.keyboard.type('+Shift')
  await page.waitForTimeout(150)
  const roundTrip = await page.evaluate(() => {
    const v = window.__gleanView
    return { md: window.__gleanSerialize(v.state.doc), styled: !!document.querySelector('.milkdown .glean-html-kbd') }
  })
  check('typing inside a styled pair serializes correctly', roundTrip.md === 'Press <kbd>Ctrl+Shift</kbd> twice\n\nplain\n' && roundTrip.styled, JSON.stringify(roundTrip))

  // deleting half a styled pair degrades gracefully: the chip that remains
  // serializes as literal text, the content survives untouched, and the
  // now-unpaired chip stops styling anything
  const md = () => page.evaluate(() => ({
    md: window.__gleanSerialize(window.__gleanView.state.doc),
    styled: !!document.querySelector('.milkdown .glean-html-kbd'),
    selNode: window.__gleanView.state.selection.node?.type.name ?? null,
  }))
  // NodeSelection the close chip via NodeSelection and delete it
  await loadMarkdown(page, 'Press <kbd>Ctrl</kbd> twice\n\nplain\n')
  await page.evaluate(() => {
    const v = window.__gleanView
    let closePos = null
    v.state.doc.descendants((n, pos) => {
      if (closePos) return false
      if (n.type.name === 'html' && (n.attrs.value || '').trim() === '</kbd>') closePos = pos
      return !closePos
    })
    const sel = window.__gleanNodeSelection.create(v.state.doc, closePos)
    v.dispatch(v.state.tr.setSelection(sel).deleteSelection())
  })
  await page.waitForTimeout(150)
  const closeGone = await md()
  check('deleting the close chip serializes the open as literal text', closeGone.md === 'Press <kbd>Ctrl twice\n\nplain\n' && !closeGone.styled, JSON.stringify(closeGone))
  // same for the open chip: the orphaned close serializes literally
  await loadMarkdown(page, 'Press <kbd>Ctrl</kbd> twice\n\nplain\n')
  await page.evaluate(() => {
    const v = window.__gleanView
    let openPos = null
    v.state.doc.descendants((n, pos) => {
      if (openPos) return false
      if (n.type.name === 'html' && (n.attrs.value || '').trim() === '<kbd>') openPos = pos
      return !openPos
    })
    const sel = window.__gleanNodeSelection.create(v.state.doc, openPos)
    v.dispatch(v.state.tr.setSelection(sel).deleteSelection())
  })
  await page.waitForTimeout(150)
  const openGone = await md()
  check('deleting the open chip serializes the close as literal text', openGone.md === 'Press Ctrl</kbd> twice\n\nplain\n' && !openGone.styled, JSON.stringify(openGone))

  // Backspace on a selected html chip dissolves it into its literal tag
  // text instead of deleting the node, so the raw syntax stays recoverable
  await loadMarkdown(page, 'Press <kbd>Ctrl</kbd> twice\n\nplain\n')
  await page.evaluate(() => {
    const v = window.__gleanView
    let openPos = null
    v.state.doc.descendants((n, pos) => {
      if (openPos) return false
      if (n.type.name === 'html' && (n.attrs.value || '').trim() === '<kbd>') openPos = pos
      return !openPos
    })
    v.dispatch(v.state.tr.setSelection(window.__gleanNodeSelection.create(v.state.doc, openPos)))
  })
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(150)
  const dissolved = await page.evaluate(() => {
    const v = window.__gleanView
    return {
      firstPara: v.state.doc.firstChild.textContent,
      styled: !!document.querySelector('.milkdown .glean-html-kbd'),
      md: window.__gleanSerialize(v.state.doc),
    }
  })
  // the serializer escapes < before a letter in text nodes (micromark:
  // unescaped it would re-parse as html), so the dissolved tag saves as
  // \<kbd> and must parse back to the same literal editor text
  const parseBack = await page.evaluate((md) => {
    const doc = window.__gleanParse(md)
    return doc.firstChild.textContent
  }, dissolved.md)
  check('backspace on a chip dissolves it to literal tag text', dissolved.firstPara === 'Press <kbd>Ctrl twice' && dissolved.styled === false && dissolved.md === 'Press \\<kbd>Ctrl</kbd> twice\n\nplain\n' && parseBack === dissolved.firstPara, JSON.stringify({ dissolved, parseBack }))

  // starline chip: completes, renders as an atomic chip away from the
  // caret, reveals raw brackets near it, and clicking opens the note
  await clearEditor(page)
  // one close keystroke: the plugin skips over the whole ]] close, a
  // second ] would be a deliberate literal like in any type-over editor
  await page.keyboard.type('[[Starlines]')
  s = await state(page)
  check('starline text stays literal', s.text === '[[Starlines]]', JSON.stringify(s))

  let chipInfo = await page.evaluate(() => {
    const chip = document.querySelector('.glean-starline')
    return chip ? { text: chip.textContent, missing: chip.classList.contains('missing'), caret: window.__gleanView.state.selection.head, doc: window.__gleanView.state.doc.textContent } : null
  })
  if (!chipInfo) {
    const v = await page.evaluate(() => ({ caret: window.__gleanView.state.selection.head, doc: window.__gleanView.state.doc.textContent }))
    check('chip renders when the caret leaves', false, `no chip; state=${JSON.stringify(v)}`)
  } else {
    check('chip renders when the caret leaves', chipInfo.missing === false, JSON.stringify(chipInfo))
  }

  await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(() => !!document.querySelector('.glean-starline-raw'), null, { timeout: 5000 }).catch(() => {})
  chipInfo = await page.evaluate(() => {
    const chip = document.querySelector('.glean-starline')
    const raw = document.querySelector('.glean-starline-raw')
    return { chip: !!chip, raw: !!raw }
  })
  check('caret inside reveals the raw brackets', chipInfo.chip === false && chipInfo.raw === true, JSON.stringify(chipInfo))

  await page.keyboard.press('End')
  await page.waitForFunction(() => !!document.querySelector('.glean-starline:not(.missing)'), null, { timeout: 5000 })
  await page.click('.glean-starline:not(.missing)')
  // the Starlines starter opens with a level-1 heading of its own title
  await page.waitForFunction(() => {
    const v = window.__gleanView
    return v && v.state.doc.firstChild.type.name === 'heading'
      && v.state.doc.firstChild.textContent === 'Starlines'
  }, null, { timeout: 10000 })
  s = await state(page)
  check('clicking the chip opens the target note', s.doc.includes('heading'), JSON.stringify(s))

  await clearEditor(page)
  await page.keyboard.type('[[No Such Note]')
  await page.keyboard.press('End')
  await page.waitForFunction(() => !!document.querySelector('.glean-starline.missing'), null, { timeout: 5000 })
  await page.click('.glean-starline.missing')
  await page.getByText('No Such Note', { exact: true }).first().waitFor({ timeout: 5000 }).catch(() => {})
  const created = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, [role="dialog"], input')]
    return btn.some((el) => (el.value ?? el.textContent ?? '').trim() === 'No Such Note')
  })
  check('clicking a missing chip offers note creation', created, JSON.stringify({ created }))

  await browser.close()
  console.log('\n' + results.join('\n'))
  console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILURES`)
  killVite()
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => { console.error(e); killVite(); process.exit(1) })

