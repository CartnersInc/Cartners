import { defineConfig } from '@playwright/test';

// Feature checks only; the shell's own checks live in frontend/test/browser.
export default defineConfig({
  testDir: '.',
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
