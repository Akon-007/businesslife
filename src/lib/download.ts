/**
 * Hand a generated file to the browser. Kept apart from the generators so the
 * PDF builders stay pure and testable in Node, where there is no DOM.
 */
export function downloadBytes(bytes: Uint8Array, filename: string, type = 'application/pdf') {
  if (typeof document === 'undefined') return
  const view = new Uint8Array(bytes.length)
  view.set(bytes)
  const blob = new Blob([view.buffer], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
