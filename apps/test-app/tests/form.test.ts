import { expect, test } from '@playwright/test';

test('Can post form data', async ({ page }) => {
  await page.goto('/sverdle');
  await page.locator(':nth-match(input,1)').click();
  await page.keyboard.type('party');
  await page.locator('text=enter').click();

  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/sverdle?/enter') && resp.status() === 200
    ),
    page.keyboard.press('Enter'),
  ]);

  const guesses = page.locator('input');
  let firstGuess = '';
  for (let i = 0; i < 6; ++i) {
    firstGuess += await guesses.nth(i).inputValue();
  }
  expect(firstGuess).toBe('party');
});
