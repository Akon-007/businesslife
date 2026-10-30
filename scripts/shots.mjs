import { capture, goto } from './cdp.mjs'

const shots = [
  ['landing-desktop', 'http://localhost:5173/', 1440, 900, false],
  ['landing-desktop-full', 'http://localhost:5173/', 1440, 900, true],
  ['landing-mobile', 'http://localhost:5173/', 390, 844, false],
  ['play-desktop', 'http://localhost:5173/play', 1440, 900, false],
  ['play-mobile', 'http://localhost:5173/play', 390, 844, false],
]

for (const [name, url, width, height, fullPage] of shots) {
  await capture({
    url,
    file: `C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\${name}.png`,
    width,
    height,
    fullPage,
    wait: 1600,
    before: async (page) => {
      if (name === 'play-desktop' || name === 'play-mobile') {
        await page.evaluate("localStorage.removeItem('businesslife.save')")
        await goto(page, url, 1600)
      }
    },
  })
}
