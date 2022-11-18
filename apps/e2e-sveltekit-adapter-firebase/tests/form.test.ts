import { expect, test } from '@playwright/test';

test('Can post form data', async ({ page }) => {
  await page.goto('/sverdle');
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 });
  await page.keyboard.type('party');

  await Promise.all([
    page.locator('text=enter').click(),
    page.waitForResponse(
      (resp) => resp.url().includes('/sverdle?/enter') && resp.status() === 200
    ),
  ]);

  const guesses = page.locator('input');
  let firstGuess = '';
  for (let i = 0; i < 6; ++i) {
    firstGuess += await guesses.nth(i).inputValue();
  }
  expect(firstGuess).toBe('party');
});
