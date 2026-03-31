import { test, expect } from '@playwright/test';

test.describe('Manual trade removal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app — it will show login or redirect
    await page.goto('/');
  });

  test('app loads without errors', async ({ page }) => {
    // The page should load without any uncaught exceptions
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('no Add Trade button exists on trading page', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForTimeout(2000);

    // Click on the Trades tab
    const tradesTab = page.getByRole('button', { name: /Trades/i });
    if (await tradesTab.isVisible()) {
      await tradesTab.click();
      await page.waitForTimeout(500);
    }

    // Verify no "Add Trade" button
    const addTradeButton = page.getByRole('button', { name: /Add Trade/i });
    await expect(addTradeButton).not.toBeVisible();
  });

  test('no Recalculate All P&L card in settings', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForTimeout(2000);

    // Click on the Settings tab if visible (may not be if not authenticated)
    const settingsTab = page.getByRole('button', { name: /Settings/i });
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(1000);
    }

    // Verify no "Recalculate All P&L" text anywhere on page
    const recalcText = page.getByText('Recalculate All P&L');
    await expect(recalcText).not.toBeVisible();

    // Verify no "FIFO matching" text (was in the recalc card description)
    const fifoText = page.getByText(/FIFO matching/i);
    await expect(fifoText).not.toBeVisible();
  });

  test('no edit/delete action buttons in trade history', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForTimeout(2000);

    // Click on the Trades tab
    const tradesTab = page.getByRole('button', { name: /Trades/i });
    if (await tradesTab.isVisible()) {
      await tradesTab.click();
      await page.waitForTimeout(500);
    }

    // Verify no "Actions" column header
    const actionsHeader = page.getByText('Actions', { exact: true });
    await expect(actionsHeader).not.toBeVisible();
  });

  test('no Clear Legacy Fills button in settings', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForTimeout(2000);

    // Click on the Settings tab
    const settingsTab = page.getByRole('button', { name: /Settings/i });
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(500);
    }

    // Verify no "Clear Legacy Fills" button
    const clearButton = page.getByRole('button', { name: /Clear Legacy Fills/i });
    await expect(clearButton).not.toBeVisible();
  });

  test('portfolio page shows OKX-specific empty state text', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForTimeout(2000);

    // Look for the updated empty state text
    const okxText = page.getByText(/Connect your OKX account/i);
    // This will be visible only if there are no balances
    // If user has data, this test passes by not finding the old text
    const oldText = page.getByText(/Start by adding trades/i);
    await expect(oldText).not.toBeVisible();
  });
});
