import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:54173', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 54173 --strictPort', url: 'http://127.0.0.1:54173', reuseExistingServer: false, env: Object.fromEntries(['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'].map(key=>[`VITE_FIREBASE_${key}`, ''])) },
});
