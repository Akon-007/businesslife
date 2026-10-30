import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const OUT = 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\'
const page = await connect('about:blank')
await page.send('Page.enable')
await page.send('Runtime.enable')
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errors = [];
    window.addEventListener('error', (e) => window.__errors.push('error: ' + e.message));
    window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
    const orig = console.error;
    console.error = (...args) => { window.__errors.push('console: ' + args.map(String).join(' ')); orig(...args); };
  `,
})

const step = (message) => console.log('•', message)
const text = () => page.evaluate('document.body.innerText')
const hasText = async (needle) => (await text()).toLowerCase().includes(needle.toLowerCase())
const errors = () => page.evaluate('window.__errors || []')

async function clickButton(label, { exact = false, prefix = false } = {}) {
  const ok = await page.evaluate(`(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
    const target = ${JSON.stringify(label)}.toLowerCase()
    const nodes = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null)
    const el = nodes.find((b) => ${
      exact ? 'norm(b.innerText) === target' : prefix ? 'norm(b.innerText).startsWith(target)' : 'norm(b.innerText).includes(target)'
    })
    if (!el) return false
    el.click()
    return true
  })()`)
  if (!ok) throw new Error(`button not found: ${label}${exact ? ' (exact)' : ''}`)
}

async function setInput(selector, value) {
  const ok = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  if (!ok) throw new Error(`input not found: ${selector}`)
}

async function setRange(index, value) {
  return page.evaluate(`(() => {
    const el = [...document.querySelectorAll('input[type=range]')][${index}]
    if (!el) return 'missing'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, String(${value}))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return el.value
  })()`)
}

async function closeDrawer() {
  await page.click('button[aria-label="Close"]')
  await sleep(450)
}

async function dismissReport() {
  const crisisQueued = await hasText('A crisis is waiting')
  await clickButton(crisisQueued ? 'Face the crisis' : 'Back to the city')
  await sleep(700)
  return crisisQueued
}

let crisesSurvived = 0

async function handleCrisisIfOpen(tag) {
  if (!(await hasText('Your move'))) return false
  await shot(page, `${OUT}play-${tag}-crisis.png`)
  const picked = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((node) => {
      const first = node.querySelector('span')
      return first && first.textContent.trim() === 'A' && node.offsetParent !== null
    })
    if (!b) return false
    b.click()
    return true
  })()`)
  if (!picked) throw new Error('crisis option A not found')
  await sleep(700)
  await shot(page, `${OUT}play-${tag}-crisis-result.png`)
  await clickButton('Continue', { exact: true })
  await sleep(700)
  crisesSurvived += 1
  step(`crisis #${crisesSurvived} resolved (${tag})`)
  return true
}

await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/play', 1400)
await page.evaluate("localStorage.removeItem('businesslife.save')")
await goto(page, 'http://localhost:5173/play', 1600)

if (!(await hasText('Who is building'))) throw new Error('onboarding did not render')
step('onboarding step 1')

await setInput('input[placeholder="e.g. Ada Mensah"]', 'Ada Mensah')
await setInput('input[placeholder="Your company"]', 'Kite & Co.')
await clickButton('Continue')
await sleep(600)
await clickButton('SaaS & Software')
await clickButton('Continue')
await sleep(600)
await clickButton('Product-led')
await clickButton('Continue')
await sleep(600)
if (!(await hasText('Your first day'))) throw new Error('briefing step missing')
await shot(page, `${OUT}play-onboarding-briefing.png`)
await clickButton('Found Kite')
await sleep(1400)

if (!(await hasText('Meridian City'))) throw new Error('game board did not render')
step('game board month 1')
await shot(page, `${OUT}play-board-m1.png`)

await clickButton('Open plan')
await sleep(800)
if (!(await hasText('Set the plan'))) throw new Error('market drawer missing')
const priceSet = await setRange(0, 9999)
const marketingSet = await setRange(1, 9000)
const productSet = await setRange(2, 7000)
step(`sliders -> price=${priceSet} mkt=${marketingSet} product=${productSet}`)
await sleep(400)
await shot(page, `${OUT}play-market.png`)

await clickButton('Close month 1')
await sleep(1200)
if (!(await hasText('Nova noticed'))) throw new Error('month 1 report missing')
step('month 1 report')
await shot(page, `${OUT}play-report-m1.png`)
await dismissReport()
await handleCrisisIfOpen('m1')

for (let month = 2; month <= 9; month += 1) {
  await clickButton(`Close month ${month}`)
  await sleep(1100)
  if (!(await hasText('Nova noticed'))) throw new Error(`month ${month} report missing`)
  const queued = await dismissReport()
  if (queued) {
    const handled = await handleCrisisIfOpen(`m${month}`)
    if (!handled) throw new Error(`crisis queue flag without crisis modal at month ${month}`)
  }
  step(`month ${month} closed${queued ? ' with crisis' : ''}`)

  if (month === 4) {
    await shot(page, `${OUT}play-board-m4.png`)
    await clickButton('Raise', { exact: true })
    await sleep(800)
    if (!(await hasText('Open a round'))) throw new Error('investors drawer missing')
    await clickButton('Open a round')
    await sleep(900)
    if (!(await hasText('Accept terms'))) throw new Error('no term sheets offered')
    await shot(page, `${OUT}play-investors.png`)
    await clickButton('Accept terms')
    await sleep(900)
    const raised = await page.evaluate(
      "(() => { try { return JSON.parse(localStorage.getItem('businesslife.save')).state.game.totalRaised } catch (e) { return 'unreadable' } })()",
    )
    if (!(raised > 0)) throw new Error(`raise did not add cash: ${raised}`)
    step(`round accepted, total raised: ${raised}`)
    await shot(page, `${OUT}play-investors-accepted.png`)
    await closeDrawer()
  }
  if (crisesSurvived >= 1 && month >= 6) break
}

await clickButton('Team', { exact: true })
await sleep(800)
await shot(page, `${OUT}play-team.png`)
await clickButton('Hire', { exact: true })
await sleep(700)
const teamSize = await page.evaluate(
  "(() => { try { return JSON.parse(localStorage.getItem('businesslife.save')).state.game.team.length } catch (e) { return -1 } })()",
)
if (teamSize < 1) throw new Error(`hire failed (team=${teamSize})`)
step(`hired, team size ${teamSize}`)
await shot(page, `${OUT}play-team-hired.png`)
await closeDrawer()

await clickButton('Bank', { exact: true })
await sleep(800)
await shot(page, `${OUT}play-bank.png`)
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((node) => node.offsetParent !== null && /\\$25/.test(node.innerText) && node.innerText.includes('/mo'))
  if (b) b.click()
})()`)
await sleep(700)
const debt = await page.evaluate(
  "(() => { try { return JSON.parse(localStorage.getItem('businesslife.save')).state.game.debt } catch (e) { return -1 } })()",
)
if (!(debt > 0)) throw new Error(`loan failed (debt=${debt})`)
step(`borrowed, debt ${debt}`)
await shot(page, `${OUT}play-bank-borrowed.png`)
await closeDrawer()

await clickButton('HQ', { prefix: true })
await sleep(800)
await shot(page, `${OUT}play-hq.png`)
await closeDrawer()

await page.click('button[aria-label="Ask Nova"]')
await sleep(800)
await shot(page, `${OUT}play-nova.png`)
await closeDrawer()

await page.click('button[aria-label="How to play"]')
await sleep(700)
await shot(page, `${OUT}play-help.png`)
await clickButton('Back to the city')
await sleep(500)

await shot(page, `${OUT}play-board-mid.png`)
let game = null
try {
  game = JSON.parse(await page.evaluate("localStorage.getItem('businesslife.save')")).state.game
} catch {
  throw new Error('could not read persisted game state')
}
step(
  `state: month=${game.month} cash=${game.cash} customers=${game.customers} team=${game.team.length} debt=${game.debt} raised=${game.totalRaised} equity=${game.founderEquity.toFixed(1)} achievements=${game.achievements.length}`,
)

await goto(page, 'http://localhost:5173/play', 1400)
if (!(await hasText('Kite & Co.'))) throw new Error('persistence failed after reload')
step('persistence after reload ok')

await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/play', 1400)
await shot(page, `${OUT}play-mobile-board.png`)
await page.evaluate('window.scrollTo(0, 620)')
await sleep(500)
await shot(page, `${OUT}play-mobile-summary.png`)
await page.evaluate('window.scrollTo(0, 0)')
await sleep(400)
await clickButton('Plan', { exact: true })
await sleep(900)
if (!(await hasText('Set the plan'))) throw new Error('mobile market drawer missing')
await shot(page, `${OUT}play-mobile-market.png`)
await closeDrawer()

await page.click('button[aria-label="Start over"]')
await sleep(700)
await shot(page, `${OUT}play-reset.png`)
await clickButton('Reset company')
await sleep(900)
if (!(await hasText('Who is building'))) throw new Error('reset did not return to onboarding')
step('reset back to onboarding ok')
await shot(page, `${OUT}play-mobile-onboarding.png`)

console.log('errors:', await errors())
page.close()
