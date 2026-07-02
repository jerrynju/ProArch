import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: 'e2e.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 412, height: 892 },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
