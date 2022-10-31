import { expect, test } from '@playwright/test';

//disable javascript because it should not be needed on prerendered pages
test.use({ javaScriptEnabled: false });

test('Loads no javascript and displays heading', async ({ page }) => {
  page.on('request', (request) =>
    expect(request.url().endsWith('.js')).toBe(false)
  );
  await page.goto('/about');

  expect(await page.textContent('h1')).toBe('About this app');
});
