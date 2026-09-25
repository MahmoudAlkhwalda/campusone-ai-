import { expect, test, type Page } from '@playwright/test';

async function reachAccessSupport(page: Page) {
  await page.goto('/setup');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByTestId('button-next-academic').click();
  await page.getByTestId('button-next-tuition').click();
  await page.getByTestId('button-run-simulation').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByTestId('link-futureme').click();
  await page.getByTestId('button-scenario-credits-18').click();
  await expect(page.getByText('Forecast synced')).toBeVisible();
  await page.getByTestId('button-optimize-scenario').click();
  await expect(page).toHaveURL(/\/fix-my-semester$/);
  await page.getByTestId('button-match-recommended-plan').click();
  await expect(page).toHaveURL(/\/opportunities$/);
}

test('continues a simulated opportunity into the updated Financial Twin', async ({ page }) => {
  await reachAccessSupport(page);
  await expect(page.getByRole('heading', { name: 'Part-Time Software Developer' })).toBeVisible();
  await page.getByTestId('button-simulate-opportunity').click();
  await expect(page.getByTestId('opportunity-result')).toContainText('After engine recalculation');
  await page.getByTestId('button-continue-updated-plan').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('updated-plan-context')).toContainText('Your Updated Semester Plan');
  await expect(page.getByTestId('updated-plan-context')).toContainText('Original Projection');
  await expect(page.getByTestId('updated-plan-context')).toContainText('Updated Projection');
  await expect(page.getByLabel('CampusOne decision journey')).toContainText('Updated Plan');
  await expect(page.locator('.cashflow-line polyline')).toHaveAttribute('points', /\s/);
});

test('continues the active optimized plan when no opportunity is selected', async ({ page }) => {
  await reachAccessSupport(page);
  await expect(page.getByTestId('button-continue-updated-plan')).toBeVisible();
  await page.getByTestId('button-continue-updated-plan').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('updated-plan-context')).toContainText('Your Updated Semester Plan');
  await expect(page.getByTestId('updated-plan-context')).toContainText(/Semester Plan Stabilized|Financial Gap Reduced|Financial gap remains|Plan remains stable/);
});