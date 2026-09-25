import { defineConfig } from '@playwright/test';

const baseURL = process.env.CAMPUSONE_E2E_BASE_URL
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);

if (!baseURL) {
  throw new Error(
    'Set CAMPUSONE_E2E_BASE_URL or REPLIT_DEV_DOMAIN before running browser tests.',
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ?? '/repl/tools/bin/chromium',
    },
  },
});