import { connect, goto, viewport } from './cdp.mjs'
const page = await connect('about:blank')
await viewport(page, 390, 844)
await goto(page, 'http://localhost:5173/', 1500)
const data = await page.evaluate(`(() => {
  const root = document.getElementById('root')
  const walk = (parent, depth) => [...parent.children].flatMap((el) => {
    const r = el.getBoundingClientRect()
    const row = { d: depth, tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 70), top: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
    return depth < 3 ? [row, ...walk(el, depth + 1)] : [row]
  })
  return { total: document.body.scrollHeight, rows: walk(root, 0) }
})()`)
for (const r of data.rows) console.log(`${' '.repeat(r.d * 2)}${r.tag} top=${r.top} h=${r.h} ${r.cls}`)
console.log('total', data.total)
page.close()
