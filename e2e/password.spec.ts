import { expect, test } from "@playwright/test";

// Password show/hide toggle and the forgot/reset password pages.
test("password field can be shown and hidden, and forgot password gives the same answer for any email", async ({ page }) => {
  await page.goto("/signin");
  const field = page.getByLabel("Password");
  await field.fill("secret-123");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(field).toHaveAttribute("type", "password");

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists/i)).toBeVisible();
});

test("reset page refuses an invalid link", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token-000000000000");
  await page.getByLabel("New password").fill("new-password-1");
  await page.getByLabel("Repeat it").fill("new-password-1");
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
