import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end and accessibility checks.
 *
 * These need a real browser (`npx playwright install chromium`). The sandbox
 * this repo was developed in cannot download one, so the suite is a separate
 * npm script rather than part of `npm run verify`; `npm run verify:e2e` skips
 * cleanly when no browser is present and CI installs one first.
 *
 * Both servers are started here so a bare `npx playwright test` works.
 */
const APP = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:8788'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP,
    // The UI is reduced-motion aware; asking for it also stops entrance
    // animations mid-fade when axe samples colours.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `PORT=${new URL(API).port} npm run dev:backend`,
      url: `${API}/api/health`,
      timeout: 180_000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `API_PROXY_TARGET=${API} npm run dev`,
      url: APP,
      timeout: 120_000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
