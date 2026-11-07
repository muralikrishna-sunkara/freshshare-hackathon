import { expect, test, type Browser, type Page } from "@playwright/test";

// The pitch demo path (docs/04-build-plan.md, Block 7). Needs freshly seeded data.
const PASSWORD = "freshshare-demo"; // DEMO seed password

async function signIn(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

test("Sara reserves Anna's lasagne, Anna confirms, Sara collects and rates", async ({ browser }) => {
  const sara = await signIn(browser, "sara@demo.freshshare.de");
  await expect(sara.getByText("8 listings within 2 km")).toBeVisible();
  const banner = sara.getByText(/This week your neighbourhood saved \d+ portions/);
  await expect(banner).toBeVisible();
  const portionsBefore = Number((await banner.innerText()).match(/saved (\d+) portions/)![1]);

  // Open the lasagne from the list view (pins can overlap)
  // Desktop shows the list in the sidebar; on a phone switch to the list view.
  const listTab = sara.getByRole("tab", { name: "list" });
  if (await listTab.isVisible()) await listTab.click();
  await sara.getByRole("heading", { name: "Vegetable lasagne, 3 portions" }).click();
  const sheet = sara.getByRole("dialog");
  await expect(sheet.getByRole("img", { name: "Vegetable lasagne, 3 portions" })).toBeVisible();
  await expect(sheet.getByText("Homemade")).toBeVisible();
  await expect(sheet.getByText(/Best before \d+ \w+/)).toBeVisible();
  await expect(sheet.getByText("Verified")).toBeVisible();
  await expect(sheet.getByText("4.9")).toBeVisible();
  await expect(sheet.getByText(/exact address once Anna confirms/)).toBeVisible();
  await sheet.getByRole("button", { name: "Reserve" }).click();
  await expect(sara).toHaveURL(/\/pickups\//);
  await expect(sara.getByRole("status")).toContainText("Waiting for Anna to confirm");
  await expect(sara.getByText("Open in maps")).toHaveCount(0);
  await sara.getByRole("button", { name: "On my way" }).click();
  await expect(sara.getByLabel("Chat").locator("p").getByText("On my way")).toBeVisible();

  // Anna confirms on the laptop
  const anna = await signIn(browser, "anna@demo.freshshare.de");
  await anna.goto("/pickups");
  await anna.getByText("Needs your confirmation").click();
  await expect(anna.getByLabel("Chat").locator("p").getByText("On my way")).toBeVisible(); // chat reached Anna
  await anna.getByLabel("Message").fill("See you soon!");
  await anna.getByRole("button", { name: "Send" }).click();
  await anna.getByRole("button", { name: "Confirm pickup" }).click();
  await expect(anna.getByRole("status")).toContainText("Confirmed");

  // Back on Sara's phone: exact location, collect, rate
  await sara.reload();
  await expect(sara.getByRole("status")).toContainText("Confirmed");
  await expect(sara.getByText("Open in maps")).toBeVisible();
  await expect(sara.getByLabel("Chat").locator("p").getByText("See you soon!")).toBeVisible();
  await sara.getByRole("button", { name: "Mark collected" }).click();
  await expect(sara.getByRole("status")).toContainText("Collected");
  await sara.getByRole("radio", { name: "5 stars" }).click();
  await sara.getByRole("button", { name: "Send rating" }).click();
  await expect(sara.getByText(/You rated Anna/)).toBeVisible();

  // Impact counter went up by the lasagne's 3 portions
  await sara.goto("/");
  await expect(sara.getByText(`saved ${portionsBefore + 3} portions`, { exact: false })).toBeVisible();
});
