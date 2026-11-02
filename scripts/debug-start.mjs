import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const page = await connect('about:blank')
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errors = [];
    window.addEventListener('error', (e) => window.__errors.push('error: ' + e.message + ' @ ' + e.filename + ':' + e.lineno));
    window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)));
    const orig = console.error;
    console.error = (...args) => { window.__errors.push('console: ' + args.map(String).join(' ')); orig(...args); };
  `,
})
const clickButton = async (label) =>
  page.evaluate(`(() => {
    const norm = (s) => s.replace(/\\s+/g, ' ').trim()
    const el = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).find((b) => norm(b.innerText).includes(${JSON.stringify(label)}))
    if (!el) return false
    el.click()
    return true
  })()`)
const setInput = async (selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/play', 1200)
await page.evaluate("localStorage.removeItem('businesslife.save')")
await goto(page, 'http://localhost:5173/play', 1400)

await setInput('input[placeholder="e.g. Ada Mensah"]', 'Ada Mensah')
await setInput('input[placeholder="Your company"]', 'Kite & Co.')
await clickButton('Continue')
await sleep(500)
await clickButton('SaaS & Software')
await clickButton('Continue')
await sleep(500)
await clickButton('Product-led')
await clickButton('Continue')
await sleep(600)
console.log('briefing:', (await page.evaluate('document.body.innerText')).includes('Your first day'))
console.log('clicked found:', await clickButton('Found Kite'))
await sleep(1500)
console.log('storage:', (await page.evaluate("localStorage.getItem('businesslife.save')"))?.slice(0, 200))
console.log('body:', (await page.evaluate('document.body.innerText')).slice(0, 500))
console.log('errors:', await page.evaluate('window.__errors'))
await shot(page, 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\debug-after-start.png')
page.close()
