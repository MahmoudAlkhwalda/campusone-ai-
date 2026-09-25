import { expect, test } from '@playwright/test';

test('persists a saved profile while FutureMe remains temporary', async ({ page }) => {
  const email = `campusone-${Date.now()}@example.com`;
  const password = 'SemesterPass42!';

  await page.goto('/sign-up');
  await page.getByTestId('input-auth-name').fill('Saved Student');
  await page.getByTestId('input-auth-email').fill(email);
  await page.getByTestId('input-auth-password').fill(password);
  await page.getByTestId('button-auth-submit').click();

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByTestId('input-name')).toHaveValue('Saved Student');
  await page.getByTestId('button-next-academic').click();
  await page.getByTestId('button-next-tuition').click();
  await page.getByTestId('button-run-simulation').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.dashboard-heading')).toContainText('15 credit hours');

  await page.getByTestId('link-futureme').click();
  await page.getByTestId('button-scenario-credits-18').click();
  await expect(page.getByText('Forecast synced')).toBeVisible();
  const savedAfterFutureMe = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  expect(savedAfterFutureMe.profile.creditHours).toBe(15);

  await page.goto('/dashboard');
  await page.getByTestId('button-logout').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/sign-in');
  await page.getByTestId('input-auth-email').fill(email);
  await page.getByTestId('input-auth-password').fill(password);
  await page.getByTestId('button-auth-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.dashboard-heading')).toContainText('15 credit hours');

  const originalLine = await page.locator('.cashflow-line polyline').getAttribute('points');
  await page.getByTestId('button-edit-twin').click();
  await page.getByTestId('input-credit-hours').fill('16');
  await page.getByTestId('button-next-academic').click();
  await page.getByTestId('input-monthly-income').fill('160');
  await page.getByTestId('button-next-tuition').click();
  await page.getByTestId('button-run-simulation').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.dashboard-heading')).toContainText('16 credit hours');
  await expect(page.locator('.cashflow-line polyline')).not.toHaveAttribute('points', originalLine ?? '');

  await page.reload();
  await expect(page.locator('.dashboard-heading')).toContainText('16 credit hours');
  const savedAfterUpdate = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  expect(savedAfterUpdate.profile.creditHours).toBe(16);
  expect(savedAfterUpdate.profile.monthlyIncome).toBe(160);

  await page.getByTestId('button-logout').click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/sign-up');
  await page.getByTestId('input-auth-name').fill('Duplicate Student');
  await page.getByTestId('input-auth-email').fill(email);
  await page.getByTestId('input-auth-password').fill(password);
  await page.getByTestId('button-auth-submit').click();
  await expect(page.getByRole('alert')).toContainText('An account already exists for this email.');

  await page.goto('/sign-in');
  await page.getByTestId('input-auth-email').fill(email);
  await page.getByTestId('input-auth-password').fill('WrongPass42!');
  await page.getByTestId('button-auth-submit').click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
});