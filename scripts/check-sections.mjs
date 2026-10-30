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
const game = () => page.evaluate("JSON.parse(localStorage.getItem('businesslife.save')).state.game")

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

await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/', 1200)
await page.evaluate("localStorage.removeItem('businesslife.save'); localStorage.removeItem('businesslife.tutorial')")
await goto(page, 'http://localhost:5173/play', 1600)

for (let i = 0; i < 3; i++) {
  await clickButton('Continue')
  await sleep(400)
}
step('profile step visible: ' + (await hasText('founder are you')))
await clickButton('Builder')
await clickButton('Hardcore')
await clickButton('Continue')
await sleep(400)
step('briefing shows profile: ' + (await hasText('Hardcore mode')))
await clickButton('Found')
await sleep(1800)

const started = await game()
step(`started as ${started.founderBackground}/${started.difficulty} with $${started.cash}`)
step('tutorial visible: ' + (await hasText('First run')))

await clickButton('Open plan')
await sleep(600)
step('tutorial action opened market panel: ' + (await hasText('Monthly levers')))
step('tutorial advanced: ' + (await hasText('2 of 3')))
await page.click('[aria-label="Close"]')
await sleep(400)

await page.click('[aria-label^="Supply Depot"]')
await sleep(700)
step('suppliers panel: ' + (await hasText('Pick a supplier')))
await shot(page, OUT + 'qa-panel-suppliers.png')
await page.click('[aria-label="Close"]')
await sleep(400)

await page.click('[aria-label^="Market Plaza"]')
await sleep(600)
await clickButton('Pipeline')
await sleep(600)
step('sales panel: ' + (await hasText('Open expansion deals')))
await shot(page, OUT + 'qa-panel-sales.png')
await page.click('[aria-label="Close"]')
await sleep(400)

await page.click('[aria-label^="Expansion District"]')
await sleep(600)
step('expansion panel: ' + (await hasText('Expansion options') || await hasText('EXPANSION OPTIONS')))
await shot(page, OUT + 'qa-panel-expansion.png')
await page.click('[aria-label="Close"]')
await sleep(400)

await clickButton('Close month')
await sleep(1500)
step('report drivers: ' + (await hasText('What moved the month')))
await shot(page, OUT + 'qa-report.png', true)

await clickButton('Back to the city')
await sleep(600)

// Archive round-trip
await page.click('[aria-label="Start over"]')
await sleep(500)
await clickButton('Archive & restart')
await sleep(900)
step('archive shows run: ' + (await hasText('Your archive')))
await shot(page, OUT + 'qa-archive.png', true)
await clickButton('Resume')
await sleep(1200)
step('resumed run: ' + (await hasText('Close month')))

// Mobile game render
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/play', 1600)
await shot(page, OUT + 'qa-play-mobile.png')

step('errors: ' + JSON.stringify(await errors()))
