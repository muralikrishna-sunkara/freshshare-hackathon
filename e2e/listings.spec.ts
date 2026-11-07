import { expect, test, type Browser, type Page } from "@playwright/test";
import path from "node:path";

// Kit BUILD_PLAN steps 6-8: multi-photo posting with a category template, privacy, report, filters in the URL,
// decline, live chat and post again. Uses its own fresh listing, so it can run after the demo path.
const PASSWORD = "freshshare-demo"; // DEMO seed password
const photo = path.join(__dirname, "..", "data", "seed-photos", "soup.jpg");

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
  return page;
}

test("post with a template and two photos, privacy holds, decline, live chat, post again", async ({ browser }) => {
  const title = `Pumpkin soup ${Date.now() % 100000}`;
  const anna = await signIn(browser, "anna@demo.freshshare.de");
  await anna.goto("/share");
  await anna.getByRole("button", { name: /Leftovers/ }).click();
  await expect(anna.getByRole("button", { name: "Homemade" })).toHaveAttribute("aria-pressed", "true");
  await expect(anna.getByRole("button", { name: "Vegetarian" })).toHaveAttribute("aria-pressed", "true");
  await anna.getByLabel("Photo", { exact: true }).setInputFiles([photo, photo]);
  await expect(anna.getByRole("img", { name: "Photo 2" })).toBeVisible();
  await anna.getByLabel("What is it?").fill("Raw meat patties");
  for (const c of ["Stored cold", "Not past its date", "I would eat it myself"]) await anna.getByLabel(new RegExp(c)).check();
  await anna.getByRole("button", { name: "Post to the map" }).click();
  await expect(anna.getByText(/Raw meat and fish can't be shared/)).toBeVisible();
  await anna.getByLabel("What is it?").fill(title);
  await anna.getByRole("button", { name: "Post to the map" }).click();
  await expect(anna).toHaveURL(/\/map\?listing=/);
  const listingId = new URL(anna.url()).searchParams.get("listing")!;

  // Visitor: no exact coordinates or handover details in the listing page or its API
  const visitor = await (await browser.newContext()).newPage();
  const api = await visitor.request.get(`/api/listings/${listingId}`);
  const body = await api.json();
  expect(body.listing.lat).toBeUndefined();
  expect(body.listing.photos).toHaveLength(2);
  await visitor.goto(`/listings/${listingId}`);
  await expect(visitor.getByRole("heading", { name: title })).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Photo 2 of 2" })).toBeVisible();
  await expect(visitor.getByText("49.5936")).toHaveCount(0);

  // Filters are kept in the URL
  await visitor.goto("/map?km=5&diet=vegetarian");
  await expect(visitor.getByText(/listings? found within 5 km/)).toBeVisible();
  await expect(visitor.getByLabel("Dietary")).toHaveValue("vegetarian");

  // Sara reports it, reserves it; Anna declines
  const sara = await signIn(browser, "sara@demo.freshshare.de");
  await sara.goto(`/listings/${listingId}`);
  await sara.getByRole("button", { name: "Report listing" }).click();
  await sara.getByLabel("Spam").check();
  await sara.getByRole("button", { name: "Send report" }).click();
  await expect(sara.getByText(/Thanks for telling us/)).toBeVisible();
  await sara.getByRole("button", { name: "Close" }).click();
  await sara.getByRole("button", { name: "Reserve" }).click();
  await expect(sara).toHaveURL(/\/pickups\//);
  const claimUrl = sara.url();

  await anna.goto(claimUrl);
  await expect(anna.getByRole("status")).toContainText("wants this");
  // Live chat: Sara's message appears for Anna without a reload
  await sara.getByLabel("Message").fill("Hello from the stream");
  await sara.getByRole("button", { name: "Send" }).click();
  await expect(anna.getByLabel("Chat").getByText("Hello from the stream")).toBeVisible({ timeout: 8000 });
  await anna.getByRole("button", { name: "Decline" }).click();
  await expect(anna.getByRole("status")).toContainText("You declined");
  await sara.reload();
  await expect(sara.getByRole("status")).toContainText("couldn't make this one work");

  // Post again from My pickups copies the listing with its photos
  await anna.goto("/pickups");
  await anna.getByRole("link", { name: title }).locator("..").getByRole("link", { name: "Post again" }).click();
  await expect(anna.getByRole("heading", { name: "Post again" })).toBeVisible();
  await expect(anna.getByLabel("What is it?")).toHaveValue(title);
  for (const c of ["Stored cold", "Not past its date", "I would eat it myself"]) await anna.getByLabel(new RegExp(c)).check();
  await anna.getByRole("button", { name: "Post to the map" }).click();
  await expect(anna).toHaveURL(/\/map\?listing=/);
  const again = await anna.request.get(`/api/listings/${new URL(anna.url()).searchParams.get("listing")}`);
  expect((await again.json()).listing.photos).toEqual(body.listing.photos);
});
