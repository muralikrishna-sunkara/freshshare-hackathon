import { expect, test } from "@playwright/test";

// The same web app in a phone browser: map/list toggle and the listing bottom sheet.
test("browse listings on a phone-sized browser", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByText(/listings? within 2 km/)).toBeVisible();
  await page.getByRole("tab", { name: "list" }).click();
  await page.getByRole("heading", { name: "Bag of apples from our tree" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(/Best before \d+ \w+/)).toBeVisible();
  await expect(sheet.getByText("Fresh produce")).toBeVisible();
});
