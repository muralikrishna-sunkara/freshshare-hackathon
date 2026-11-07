import { expect, test, type Browser, type Page } from "@playwright/test";

// T2.1: a reservation shows up on the giver's bell live, the page lists it, mark-all-read clears it.
const PASSWORD = "freshshare-demo"; // DEMO seed password

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
  return page;
}

test("the giver's bell lights up live and the notifications page clears it", async ({ browser }) => {
  const lena = await signIn(browser, "lena@demo.freshshare.de");
  await lena.request.post("/api/notifications/read-all");
  await lena.reload();
  await expect(lena.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();

  // Jonas reserves one of Lena's listings through the API.
  const jonas = await signIn(browser, "jonas@demo.freshshare.de");
  const near = await (await jonas.request.get("/api/listings?lat=49.5897&lng=11.0040&radius=10000")).json();
  const target = near.listings.find((l: { giver: { name: string } }) => l.giver.name.startsWith("Lena"));
  expect((await jonas.request.post(`/api/listings/${target.id}/claims`)).status()).toBe(201);

  // No reload: the SSE stream updates the badge within a few seconds.
  await expect(lena.getByTestId("unread-badge")).toHaveText("1", { timeout: 10_000 });
  await lena.getByRole("link", { name: /Notifications, 1 unread/ }).click();
  await expect(lena).toHaveURL(/\/notifications/);
  await expect(lena.getByRole("button").filter({ hasText: `Jonas would like your ${target.title}` })).toBeVisible();
  await lena.getByRole("button", { name: "Mark all as read" }).click();
  await expect(lena.getByText("You're all caught up.")).toBeVisible();
  await expect(lena.getByTestId("unread-badge")).toHaveCount(0);

  // Clean up so later runs start from the same state.
  const mine = await (await jonas.request.get("/api/claims")).json().catch(() => null);
  const claim = mine?.asReceiver?.find((c: { listing: { id: string }; status: string }) => c.listing.id === target.id && c.status === "pending");
  if (claim) await jonas.request.post(`/api/claims/${claim.id}/cancel`);
});
