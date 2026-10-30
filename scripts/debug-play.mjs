import { connect, goto, viewport, shot, sleep } from './cdp.mjs'

const page = await connect('about:blank')
const logs = []
await page.send('Log.enable')
page.send('Runtime.consoleAPICalled', () => {}).catch(() => {})

await viewport(page, 1440, 900)
await goto(page, 'http://localhost:5173/play', 2200)

const info = await page.evaluate(`(() => {
  const app = document.getElementById('root')
  return {
    title: document.title,
    rootChildren: app ? app.children.length : -1,
    textLen: document.body.innerText.length,
    text: document.body.innerText.slice(0, 400),
    bg: getComputedStyle(document.body).backgroundColor,
    rootBox: app ? JSON.stringify(app.getBoundingClientRect()) : null,
  }
})()`)
console.log(info)

await shot(page, 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\debug-play.png')
page.close()
