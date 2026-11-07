import { defineConfig, devices } from "@playwright/test";

// Run against a freshly seeded app:  npm run db:seed && npm run e2e
// Against AWS:  BASE_URL=https://freshshare.de npm run e2e  (after the deploy workflow ran with seed=true)
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "off",
  },
});
