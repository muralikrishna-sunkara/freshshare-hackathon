import { expect, test, type Browser, type Page } from "@playwright/test";

// T3.2: personal and organization impact, the shareable impact card and the organization report PDF.
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

test("profile shows personal impact with a shareable card that is a real PNG", async ({ browser }) => {
  const anna = await signIn(browser, "anna@demo.freshshare.de");
  await anna.goto("/profile");
  const panel = anna.getByRole("region", { name: "Your impact" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/kg CO₂e/).first()).toBeVisible();
  await expect(panel.getByRole("button", { name: "Share impact card" })).toBeVisible();
  const img = panel.getByRole("img", { name: /impact card/ });
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  const res = await anna.request.get(src!);
  expect(res.headers()["content-type"]).toBe("image/png");

  // Anyone can see the aggregates on the public profile, without the share controls.
  const userId = src!.split("/")[4];
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/users/${userId}`);
  await expect(visitor.getByRole("region", { name: "Impact" })).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Share impact card" })).toHaveCount(0);
});

test("organization members can download the impact report PDF", async ({ browser }) => {
  const rosa = await signIn(browser, "rosa@demo.freshshare.de");
  await rosa.goto("/organizations");
  await rosa.getByRole("link", { name: /Demo Food Bank Erlangen/ }).first().click();
  await rosa.getByRole("link", { name: /dashboard/i }).first().click();
  const link = rosa.getByRole("link", { name: /Download impact report \(PDF\)/ });
  await expect(link).toBeVisible();
  const res = await rosa.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Visitors see the public impact numbers but no report link.
  const orgUrl = rosa.url().replace("/dashboard", "");
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(orgUrl);
  await expect(visitor.getByRole("region", { name: "Impact" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: /Download impact report/ })).toHaveCount(0);
});
