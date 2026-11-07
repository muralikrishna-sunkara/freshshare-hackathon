import { expect, test, type Page } from "@playwright/test";

// Find food opens as a list with any distance; givers can edit their own listing.
const PASSWORD = "freshshare-demo"; // DEMO seed password

async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/map/);
}

test("list view is the default and the distance filter can be cleared", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "Browse food" })).toBeVisible();
  const any = page.getByRole("button", { name: "Any distance" });
  await expect(any).toHaveAttribute("aria-pressed", "true");
  const countAny = page.getByText(/\d+ listings? found nearby, nearest first/);
  await expect(countAny).toBeVisible();
  const nAny = Number((await countAny.innerText()).match(/\d+/)![0]);

  await page.getByRole("button", { name: "1 km", exact: true }).click();
  await expect(page).toHaveURL(/km=1/);
  const count1 = page.getByText(/\d+ listings? found within 1 km/);
  await expect(count1).toBeVisible();
  expect(Number((await count1.innerText()).match(/\d+/)![0])).toBeLessThanOrEqual(nAny);

  // Tapping the selected chip again clears it.
  await page.getByRole("button", { name: "1 km", exact: true }).click();
  await expect(page).not.toHaveURL(/km=/);
  await expect(any).toHaveAttribute("aria-pressed", "true");
});

test("a giver edits their listing", async ({ page }) => {
  await signIn(page, "lena@demo.freshshare.de");
  const res = await page.request.get("/api/listings/mine/all");
  const mine = ((await res.json()).listings as { id: string; title: string; status: string }[]).find((l) => l.status === "available");
  if (!mine) throw new Error("Lena has no available listing");

  await page.goto(`/listings/${mine.id}`);
  await page.getByRole("link", { name: /Edit listing/ }).click();
  await expect(page.getByRole("heading", { name: "Edit listing" })).toBeVisible();
  const title = page.getByLabel("What is it?");
  await expect(title).toHaveValue(mine.title);
  await title.fill(`${mine.title} (edited)`);
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`listing=${mine.id}`));
  await expect(page.getByRole("dialog").getByText(`${mine.title} (edited)`).first()).toBeVisible();
});
