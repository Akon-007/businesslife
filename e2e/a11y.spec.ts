import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Accessibility gate against the real DOM.
 *
 * `verify:contrast` proves the design tokens clear WCAG AA for the text pairs
 * the UI uses; this proves the rendered pages do too, plus names, roles,
 * landmarks and focus order. Only `serious` and `critical` violations fail —
 * `moderate` findings are printed so they can be triaged without blocking.
 */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const blocking = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  // Targets and the contrast numbers have to be in the message: the CI
  // annotation is the only thing visible when an artifact cannot be fetched.
  const summary = blocking
    .flatMap((violation) =>
      violation.nodes.slice(0, 4).map((node) => {
        const where = node.target.join(' ')
        const why = (node.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 220)
        return `${violation.id} (${violation.impact}) [${where}] ${why}`
      }),
    )
    .slice(0, 10)
    .join('\n')

  const advisory = results.violations
    .filter((violation) => violation.impact !== 'serious' && violation.impact !== 'critical')
    .map((violation) => `  · ${violation.id} (${violation.impact ?? 'unknown'}) x${violation.nodes.length}`)
  if (advisory.length) console.log(`${label}: advisory findings\n${advisory.join('\n')}`)

  expect(blocking, `${label} has ${blocking.length} serious accessibility violation(s):\n${summary}`).toEqual([])
}

test.describe('accessibility', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await audit(page, 'landing')
  })

  test('onboarding: profile step', async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/player profile/i)
    await audit(page, 'onboarding/profile')
  })

  test('onboarding: scenario and industry step', async ({ page }) => {
    await page.goto('/play')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill('Mensah')
    await page.getByLabel('Nickname').fill('ada')
    await page.getByLabel('Account email').fill(`ada+${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.getByText(/play a scenario, or play free/i)).toBeVisible()
    await audit(page, 'onboarding/scenario')
  })

  test('instructor sign-in', async ({ page }) => {
    await page.goto('/lecturer')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/instructor/i)
    await audit(page, 'lecturer/sign-in')
  })
})
