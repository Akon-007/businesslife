import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const OUT = 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\'
const page = await connect('about:blank')
await page.send('Page.enable')
await page.send('Runtime.enable')

const text = () => page.evaluate('document.body.innerText')
const hasText = async (needle) => (await text()).toLowerCase().includes(needle.toLowerCase())

// Mobile landing: capture each section after scroll-triggered reveals fire
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/', 1600)
const stops = [0, 844, 895, 2941, 6091, 7053, 8940, 10082, 10865, 11630]
for (const [index, top] of stops.entries()) {
  await page.evaluate(`window.scrollTo(0, ${top})`)
  await sleep(900)
  await shot(page, `${OUT}qa-mobile-${index}.png`)
}

// Desktop game: verify moved expansion pin no longer collides with crisis
await viewport(page, 1440, 900)
await page.evaluate("localStorage.setItem('businesslife.tutorial', '3')")
await goto(page, 'http://localhost:5173/play', 1800)
await page.evaluate(`(() => {
  const el = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().includes('Back to the city'))
  if (el) el.click()
})()`)
await sleep(700)
console.log('game loaded:', await hasText('Close month'))
await shot(page, OUT + 'qa-play-pins.png')

// Mobile game view
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/play', 1600)
await shot(page, OUT + 'qa-play-mobile.png')
page.close()
