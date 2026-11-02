import { writeFileSync } from 'node:fs'

const PORT = Number(process.env.CDP_PORT || 9333)
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function connect(url) {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  const target = await response.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  const listeners = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    } else if (message.method) {
      const handler = listeners.get(message.method)
      if (handler) handler(message.params)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id
      pending.set(messageId, { resolve, reject })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })
  const once = (method) =>
    new Promise((resolve) => {
      listeners.set(method, (params) => {
        listeners.delete(method)
        resolve(params)
      })
    })
  await send('Page.enable')
  await send('Runtime.enable')
  return {
    send,
    once,
    close: () => ws.close(),
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    },
    async clickText(text, tag = '*') {
      const ok = await this.evaluate(`(() => {
        const nodes = [...document.querySelectorAll('${tag}')]
        const el = nodes.find((node) => node.textContent.trim().includes(${JSON.stringify(text)}) && node.offsetParent !== null)
        if (!el) return false
        el.click()
        return true
      })()`)
      if (!ok) throw new Error('click target not found: ' + text)
      return ok
    },
    async click(selector) {
      const ok = await this.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return false
        el.click()
        return true
      })()`)
      if (!ok) throw new Error('selector not found: ' + selector)
    },
  }
}

export async function viewport(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  })
}

export async function goto(page, url, wait = 1400) {
  const loaded = page.once('Page.loadEventFired')
  await page.send('Page.navigate', { url })
  await Promise.race([loaded, sleep(6000)])
  await sleep(wait)
}

export async function shot(page, file, fullPage = false) {
  let clip
  if (fullPage) {
    const metrics = await page.send('Page.getLayoutMetrics')
    const size = metrics.cssContentSize ?? metrics.contentSize
    clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 }
  }
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: fullPage,
    ...(clip ? { clip } : {}),
  })
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  console.log('saved', file)
}

export async function capture({ url, file, width = 1440, height = 900, fullPage = false, wait = 1400, before }) {
  const page = await connect(url)
  try {
    await viewport(page, width, height)
    await goto(page, url, wait)
    if (before) await before(page)
    await shot(page, file, fullPage)
  } finally {
    page.close()
  }
}
