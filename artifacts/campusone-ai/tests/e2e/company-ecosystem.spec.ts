import { expect, test } from '@playwright/test';

test('connects a company opportunity to Access Support and the Financial Twin', async ({ page }) => {
  await page.route('**/api/opportunities/company', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        demo: true,
        opportunity: {
          id: 'company-demo-paid-internship',
          name: 'CampusOne QA Paid Internship',
        },
      }),
    });
  });

  await page.goto('/company');
  await page.getByTestId('button-post-opportunity').click();
  await page.getByTestId('input-company-title').fill('CampusOne QA Paid Internship');
  await page.getByTestId('input-company-description').fill('Assist with a small student product research sprint.');
  await page.getByTestId('input-company-deadline').fill('30 April 2026');
  await page.getByTestId('button-submit-opportunity').click();
  await expect(page.getByTestId('status-company-success')).toContainText('published');
  await expect(page.getByTestId('company-opportunity-company-demo-paid-internship')).toBeVisible();

  await page.goto('/setup');
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

  const createdOpportunity = page.getByRole('button', { name: /CampusOne QA Paid Internship/ });
  await expect(createdOpportunity).toBeVisible();
  await createdOpportunity.click();
  await page.getByTestId('button-simulate-opportunity').click();
  await expect(page.getByTestId('opportunity-result')).toContainText('After engine recalculation');
});