import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The repo-root `.env`. Resolved from this module rather than the working
 * directory, so `npm run dev:backend`, `node backend-dist/server.js` and a
 * script run from a subdirectory all find the same file.
 */
const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url))

let done = false

/**
 * Load a local `.env` if one exists. Values already present in the environment
 * always win, so `SUPABASE_DB_URL=… npm run dev:backend` and deploy settings
 * override the file instead of being silently replaced by it.
 *
 * Call this before anything reads `process.env` (see `backend/server.ts`).
 */
export function loadEnv(file = ENV_FILE): void {
  if (done) return
  done = true
  if (!existsSync(file)) return
  try {
    process.loadEnvFile(file)
  } catch (cause) {
    console.warn(`[env] ignoring ${file}: ${(cause as Error).message}`)
  }
}
