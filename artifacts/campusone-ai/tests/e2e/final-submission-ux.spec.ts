import { expect, test } from '@playwright/test';

test('landing page opens the Ahmad demo directly without signup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('AI-powered financial wellness platform')).toBeVisible();
  await expect(page.getByText('Pre-filled demo · No setup required')).toBeVisible();
  await expect(page.getByText('AHMAD · DEMO PROFILE')).toBeVisible();
  await expect(page.getByText('Meet Ahmad.')).not.toBeVisible();

  await page.getByTestId('button-try-ahmad-demo').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Financial Twin · Demo Profile')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Computer Science student/ })).toContainText('15 credit hours');

  await page.getByTestId('link-futureme').click();
  await expect(page).toHaveURL(/\/futureme$/);
  await expect(page.getByText('FutureMe · Decision simulator')).toBeVisible();
  await page.getByTestId('button-scenario-credits-18').click();
  await expect(page.getByText('Forecast synced')).toBeVisible();
  await page.getByTestId('button-optimize-scenario').click();

  await expect(page).toHaveURL(/\/fix-my-semester$/);
  await expect(page.getByText(/Fix My Semester ·/)).toBeVisible();
  await page.getByTestId('button-match-recommended-plan').click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByText('Access Support · Demo Opportunities')).toBeVisible();
});

test('landing page remains readable and overflow-free at desktop and mobile widths', async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    await expect(page.locator('main > section')).toHaveCount(4);
    await expect(page.getByTestId('button-try-ahmad-demo')).toBeVisible();
    await expect(page.getByText('Projected Balance')).toBeVisible();
    await expect(page.getByText('Financial Status')).toBeVisible();
    await expect(page.getByText('Risk Month')).toBeVisible();
    await expect(page.getByTestId('ecosystem-student')).toBeVisible();
    await expect(page.getByTestId('ecosystem-university')).toBeVisible();
    await expect(page.getByTestId('ecosystem-company')).toBeVisible();
  }
});

test('landing page keeps one clear destination per CTA', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner').getByTestId('link-home-logo')).toHaveAttribute('href', '/');
  await expect(page.getByTestId('link-method')).toHaveAttribute('href', '#method');
  await expect(page.getByTestId('link-clarity')).toHaveAttribute('href', '#difference');
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/sign-in');
  await expect(page.getByTestId('button-start-simulation')).toHaveAttribute('href', '/sign-up');
  await expect(page.getByTestId('link-start-nav')).toHaveAttribute('href', '/sign-up');
  await expect(page.getByTestId('ecosystem-student')).toHaveAttribute('href', '/sign-up');
  await expect(page.getByTestId('ecosystem-student')).toContainText('Build My Financial Twin');
  await expect(page.getByTestId('ecosystem-university')).toHaveAttribute('href', '/institution');
  await expect(page.getByTestId('ecosystem-company')).toHaveAttribute('href', '/company');
  await expect(page.getByTestId('button-start-bottom')).toHaveAttribute('href', '/sign-up');
  await expect(page.getByTestId('button-start-bottom')).toContainText('Build My Financial Twin');

  await expect(page.getByTestId('button-experience-full-journey')).toHaveCount(0);
  await expect(page.getByTestId('button-try-ahmad-demo-bottom')).toHaveCount(0);
  await expect(page.getByText('Explore Student Experience')).toHaveCount(0);
});