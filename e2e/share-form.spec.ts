import path from "node:path";
import { expect, test, type Browser } from "@playwright/test";

// Share form: required-field validation, Fill from photo on the first photo, description and
// pickup instructions as separate fields, and instructions shown only after the giver confirms.
const PASSWORD = "freshshare-demo"; // DEMO seed password
const photo = path.join(__dirname, "..", "data", "seed-photos", "soup.jpg");

async function signIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
  return page;
}

test("share form validates, fills from the photo and keeps pickup instructions private", async ({ browser }) => {
  const lena = await signIn(browser, "lena@demo.freshshare.de");
  // The AI call itself is covered by the api tests; here the browser gets a fixed suggestion.
  let aiCalls = 0;
  await lena.route("**/api/ai/status", (r) => r.fulfill({ json: { photoAutofill: true } }));
  await lena.route("**/api/ai/photo-suggestions", (r) => {
    aiCalls++;
    return r.fulfill({
      json: { suggestion: { title: "Vegetable soup, 2 jars", category: "leftovers", origin: "homemade", dietaryTags: ["vegan"], allergens: ["celery"] } },
    });
  });

  // The top bar no longer has its own Share food button.
  await expect(lena.getByRole("banner").getByRole("link", { name: /Share food/ })).toHaveCount(0);

  await lena.goto("/share");
  await expect(lena.getByText("* required")).toBeVisible();
  for (const label of ["What is it?", "Best before"]) await expect(lena.getByText(`${label} *`, { exact: true })).toBeVisible();

  // Submitting an empty form lists everything that is missing.
  await lena.getByRole("button", { name: "Post to the map" }).click();
  const alert = lena.getByRole("alert").filter({ hasText: "Please fix these before posting" });
  for (const msg of ["Add at least one photo.", "Give it a short title (at least 3 letters).", "Choose Homemade, Packaged or Fresh produce.", "Tick all three safety checks."]) {
    await expect(alert.getByText(msg)).toBeVisible();
  }
  await expect(lena.getByLabel("What is it?")).toHaveAttribute("aria-invalid", "true");

  // Picking the first photo runs Fill from photo by itself.
  await lena.getByLabel("Photo", { exact: true }).setInputFiles(photo);
  await expect(lena.getByText(/We filled in the details from your photo/)).toBeVisible();
  expect(aiCalls).toBe(1);
  await expect(lena.getByLabel("What is it?")).toHaveValue("Vegetable soup, 2 jars");
  await expect(lena.getByRole("button", { name: "Homemade" })).toHaveAttribute("aria-pressed", "true");
  await expect(alert.getByText("Add at least one photo.")).toHaveCount(0);

  const title = `Vegetable soup ${Date.now() % 100000}`;
  await lena.getByLabel("What is it?").fill(title);
  await lena.getByLabel(/^Description/).fill("Mild, no chilli. Made this morning.");
  await lena.getByLabel(/^Pickup instructions/).fill("Ring the bell for Weber, 2nd floor.");
  // Still blocked until the safety ticks are done.
  await lena.getByRole("button", { name: "Post to the map" }).click();
  await expect(alert.getByText("Tick all three safety checks.")).toBeVisible();
  for (const c of ["Stored cold", "Not past its date", "I would eat it myself"]) await lena.getByLabel(new RegExp(c)).check();
  await expect(alert).toHaveCount(0);
  await lena.getByRole("button", { name: "Post to the map" }).click();
  await expect(lena).toHaveURL(/\/map\?listing=/);
  const listingId = new URL(lena.url()).searchParams.get("listing")!;

  // The giver sees both fields on the listing page.
  await lena.goto(`/listings/${listingId}`);
  await expect(lena.getByText("Mild, no chilli. Made this morning.")).toBeVisible();
  await expect(lena.getByText("Ring the bell for Weber, 2nd floor.")).toBeVisible();

  // A neighbour sees the description, but the pickup instructions only after the giver confirms.
  const sara = await signIn(browser, "sara@demo.freshshare.de");
  await sara.goto(`/listings/${listingId}`);
  await expect(sara.getByText("Mild, no chilli. Made this morning.")).toBeVisible();
  await expect(sara.getByText("Ring the bell for Weber")).toHaveCount(0);
  const claim = await (await sara.request.post(`/api/listings/${listingId}/claims`)).json();
  const claimId = claim.claim.id as string;
  await sara.goto(`/pickups/${claimId}`);
  await expect(sara.getByRole("status").filter({ hasText: "Waiting for" })).toBeVisible();
  await expect(sara.getByText("Ring the bell for Weber")).toHaveCount(0);

  expect((await lena.request.post(`/api/claims/${claimId}/confirm`)).ok()).toBe(true);
  await sara.reload();
  await expect(sara.getByText("Ring the bell for Weber, 2nd floor.")).toBeVisible();
});
