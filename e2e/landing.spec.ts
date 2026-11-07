import { expect, test } from "@playwright/test";

// Landing page, early access with ?src=, and the sign-up consent rules (kit BUILD_PLAN steps 3 and 5).
test("landing page shows the pitch, live stats and early access with a thank-you", async ({ page }) => {
  await page.goto("/?src=e2e");
  await expect(page.getByRole("heading", { name: "Good food shouldn't end up in the bin" })).toBeVisible();
  await expect(page.getByText("1.05 billion tonnes")).toBeVisible();
  await expect(page.getByText("In Germany:")).toBeVisible();
  await expect(page.getByText("Meals shared")).toBeVisible();
  await page.getByText("Is it free?").click();
  await expect(page.getByText(/Food on FreshShare is always free/)).toBeVisible();

  const form = page.locator("#early-access");
  await form.getByLabel("Email", { exact: true }).fill(`e2e-${Date.now()}@example.test`);
  await form.getByRole("button", { name: "Join early access" }).click();
  await expect(form.getByText("Please pick one")).toBeVisible();
  await expect(form.getByText("Please tick this so we can email you")).toBeVisible();
  await form.getByLabel("I host a community fridge").check();
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Join early access" }).click();
  await expect(form.getByText("Thank you, you're on the list!")).toBeVisible();
});

test("sign-up needs 16+ and the Terms & Conditions, ticked only through I Accept", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("longenough");
  await page.getByLabel("I am 16 or older").check();

  // Decline leaves the box unticked and sign-up is blocked
  await page.getByRole("button", { name: "Terms & Conditions" }).click();
  const dialog = page.getByRole("dialog", { name: "Terms & Conditions" });
  await expect(dialog.getByText("Food Donor Guidelines")).toBeVisible();
  await expect(dialog.getByText("Pet food or animal feed (unless specifically designated)")).toBeVisible();
  await dialog.getByRole("button", { name: "Decline" }).click();
  const termsBox = page.getByRole("checkbox", { name: /I accept the/ });
  await expect(termsBox).not.toBeChecked();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Please read and accept the Terms & Conditions")).toBeVisible();

  // I Accept ticks it and the account is created
  await page.getByRole("button", { name: "Terms & Conditions" }).click();
  await dialog.getByRole("button", { name: "I Accept Terms & Conditions" }).click();
  await expect(termsBox).toBeChecked();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/map$/);
});

test("footer pages, public profile and 404", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Prohibited Items" })).toBeVisible();
  for (const [link, heading] of [["Privacy", "Privacy"], ["Imprint", "Imprint"], ["Contact", "Contact"]]) {
    await page.getByRole("contentinfo").getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/map");
  await page.getByRole("link", { name: "Anna K." }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Anna K." })).toBeVisible();
  await expect(page.getByText("Reviews")).toBeVisible();
  await expect(page.getByText("@demo.freshshare")).toHaveCount(0);
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
