import { expect, test } from "@playwright/test";

// T2.7: the EN/DE switch in the header translates the app and remembers the choice.
test("switch the app to German and back", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "Browse food" })).toBeVisible();
  const lang = page.getByRole("group", { name: "Language" });
  await lang.getByRole("button", { name: "DE" }).click();

  await expect(page.getByRole("heading", { name: "Essen entdecken" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("button", { name: /Kartenansicht/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Essen teilen" }).first()).toBeVisible();

  // The choice survives a reload and applies to other pages.
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByLabel("Passwort", { exact: true })).toBeVisible();

  await page.getByRole("group", { name: "Sprache" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
