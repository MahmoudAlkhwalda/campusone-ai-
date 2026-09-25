import { expect, test } from '@playwright/test';

test('carries the 18-credit FutureMe scenario through the applied plan', async ({ page }) => {
  await page.goto('/setup');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.getByTestId('input-name')).toHaveValue('Ahmad');
  await expect(page.getByTestId('input-credit-hours')).toHaveValue('15');
  await page.getByTestId('button-next-academic').click();
  await page.getByTestId('button-next-tuition').click();
  await page.getByTestId('button-run-simulation').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Computer Science student/ })).toContainText('15 credit hours');
  const chartLine = page.locator('.cashflow-line polyline');
  await expect(chartLine).toBeVisible();
  await expect.poll(async () => (await chartLine.getAttribute('points'))?.trim().split(/\s+/).length).toBe(6);

  await page.getByTestId('link-futureme').click();
  await page.getByTestId('button-scenario-credits-18').click();
  await expect(page.getByText('Forecast synced')).toBeVisible();

  const creditComparison = page.locator('.comparison-row').filter({ hasText: 'Credit hours' });
  await expect(creditComparison).toContainText('15 credits');
  await expect(creditComparison).toContainText('18 credits');
  await page.getByTestId('button-optimize-scenario').click();

  await expect(page).toHaveURL(/\/fix-my-semester$/);
  await expect(page.getByText('Active FutureMe scenario')).toBeVisible();
  await expect(page.getByText(/18 credits · \d+ plans tested/)).toBeVisible();

  const before = page.locator('.outcome-before');
  await expect(before).toContainText('Before');
  await expect(before).toContainText('-350 JOD');
  await expect(before).toContainText('Health 42/100');
  await expect(before).toContainText('Risk Month 3');
  await expect(page.getByText('Calculated by the Financial Twin engine')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A more workable semester plan.' })).toBeVisible();

  await page.getByTestId('button-match-recommended-plan').click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole('heading', { name: /Turn the plan into/ })).toBeVisible();
  await expect(page.locator('.target-grid')).toContainText('Tuition support target');
  await expect(page.locator('.target-grid')).toContainText('Income target');
  await expect(page.getByRole('heading', { name: 'Part-Time Software Developer' })).toBeVisible();
  await expect(page.getByText(/could help reduce the projected financial gap/)).toBeVisible();
  await page.getByTestId('button-simulate-opportunity').click();
  await expect(page.getByTestId('opportunity-result')).toContainText('After engine recalculation');
  await page.getByTestId('button-back-from-opportunities').click();
  await expect(page).toHaveURL(/\/fix-my-semester$/);
  await expect(page.getByText('Active FutureMe scenario')).toBeVisible();

  await page.getByTestId('button-apply-plan').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByLabel('Applied semester plan')).toContainText('Updated plan applied');
  await expect(page.getByLabel('CampusOne decision journey')).toContainText('Updated Plan');

  const appliedHeading = page.locator('.dashboard-heading');
  const appliedCredits = await appliedHeading.locator('em').innerText();
  const appliedBalance = await page.locator('.prediction-value').innerText();

  await page.reload();
  await expect(page.getByLabel('Applied semester plan')).toContainText(
    'Your Financial Twin now reflects the selected Fix My Semester assumptions.',
  );
  await expect(page.getByLabel('CampusOne decision journey')).toContainText('Updated Plan');
  await expect(page.locator('.dashboard-heading em')).toHaveText(appliedCredits);
  await expect(page.locator('.prediction-value')).toHaveText(appliedBalance);

  await page.getByRole('link', { name: 'Opportunities' }).click();
  await expect(page.getByRole('heading', { name: 'Part-Time Software Developer' })).toBeVisible();
  await expect(page.getByText('Demo Opportunity', { exact: false }).first()).toBeVisible();
  await page.getByTestId('button-simulate-opportunity').click();
  await expect(page.getByTestId('opportunity-result')).toContainText('After engine recalculation');

  await page.getByTestId('button-ask-campusone').click();
  await page.getByRole('button', { name: 'Why am I at risk and what can I do?' }).click();
  await expect(page.locator('.copilot-answer')).toBeVisible();
  await expect(page.locator('.copilot-answer')).toContainText(/Financial Twin|forecast|semester/i);

  await page.getByRole('link', { name: 'Institution View' }).click();
  await expect(page).toHaveURL(/\/institution$/);
  await expect(page.getByText('Synthetic Demo Data')).toBeVisible();
  await expect(page.getByText('No individual student details')).toBeVisible();
});

test('keeps Access Support available in discovery mode for a stable student', async ({ page }) => {
  await page.goto('/setup');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId('button-next-academic').click();
  await page.getByTestId('input-current-balance').fill('5000');
  await page.getByTestId('button-next-tuition').click();
  await page.getByTestId('button-run-simulation').click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Opportunities' }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByText(/currently on track financially/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Part-Time Software Developer' })).toBeVisible();
  await expect(page.getByText(/estimated value can strengthen the semester plan/)).toBeVisible();
  await expect(page.getByText(/projected financial gap/)).not.toBeVisible();
  await page.getByTestId('button-simulate-opportunity').click();
  await expect(page.getByTestId('opportunity-result')).toContainText('After engine recalculation');
});
