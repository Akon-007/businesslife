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
const overflow = () => page.evaluate('document.documentElement.scrollWidth - window.innerWidth')

async function clickButton(label, { exact = false } = {}) {
  const ok = await page.evaluate(`(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
    const target = ${JSON.stringify(label)}.toLowerCase()
    const nodes = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null)
    const el = nodes.find((b) => ${exact ? 'norm(b.innerText) === target' : 'norm(b.innerText).includes(target)'})
    if (!el) return false
    el.click()
    return true
  })()`)
  if (!ok) throw new Error('button not found: ' + label)
}

// Landing responsive QA
await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/', 1700)
await shot(page, OUT + 'qa-landing-desktop.png')
step('landing desktop overflow: ' + (await overflow()))

await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/', 1500)
await shot(page, OUT + 'qa-landing-mobile.png', true)
step('landing mobile overflow: ' + (await overflow()))

// Onboarding with fresh save
await viewport(page, 1440, 900)
await page.evaluate("localStorage.removeItem('businesslife.save'); localStorage.removeItem('businesslife.tutorial')")
await goto(page, 'http://localhost:5173/play', 1600)
step('onboarding step 1: ' + (await hasText('Who is building')))
await shot(page, OUT + 'qa-onboard-1.png')

await clickButton('Continue')
await sleep(400)
await clickButton('Continue')
await sleep(400)
await clickButton('Continue')
await sleep(500)
step('onboarding profile step: ' + (await hasText('What kind of')))
await shot(page, OUT + 'qa-onboard-profile.png', true)

await clickButton('Builder')
await clickButton('Hardcore')
await sleep(200)
await clickButton('Continue')
await sleep(400)
step('briefing shows profile: ' + (await hasText('Hardcore mode')))
await shot(page, OUT + 'qa-onboard-briefing.png', true)

await clickButton('Found')
await sleep(1800)
step('game started, tutorial visible: ' + (await hasText('First run')))
await shot(page, OUT + 'qa-play-start.png')

// Skip tutorial
await page.evaluate("document.querySelector('[aria-label=\"Skip tutorial\"]')?.click()")
await sleep(300)

// Suppliers panel via landmark pin
await page.click('[aria-label^="Supply Depot"]')
await sleep(700)
step('suppliers panel: ' + (await hasText('Supply Depot')))
await shot(page, OUT + 'qa-panel-suppliers.png')
await page.click('[aria-label="Close"]')
await sleep(400)

// Sales panel via Market Plaza pin then Pipeline action
await page.click('[aria-label^="Market Plaza"]')
await sleep(600)
await clickButton('Pipeline')
await sleep(600)
step('sales panel: ' + (await hasText('Pipeline')))
await shot(page, OUT + 'qa-panel-sales.png')
await page.click('[aria-label="Close"]')
await sleep(400)

// Expansion panel via pin
await page.click('[aria-label^="Expansion District"]')
await sleep(600)
step('expansion panel: ' + (await hasText('Expansion')))
await shot(page, OUT + 'qa-panel-expansion.png')
await page.click('[aria-label="Close"]')
await sleep(400)

// Close month and inspect report
await clickButton('Close month')
await sleep(1500)
step('report drivers: ' + (await hasText('What moved the month')))
await shot(page, OUT + 'qa-report.png', true)
step('errors so far: ' + JSON.stringify(await errors()))
