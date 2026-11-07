import { expect, test } from '@playwright/test'

/**
 * The onboarding path, against a real browser and the real engine.
 *
 * `verify:render` proves the components render from state; this proves the
 * journey a student actually takes — profile, scenario pack, industry lock.
 */
test.describe('onboarding', () => {
  test('sign-in page offers a direct instructor door', async ({ page }) => {
    await page.goto('/play')
    const instructor = page.getByRole('link', { name: /instructor/i })
    await expect(instructor).toBeVisible()
    await instructor.click()
    await expect(page).toHaveURL(/\/lecturer/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/instructor/i)
  })

  test('a player profile leads to the scenario picker', async ({ page }) => {
    await page.goto('/play')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/player profile/i)

    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill('Mensah')
    await page.getByLabel('Nickname').fill('ada')
    await page.getByLabel('Account email').fill(`ada+${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: /continue/i }).click()

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/the idea/i)
    await expect(page.getByText(/play a scenario, or play free/i)).toBeVisible()
    // Free play is the default and the industry grid is the full set.
    await expect(page.getByRole('button', { name: /free play/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /fashion & retail/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /manufacturing/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /education & training/i })).toBeVisible()
  })

  test('choosing a scenario pack shows its brief, objectives and locks the industry', async ({ page }) => {
    await page.goto('/play')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill('Mensah')
    await page.getByLabel('Nickname').fill('ada')
    await page.getByLabel('Account email').fill(`ada+${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('correct-horse-battery')
    await page.getByRole('button', { name: /continue/i }).click()

    await page.getByRole('button', { name: /the cash crunch/i }).click()

    // The brief, the window and at least one objective are on screen.
    await expect(page.getByText(/clothes people like but do not need/i)).toBeVisible()
    await expect(page.getByText(/6-month window/i)).toBeVisible()
    await expect(page.getByText(/still trading at month 6/i)).toBeVisible()
    await expect(page.getByText(/industry \(set by the scenario\)/i)).toBeVisible()

    // Only the pack's industry remains selectable.
    await expect(page.getByRole('button', { name: /fashion & retail/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /manufacturing/i })).toHaveCount(0)

    // And the chip can be cleared to go back to free play.
    await page.getByRole('button', { name: /free play/i }).click()
    await expect(page.getByRole('button', { name: /manufacturing/i })).toBeVisible()
  })
})
