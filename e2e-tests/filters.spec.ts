import { test, expect } from '@playwright/test';

test.describe('Game filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  const visibleCards = (page: import('@playwright/test').Page) =>
    page.locator('[data-game-item]:not([hidden]) [data-testid="game-card"]');

  test('filters by category and supports multiple categories', async ({ page }) => {
    const total = await visibleCards(page).count();
    const boxes = page.getByTestId('game-filters').getByRole('checkbox');
    await boxes.nth(0).check();
    const first = await visibleCards(page).count();
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(total);
    const name = (await boxes.nth(0).locator('xpath=..').innerText()).trim();
    await expect(visibleCards(page).getByTestId('game-category').first()).toHaveText(name);

    await boxes.nth(1).check();
    expect(await visibleCards(page).count()).toBeGreaterThan(first);
  });

  test('filters by publisher', async ({ page }) => {
    const select = page.getByTestId('filter-publisher');
    await select.selectOption({ index: 1 });
    const name = (await select.locator('option:checked').innerText()).trim();
    const texts = await visibleCards(page).getByTestId('game-publisher').allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((t) => expect(t.trim()).toBe(name));
  });

  test('combines filters, reports empty results and clears', async ({ page }) => {
    const total = await visibleCards(page).count();
    const boxes = page.getByTestId('game-filters').getByRole('checkbox');
    const select = page.getByTestId('filter-publisher');
    const n = await boxes.count();
    const m = await select.locator('option').count();

    // Find a combination with no matches, if one exists.
    let found = false;
    for (let c = 0; c < n && !found; c++) {
      for (let p = 1; p < m && !found; p++) {
        await boxes.nth(c).check();
        await select.selectOption({ index: p });
        if ((await visibleCards(page).count()) === 0) {
          found = true;
          await expect(page.getByTestId('no-results')).toBeVisible();
        } else {
          await boxes.nth(c).uncheck();
        }
      }
    }

    await page.getByTestId('filter-clear').click();
    await expect(visibleCards(page)).toHaveCount(total);
    await expect(page.getByTestId('no-results')).toBeHidden();
  });

  test('is keyboard accessible and announces result count', async ({ page }) => {
    const box = page.getByTestId('game-filters').getByRole('checkbox').first();
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toBeChecked();
    await expect(page.getByTestId('filter-result-count')).toHaveText(/Showing \d+ of \d+ games/);
    await expect(page.getByTestId('filter-result-count')).toHaveAttribute('aria-live', 'polite');
  });

  test('restores filters from the URL', async ({ page }) => {
    await page.getByTestId('game-filters').getByRole('checkbox').first().check();
    await expect(page).toHaveURL(/category=\d+/);
    await page.reload();
    await expect(page.getByTestId('game-filters').getByRole('checkbox').first()).toBeChecked();
  });
});
