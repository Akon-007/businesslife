import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const page = await connect('about:blank')
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errors = []; window.addEventListener('error', (e) => window.__errors.push('error: ' + e.message)); window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));`,
})
await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/play', 1500)

console.log('saved before:', await page.evaluate("(() => { const s = JSON.parse(localStorage.getItem('businesslife.save')).state.game; return { month: s.month, cash: s.cash, team: s.team.length, candidates: s.candidates.length } })()"))

const teams = await page.evaluate(`(() => {
  const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
  return [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && norm(b.innerText).includes('team')).map((b) => norm(b.innerText).slice(0, 60))
})()`)
console.log('team buttons:', teams)
await page.evaluate(`(() => {
  const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
  const b = [...document.querySelectorAll('button')].filter((n) => n.offsetParent !== null).find((n) => norm(n.innerText).includes('team'))
  b.click()
})()`)
await sleep(1000)
await shot(page, 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\debug-hire-team.png')

const hires = await page.evaluate(`(() => {
  const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
  return [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && norm(b.innerText).includes('hire')).map((b) => ({ text: norm(b.innerText).slice(0, 50), disabled: b.disabled }))
})()`)
console.log('hire buttons:', hires)

const clicked = await page.evaluate(`(() => {
  const norm = (s) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
  const b = [...document.querySelectorAll('button')].filter((n) => n.offsetParent !== null).find((n) => norm(n.innerText) === 'hire')
  if (!b) return 'no exact hire button'
  b.click()
  return 'clicked disabled=' + b.disabled
})()`)
console.log(clicked)
await sleep(1000)
console.log('saved after:', await page.evaluate("(() => { const s = JSON.parse(localStorage.getItem('businesslife.save')).state; return { team: s.game.team.length, cash: s.game.cash, toast: s.toast && s.toast.message } })()"))
console.log('page has toast?', (await page.evaluate('document.body.innerText')).includes('joined the team'))
console.log('errors:', await page.evaluate('window.__errors'))
await shot(page, 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\debug-hire-after.png')
page.close()
