import { expect, test, type Browser, type Page } from "@playwright/test";

// Tier 2: QR pickup code (T2.6), waitlist (T2.3) and blocking (T2.5).
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

async function availableListingOf(page: Page, giverEmailPrefix: string) {
  // Bananas (Lena) and sourdough (Lena) are hand-written seed listings within 2 km.
  const res = await page.request.get("/api/listings?lat=49.5897&lng=11.0040&radius=3000");
  const all = (await res.json()).listings as { id: string; title: string; giver: { name: string } }[];
  const l = all.find((x) => x.giver.name.toLowerCase().startsWith(giverEmailPrefix));
  if (!l) throw new Error(`no available listing from ${giverEmailPrefix}`);
  return l;
}

test("waitlist and QR pickup: second person joins the waitlist, giver confirms the handover with the code", async ({ browser }) => {
  const priya = await signIn(browser, "priya@demo.freshshare.de");
  const l = await availableListingOf(priya, "lena");

  // Priya reserves
  await priya.goto(`/listings/${l.id}`);
  await priya.getByRole("button", { name: "Reserve" }).click();
  await expect(priya).toHaveURL(/\/pickups\//);
  const pickupUrl = priya.url();

  // Ben finds it taken and joins the waitlist
  const ben = await signIn(browser, "ben@demo.freshshare.de");
  await ben.goto(`/listings/${l.id}`);
  const box = ben.getByTestId("waitlist-box");
  await expect(box).toContainText("Reserved by someone else");
  await box.getByRole("button", { name: /Join waitlist/ }).click();
  await expect(box).toContainText("#1");

  // Lena confirms; Priya sees a QR code and 6 digits
  const lena = await signIn(browser, "lena@demo.freshshare.de");
  await lena.goto(pickupUrl);
  await lena.getByRole("button", { name: "Confirm pickup" }).click();
  await expect(lena.getByRole("status")).toContainText("Confirmed");
  await priya.reload();
  await expect(priya.getByRole("img", { name: /QR code for pickup code/ })).toBeVisible();
  const code = (await priya.getByTestId("pickup-code").textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);

  // Scanning the QR opens the pickup with the code filled in; Lena confirms the handover
  await lena.goto(`${pickupUrl}?code=${code}`);
  await expect(lena.getByLabel("Pickup code")).toHaveValue(code);
  await lena.getByRole("button", { name: "Confirm handover" }).click();
  await expect(lena.getByRole("status")).toContainText("Collected");
});

test("blocking someone hides their food from your map", async ({ browser }) => {
  const omar = await signIn(browser, "omar@demo.freshshare.de");
  const l = await availableListingOf(omar, "mehmet");
  await omar.goto(`/listings/${l.id}`);
  await omar.getByRole("link", { name: /Mehmet/ }).first().click();
  await expect(omar).toHaveURL(/\/users\//);
  await omar.getByRole("button", { name: /^Block Mehmet/ }).click();
  await omar.getByRole("group", { name: /Block Mehmet/ }).getByRole("button", { name: "Block" }).click();
  await expect(omar.getByText("You blocked Mehmet.")).toBeVisible();
  const res = await omar.request.get("/api/listings?lat=49.5897&lng=11.0040&radius=3000");
  expect(((await res.json()).listings as { giver: { name: string } }[]).some((x) => x.giver.name.startsWith("Mehmet"))).toBe(false);

  await omar.goto("/profile");
  const blocked = omar.getByRole("region", { name: "Blocked people" });
  await blocked.getByRole("button", { name: "Unblock" }).click();
  await expect(blocked).toHaveCount(0);
});
