import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5294',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: 'PORT=5294 AIMLAB_DATA_DIR=data/browser-fixtures node server/index.js',
    url: 'http://127.0.0.1:5294/healthz',
    reuseExistingServer: false,
  },
});
