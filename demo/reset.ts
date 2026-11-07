// npm run demo:reset: put the demo data back to the seed, then sign in once per demo role and save the sessions.
//  - Local (APP_URL=http://localhost:...): runs `npm run db:seed` (full reset from data/seed.json).
//  - AWS (default APP_URL=https://freshshare.de): the seed runs as an ECS task. With DEMO_RESEED=1 this triggers the
//    "App database seed (manual)" workflow through the GitHub CLI and waits for it; otherwise it only checks the data.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { ACCOUNTS, APP_URL, AUTH_DIR, IS_LOCAL, ROOT, type DemoRole } from "./config";
import { ensureAuth } from "./lib/stage";

const sh = (cmd: string) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });

async function main() {
  if (IS_LOCAL) {
    console.log("Re-seeding the local database…");
    sh("npm run db:seed");
  } else if (process.env.DEMO_RESEED === "1") {
    console.log("Triggering the AWS seed workflow (app-seed.yml)…");
    sh("gh workflow run app-seed.yml -f migrate=false -f seed=true");
    await new Promise((r) => setTimeout(r, 8000)); // give GitHub a moment to register the run
    const id = execSync('gh run list --workflow=app-seed.yml --limit 1 --json databaseId -q ".[0].databaseId"', { cwd: ROOT }).toString().trim();
    sh(`gh run watch ${id} --exit-status`);
  } else {
    console.log(`Not re-seeding ${APP_URL} (set DEMO_RESEED=1 to run the AWS seed workflow). Checking the demo data instead.`);
  }

  // Fresh sessions for every demo role (signs in through the API: no password is ever shown in the video).
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  for (const role of Object.keys(ACCOUNTS) as DemoRole[]) {
    await ensureAuth(browser, role);
    console.log(`  ✓ signed in as ${ACCOUNTS[role]}`);
  }

  // What the core chapters need.
  const ctx = await browser.newContext({ storageState: `${AUTH_DIR}/admin.json`, baseURL: APP_URL });
  const listings = (await (await ctx.request.get("/api/listings?lat=49.5897&lng=11.004&radius=3000")).json()).listings as { title: string; status: string }[];
  const pending = await (await ctx.request.get("/api/admin/pending")).json();
  await ctx.close();
  await browser.close();
  const lasagne = listings.some((l) => l.title.startsWith("Vegetable lasagne") && l.status === "available");
  const pendingDemo = pending.fridges?.some((f: { name: string }) => f.name.startsWith("Demo")) && pending.organizations?.some((o: { name: string }) => o.name.startsWith("Demo"));
  console.log(`\nAvailable listings nearby: ${listings.filter((l) => l.status === "available").length}`);
  console.log(`Vegetable lasagne available (chapter 5): ${lasagne ? "yes" : "no, chapter 5 falls back to another of Anna's listings"}`);
  console.log(`Pending demo fridge + organization (chapter 11): ${pendingDemo ? "yes" : "no, chapter 11 will be skipped until the data is re-seeded"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
