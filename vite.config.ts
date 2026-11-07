import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API and this dev server read the same `.env`, so `PORT` decides both where
// the API listens and where `/api` is proxied. Before this, a `.env` with
// `PORT=8788` sent the API to 8788 while the proxy still pointed at 8787, and
// every call failed for a reason that had nothing to do with the app.
//
// Real environment variables still win, so `API_PROXY_TARGET=… npm run dev`
// keeps working, as does `DEV_PORT` for the app itself.
export function resolveDevPorts(env: Record<string, string | undefined>) {
  // Only a numeric PORT can go into a proxy URL; anything else falls back to the
  // documented default rather than building `http://127.0.0.1:not-a-port`.
  const port = (env.PORT ?? '').trim()
  const apiPort = /^\d+$/.test(port) ? port : '8787'
  return {
    devPort: Number(env.DEV_PORT ?? 5173),
    devHost: env.DEV_HOST ?? '0.0.0.0',
    apiTarget: env.API_PROXY_TARGET ?? `http://127.0.0.1:${apiPort}`,
  }
}

export default defineConfig(({ mode }) => {
  const { devPort, devHost, apiTarget } = resolveDevPorts({ ...loadEnv(mode, process.cwd(), ''), ...process.env })
  const proxy = { '/api': apiTarget, '/health': apiTarget }

  return {
    plugins: [react(), tailwindcss()],
    server: { host: devHost, port: devPort, strictPort: true, allowedHosts: true, proxy },
    preview: { host: devHost, port: devPort, strictPort: true, allowedHosts: true, proxy },
  }
})
