import { expect, test, type Browser, type Page } from "@playwright/test";

// Kit BUILD_PLAN step 9 (+ the admin approvals from step 10): fridge suggestion and check-in,
// organization registration with a PDF, team roles, bulk claims and volunteer collection.
const PASSWORD = "freshshare-demo"; // DEMO seed password
const pdf = { name: "registration.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
  return page;
}

test("suggested fridge and new organization stay hidden until an admin approves them", async ({ browser }) => {
  const stamp = Date.now() % 100000;
  const sara = await signIn(browser, "sara@demo.freshshare.de");

  await sara.goto("/fridges/new");
  await sara.getByLabel("Name").fill(`E2E fridge ${stamp}`);
  await sara.getByLabel("Address").fill("Teststraße 1, Erlangen");
  await sara.getByLabel("Opening hours").fill("Daily 8-20");
  await sara.getByRole("button", { name: "Suggest this fridge" }).click();
  await expect(sara.getByText(/We'll check it/)).toBeVisible();
  await sara.getByRole("link", { name: "Open the fridge page" }).click();
  const fridgeUrl = sara.url();

  await sara.goto("/organizations/new");
  await sara.getByLabel("Name").fill(`E2E Kitchen ${stamp}`);
  await sara.getByLabel("Type").selectOption("community_center");
  await sara.getByLabel("Email").fill("kitchen@example.test");
  await sara.getByLabel("Address").fill("Hall 3, Erlangen");
  await sara.getByLabel("City").fill("Erlangen");
  await sara.getByLabel("What do you do?").fill("We cook free lunches from rescued food.");
  await sara.getByLabel("Contact person").fill("Sara M.");
  await sara.getByLabel(/Verification document/).setInputFiles(pdf);
  await sara.getByRole("button", { name: "Register organization" }).click();
  await expect(sara.getByText(/We're reviewing your organization/)).toBeVisible();
  await expect(sara.getByRole("link", { name: "registration.pdf" })).toBeVisible();
  const orgUrl = sara.url().replace("/dashboard?registered=1", "");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(fridgeUrl);
  await expect(visitor.getByText("This fridge isn't on the map.")).toBeVisible();
  await visitor.goto(orgUrl);
  await expect(visitor.getByText(/doesn't exist or you don't have access/)).toBeVisible();
  expect((await visitor.request.get("/api/admin/pending")).status()).toBe(401);
  expect((await sara.request.get("/api/admin/pending")).status()).toBe(403);

  const admin = await signIn(browser, "admin@demo.freshshare.de");
  await admin.goto("/admin");
  await admin.getByRole("button", { name: `Approve E2E fridge ${stamp}` }).click();
  await admin.getByRole("button", { name: `Approve E2E Kitchen ${stamp}` }).click();
  await expect(admin.getByRole("button", { name: `Approve E2E Kitchen ${stamp}` })).toHaveCount(0);

  await visitor.goto(fridgeUrl);
  await expect(visitor.getByRole("heading", { name: `E2E fridge ${stamp}` })).toBeVisible();
  await visitor.goto("/organizations");
  await expect(visitor.getByText(`E2E Kitchen ${stamp}`)).toBeVisible();
});

test("fridge check-in shows a thank-you and lands in the history", async ({ browser }) => {
  const sara = await signIn(browser, "sara@demo.freshshare.de");
  await sara.goto("/fridges");
  await sara.getByRole("link", { name: /Parish Hall/ }).first().click();
  await sara.getByRole("radio", { name: "Half full" }).check({ force: true });
  await sara.getByLabel(/What's inside/).fill("Bread and apples");
  await sara.getByRole("button", { name: "Save check-in" }).click();
  await expect(sara.getByText("Thanks! Neighbours will see this.")).toBeVisible();
  await expect(sara.getByText("Bread and apples")).toBeVisible();
});

test("org roles: invite offers four roles, viewer is blocked, manager runs a bulk claim, volunteer collects", async ({ browser }) => {
  const rosa = await signIn(browser, "rosa@demo.freshshare.de");
  await rosa.goto("/organizations");
  await rosa.getByRole("link", { name: /Demo Food Bank Erlangen/ }).click();
  await rosa.getByRole("link", { name: /Open team dashboard/ }).click();
  const options = await rosa.getByLabel("Role", { exact: true }).locator("option").allTextContents();
  expect(options.map((o) => o.split(":")[0])).toEqual(["Admin", "Manager", "Volunteer", "Viewer"]);
  const dashUrl = rosa.url();
  const orgId = dashUrl.split("/organizations/")[1].split("/")[0];

  const omar = await signIn(browser, "omar@demo.freshshare.de");
  await omar.goto(`/organizations/${orgId}/bulk-claims/new`);
  await expect(omar.getByRole("heading", { name: "Page not found" })).toBeVisible();

  const ben = await signIn(browser, "bent@demo.freshshare.de");
  await ben.goto(dashUrl);
  await ben.getByRole("link", { name: "New pickup run" }).click();
  await ben.getByLabel("Name").fill("E2E Saturday run");
  const boxes = ben.getByRole("checkbox");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await ben.getByRole("button", { name: "Request 2 listings" }).click();
  await expect(ben.getByRole("status")).toHaveText("Waiting for givers");
  const runUrl = ben.url();

  // A giver confirms the first item through the normal pickups page
  const first = await ben.request.get(`/api/bulk-claims/${runUrl.split("/bulk-claims/")[1]}`);
  const item = (await first.json()).bulkClaim.items[0];
  const giverEmail = { "Anna K.": "anna", "Mehmet Y.": "mehmet", "Lena S.": "lena", "Priya R.": "priya", "Tom B.": "tom", "Jonas W.": "jonas" }[
    item.listing.giver.name as string
  ];
  const giver = await signIn(browser, `${giverEmail}@demo.freshshare.de`);
  await giver.goto(`/pickups/${item.claimId}`);
  await giver.getByRole("button", { name: "Confirm pickup" }).click();

  const mia = await signIn(browser, "mia@demo.freshshare.de");
  await mia.goto(runUrl);
  await expect(mia.getByRole("status")).toHaveText("In progress");
  await mia.locator("input[type=checkbox]:not([disabled])").first().click();
  await expect(mia.getByRole("status")).toHaveText("Partially collected");
});
