import { expect, test, type Browser, type Page } from "@playwright/test";

// Kit BUILD_PLAN step 10: admin reports queue, early-access counts and CSV export, credits page, empty-state actions.
const PASSWORD = "freshshare-demo"; // DEMO seed password

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
  return page;
}

test("admin works the reports queue and sees early-access sign-ups", async ({ browser }) => {
  const stamp = `e2e-${Date.now() % 100000}`;
  const sara = await signIn(browser, "sara@demo.freshshare.de");
  const near = await (await sara.request.get("/api/listings?lat=49.5897&lng=11.0040&radius=2000")).json();
  const target = near.listings.find((l: { giver: { name: string } }) => !l.giver.name.startsWith("Sara"));
  expect((await sara.request.post("/api/reports", { data: { listingId: target.id, reason: "spam", note: `report ${stamp}` } })).status()).toBe(201);
  expect((await sara.request.get("/api/admin/reports")).status()).toBe(403);

  const email = `${stamp}@example.test`;
  expect((await sara.request.post("/api/early-access", { data: { email, role: "fridge_host", source: "e2e", consent: true } })).status()).toBe(201);

  const admin = await signIn(browser, "admin@demo.freshshare.de");
  await admin.goto("/admin");
  const reports = admin.locator("section", { has: admin.getByRole("heading", { name: /^Reports/ }) });
  const card = reports.getByRole("listitem").filter({ hasText: `report ${stamp}` });
  await expect(card).toContainText("Spam");
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(card).toHaveCount(0);
  await reports.getByRole("button", { name: "Resolved" }).click();
  await expect(card).toBeVisible();

  const ea = admin.locator("section", { has: admin.getByRole("heading", { name: /Early access/ }) });
  await expect(ea.getByRole("heading", { name: /Early access \(\d+ sign-ups\)/ })).toBeVisible();
  await expect(ea).toContainText("Fridge hosts");
  await expect(ea).toContainText(email);
  const csv = await admin.request.get("/api/admin/early-access.csv");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(email);
});

test("credits page is linked from the footer", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Credits" }).click();
  await expect(page.getByRole("heading", { name: "Photo credits" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lasagne.jpg" })).toHaveAttribute("href", /commons\.wikimedia\.org/);
});

test("an empty map offers a way forward", async ({ page }) => {
  await page.goto("/map?category=dairy&diet=halal");
  await expect(page.getByText(/Nothing matching your filters within/).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page).not.toHaveURL(/diet=/);
  await expect(page.getByText(/Nothing matching your filters/)).toHaveCount(0);
});
