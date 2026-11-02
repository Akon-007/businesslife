import { readFileSync } from 'node:fs'
import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const OUT = 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\'
const page = await connect('about:blank')
await page.send('Page.enable')
await page.send('Runtime.enable')
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errors = [];
    window.addEventListener('error', (e) => window.__errors.push('error: ' + e.message));
    window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)));
    const orig = console.error;
    console.error = (...args) => { window.__errors.push('console: ' + args.map(String).join(' ')); orig(...args); };
  `,
})
const step = (message) => console.log('•', message)
const text = () => page.evaluate('document.body.innerText')
const hasText = async (needle) => (await text()).toLowerCase().includes(needle.toLowerCase())

async function clickButton(label, { exact = false } = {}) {
  const ok = await page.evaluate(`(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
    const target = ${JSON.stringify(label)}.toLowerCase()
    const el = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).find((b) => ${exact ? 'norm(b.innerText) === target' : 'norm(b.innerText).includes(target)'})
    if (!el) return false
    el.click()
    return true
  })()`)
  if (!ok) throw new Error(`button not found: ${label}`)
}

const readGame = () =>
  page.evaluate("(() => { try { return JSON.parse(localStorage.getItem('businesslife.save')).state.game } catch (e) { return null } })()")

async function saveSeed(seed) {
  await page.evaluate(`(() => {
    let payload = null
    try { payload = JSON.parse(localStorage.getItem('businesslife.save')) } catch (error) { payload = null }
    if (!payload || !payload.state) payload = { state: { game: null }, version: 1 }
    payload.state.game = ${JSON.stringify(seed)}
    localStorage.setItem('businesslife.save', JSON.stringify(payload))
  })()`)
}

await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/play', 1400)
let base = await readGame()
if (!base || base.month < 12) {
  base = JSON.parse(readFileSync(`${OUT}base.json`, 'utf8'))
  step('using scripts/endbase.ts save')
}
step(`base save month ${base.month}, valuation ${base.valuation}`)

const bankruptSeed = {
  ...base,
  status: 'active',
  month: 35,
  cash: 500,
  debt: 0,
  emergencyLoans: 2,
  lastReport: null,
  pendingCrisis: null,
  endedReason: null,
  valuation: 150_000,
  customers: 12,
  price: 79,
  reputation: 30,
  quality: 35,
  morale: 40,
  founderEquity: 100,
  totalRaised: 0,
  achievements: [],
  team: [],
  offers: [],
  marketingSpend: 2_000,
  productSpend: 1_000,
  history: base.history.slice(0, 35),
}

await saveSeed(bankruptSeed)
await goto(page, 'http://localhost:5173/play', 1600)
if (!(await hasText('close month 36'))) throw new Error('seeded month 36 not shown')
await clickButton('Close month 36')
await sleep(1200)
if (!(await hasText('nova noticed'))) throw new Error('final report missing')
await clickButton((await hasText('a crisis is waiting')) ? 'Face the crisis' : 'Back to the city')
await sleep(1100)
if (!(await hasText('the bank called in the debt'))) throw new Error('bankrupt scorecard missing')
const bankruptState = await readGame()
step(`bankrupt: status=${bankruptState.status} month=${bankruptState.month} cash=${Math.round(bankruptState.cash)} loans=${bankruptState.emergencyLoans}`)
await shot(page, `${OUT}endstate-bankrupt.png`)

await viewport(page, 390, 844)
await sleep(700)
await shot(page, `${OUT}endstate-bankrupt-mobile.png`)
await viewport(page, 1440, 900)
await sleep(500)

await clickButton('Review city')
await sleep(700)
if (!(await hasText('view scorecard'))) throw new Error('dock scorecard CTA missing after run end')
await shot(page, `${OUT}endstate-dock.png`)
await clickButton('Plan', { exact: true })
await sleep(800)
if (!(await hasText('read-only recap'))) throw new Error('read-only notice missing in drawer')
const priceBefore = (await readGame()).price
await page.evaluate(`(() => {
  const el = [...document.querySelectorAll('input[type=range]')][0]
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, '29')
  el.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await sleep(500)
const priceAfter = (await readGame()).price
if (priceBefore !== priceAfter) throw new Error(`post-run price edit was applied (${priceBefore} -> ${priceAfter})`)
step(`post-run editing blocked (price stayed ${priceAfter})`)
await shot(page, `${OUT}endstate-readonly.png`)
await page.click('button[aria-label="Close"]')
await sleep(500)

const acceptOption = {
  id: 'accept',
  label: 'Take the exit',
  detail: 'Cash out your equity at 85% of the current valuation.',
  result: 'You trade the next chapter for certainty. The run ends on your terms.',
  effects: { acquisitionMult: 0.85 },
  tone: 'good',
}
const acquisitionSeed = {
  ...base,
  status: 'active',
  month: 24,
  lastReport: null,
  endedReason: null,
  valuation: 7_000_000,
  offers: [],
  pendingCrisis: {
    id: 'acquisition',
    month: 24,
    title: 'Someone wants to buy the company',
    kicker: 'Exit · decision',
    body: 'Kestrel Group has watched you for six months. They are offering to acquire the business at a modest premium — cash today, control tomorrow.',
    options: [
      acceptOption,
      {
        id: 'raise',
        label: 'Use it as leverage',
        detail: 'Tell investors a strategic buyer is circling.',
        result: 'The market takes you more seriously. So does your team.',
        effects: { reputation: 3, morale: 4 },
        tone: 'good',
      },
      {
        id: 'decline',
        label: 'Decline and keep building',
        detail: 'You are not done yet.',
        result: 'You choose independence. The team rallies around the ambition.',
        effects: { reputation: 4, morale: 2 },
        tone: 'good',
      },
    ],
  },
  history: base.history.slice(0, 24),
}

await saveSeed(acquisitionSeed)
await goto(page, 'http://localhost:5173/play', 1600)
if (!(await hasText('someone wants to buy the company'))) throw new Error('seeded acquisition crisis did not open')
await shot(page, `${OUT}endstate-acquisition-crisis.png`)
await clickButton('Take the exit')
await sleep(800)
await clickButton('Continue', { exact: true })
await sleep(1100)
if (!(await hasText('you sold the company'))) throw new Error('acquired scorecard missing')
const acquiredState = await readGame()
step(`acquired: status=${acquiredState.status} equity=${acquiredState.founderEquity} cash=${Math.round(acquiredState.cash)}`)
await shot(page, `${OUT}endstate-acquired.png`)

console.log('errors:', await page.evaluate('window.__errors'))
page.close()
