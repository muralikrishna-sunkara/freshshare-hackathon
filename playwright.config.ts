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
    trace: "off",
  },
  // FreshShare is a responsive web app: run the demo path on a desktop browser and a phone browser.
  projects: [
    // Full demo path (reserves the lasagne, so it needs fresh seed data each run).
    { name: "desktop", testMatch: "demo-path.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Landing, early access, sign-up consent, footer pages, public profiles (read-mostly, safe to rerun).
    { name: "landing", testMatch: "landing.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Posting, privacy, report, URL filters, decline, live chat, post again (creates its own listing).
    { name: "listings", testMatch: "listings.spec.ts", dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Fridges, organizations, admin approvals, bulk claims.
    { name: "orgs", testMatch: "orgs-fridges.spec.ts", dependencies: ["listings"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Admin reports queue, early access, credits, empty-state actions.
    { name: "admin", testMatch: "admin.spec.ts", dependencies: ["orgs"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Notifications bell, live count, page.
    { name: "notifications", testMatch: "notifications.spec.ts", dependencies: ["admin"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "impact", testMatch: "impact.spec.ts", dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "trust", testMatch: "trust.spec.ts", dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "alerts", testMatch: "alerts-recurring.spec.ts", dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Read-only browse check on a phone-sized browser; runs after the demo path.
    { name: "edit", testMatch: "edit-browse.spec.ts", dependencies: ["desktop"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "password", testMatch: "password.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testMatch: "mobile-browse.spec.ts", dependencies: ["desktop"], use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
