import { connect, goto, viewport } from './cdp.mjs'
const page = await connect('about:blank')
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/play', 2200)
const data = await page.evaluate(`(() => {
  const pins = [...document.querySelectorAll('div.absolute.z-20')].map((el) => {
    const btn = el.querySelector('[aria-label]')
    const r = btn.getBoundingClientRect()
    return { label: btn.getAttribute('aria-label').split('.')[0], x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
  const overlaps = []
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
    const a = pins[i], b = pins[j]
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    if (ox > 4 && oy > 4) overlaps.push(a.label + ' / ' + b.label + ' ' + ox + 'x' + oy)
  }
  return { pins, overlaps }
})()`)
console.table(data.pins)
console.log('overlaps:', data.overlaps)
page.close()
