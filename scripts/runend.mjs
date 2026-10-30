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
const hasText = async (needle) => (await page.evaluate('document.body.innerText')).toLowerCase().includes(needle.toLowerCase())

async function clickButton(label, { exact = false } = {}) {
  const ok = await page.evaluate(`(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
    const target = ${JSON.stringify(label)}.toLowerCase()
    const nodes = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null)
    const el = nodes.find((b) => (${exact ? 'norm(b.innerText) === target' : 'norm(b.innerText).includes(target)'}))
    if (!el) return false
    el.click()
    return true
  })()`)
  if (!ok) throw new Error(`button not found: ${label}`)
}

async function setInput(selector, value) {
  await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}

async function setRange(index, value) {
  await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('input[type=range]')][${index}]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, String(${value}))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}

const readGame = () =>
  page.evaluate("(() => { try { return JSON.parse(localStorage.getItem('businesslife.save')).state.game } catch (e) { return null } })()")

async function readState() {
  const game = await readGame()
  return { month: game?.month ?? 0, cash: game?.cash ?? 0, status: game?.status ?? 'none' }
}

async function closeDrawer() {
  await page.click('button[aria-label="Close"]')
  await sleep(450)
}

async function dismissReport() {
  if (!(await hasText('nova noticed'))) return false
  await clickButton((await hasText('a crisis is waiting')) ? 'Face the crisis' : 'Back to the city')
  await sleep(800)
  return true
}

async function handleCrisis(tag) {
  if (!(await hasText('your move'))) return false
  if (tag) await shot(page, `${OUT}${tag}.png`)
  await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find((node) => {
      const first = node.querySelector('span')
      return first && first.textContent.trim() === 'A' && node.offsetParent !== null
    })
    if (b) b.click()
  })()`)
  await sleep(700)
  await clickButton('Continue', { exact: true })
  await sleep(700)
  return true
}

async function raiseIfNeeded() {
  const { cash, status, month } = await readState()
  if (status !== 'active' || cash >= 80_000 || month < 3) return
  await clickButton('Raise', { exact: true })
  await sleep(700)
  if (!(await hasText('no offers on the table'))) return
  await clickButton('Open a round')
  await sleep(900)
  if (await hasText('accept terms')) {
    await clickButton('Accept terms')
    await sleep(800)
  }
  await closeDrawer()
  const after = await readState()
  step(`raised at month ${after.month}, cash now ${after.cash}`)
}

async function startCompany({ founder, company, industry, price, marketing, product, hires = 0 }) {
  await goto(page, 'http://localhost:5173/play', 1200)
  await page.evaluate("localStorage.removeItem('businesslife.save')")
  await goto(page, 'http://localhost:5173/play', 1400)
  await setInput('input[placeholder="e.g. Ada Mensah"]', founder)
  await setInput('input[placeholder="Your company"]', company)
  await clickButton('Continue')
  await sleep(500)
  await clickButton(industry)
  await clickButton('Continue')
  await sleep(500)
  await clickButton('Product-led')
  await clickButton('Continue')
  await sleep(500)
  await clickButton('Found ')
  await sleep(1200)

  if (hires > 0) {
    await clickButton('Team', { exact: true })
    await sleep(700)
    for (let index = 0; index < hires; index += 1) {
      const hired = await page.evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].filter((n) => n.offsetParent !== null).find((n) => n.innerText.replace(/\\s+/g, ' ').trim().toLowerCase() === 'hire')
        if (!b) return false
        b.click()
        return true
      })()`)
      if (!hired) break
      await sleep(500)
    }
    await closeDrawer()
  }

  await clickButton('Plan', { exact: true })
  await sleep(700)
  await setRange(0, price)
  await setRange(1, marketing)
  await setRange(2, product)
  await sleep(300)
  await clickButton('Done', { exact: true })
  await sleep(600)
}

async function monthLoop(limitMonths, label) {
  let month = (await readState()).month
  for (let guard = 0; guard < limitMonths + 2; guard += 1) {
    const state = await readState()
    if (state.status !== 'active') break
    if (state.month >= 36) break
    const target = state.month + 1
    await clickButton(`Close month ${target}`)
    await sleep(1100)
    await dismissReport()
    await handleCrisis(`${label}-crisis-m${target}`)
    await raiseIfNeeded()
    const now = await readState()
    if (now.month === month) {
      const ended = await hasText('run over') || await hasText('run complete') || await hasText('you sold the company')
      if (!ended) throw new Error(`month did not advance at ${month}`)
    }
    month = now.month
    if (month % 6 === 0) step(`${label}: month ${month}, cash ${now.cash}, status ${now.status}`)
    if (now.status !== 'active') break
  }
  return readState()
}

async function captureEnd(label) {
  await sleep(900)
  if (!(await hasText('start a new company'))) throw new Error(`run-end modal missing (${label})`)
  await shot(page, `${OUT}runend-${label}.png`)
}

await viewport(page, 1440, 900)

step('scenario 1: burn to bankruptcy')
await startCompany({
  founder: 'Ravi Okeke',
  company: 'Harbour & Sons',
  industry: 'Food & Beverage',
  price: 9999,
  marketing: 20000,
  product: 25000,
  hires: 3,
})
let result = await monthLoop(36, 'burn')
step(`burn run ended: ${JSON.stringify(result)}`)
await captureEnd('bankrupt')

await clickButton('Review city')
await sleep(700)
await shot(page, `${OUT}runend-review-banner.png`)
await clickButton('Run ended')
await sleep(700)
await clickButton('Start a new company')
await sleep(900)
if (!(await hasText('who is building'))) throw new Error('new company did not return to onboarding')
step('bankrupt → review → new company ok')

step('scenario 2: full 36-month run')
await startCompany({
  founder: 'Ada Mensah',
  company: 'Kite & Co.',
  industry: 'SaaS & Software',
  price: 9999,
  marketing: 6000,
  product: 10000,
  hires: 0,
})
result = await monthLoop(36, 'marathon')
step(`marathon ended: ${JSON.stringify(result)}`)
await captureEnd('complete')
const final = await readGame()
step(
  `final: month=${final.month} status=${final.status} cash=${final.cash} valuation=${final.valuation} equity=${final.founderEquity} achievements=${final.achievements.length}`,
)
await clickButton('Back to the city').catch(() => {})
await sleep(400)
await page.evaluate('window.scrollTo(0, 0)')
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/play', 1400)
if (await hasText('start a new company')) await shot(page, `${OUT}runend-mobile.png`)
else {
  await page.evaluate('window.scrollTo(0, 0)')
  await shot(page, `${OUT}runend-mobile-board.png`)
}

console.log('errors:', await page.evaluate('window.__errors'))
page.close()
