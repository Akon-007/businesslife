import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Defaults match the repo's original setup (app on 5173, API on 8787).
// Override with env vars when the app must be served on another port,
// e.g. DEV_PORT=8787 API_PROXY_TARGET=http://127.0.0.1:8788 npm run dev
const devPort = Number(process.env.DEV_PORT ?? 5173)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: process.env.DEV_HOST ?? '0.0.0.0',
    port: devPort,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
  preview: {
    host: process.env.DEV_HOST ?? '0.0.0.0',
    port: devPort,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
})
