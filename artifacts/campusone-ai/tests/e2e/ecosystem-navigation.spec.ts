import { expect, test } from '@playwright/test';

test('ecosystem cards open the existing student, university, and company routes', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('ecosystem-student').click();
  await expect(page).toHaveURL(/\/sign-up$/);

  await page.goto('/');
  await page.getByTestId('ecosystem-university').click();
  await expect(page).toHaveURL(/\/institution$/);

  await page.goto('/');
  await page.getByTestId('ecosystem-company').click();
  await expect(page).toHaveURL(/\/company$/);
});