import { expect, test, type Browser, type Page } from "@playwright/test";

// T2.2 alert settings and T2.4 recurring listings.
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

test("alert settings save distance and categories", async ({ browser }) => {
  const jonas = await signIn(browser, "jonas@demo.freshshare.de");
  await jonas.request.put("/api/alerts", { data: { enabled: false } }); // start from "off" on every run
  await jonas.goto("/profile");
  const box = jonas.getByRole("region", { name: "Food alerts near home" });
  const toggle = box.getByRole("checkbox", { name: "Food alerts near home" });
  await toggle.dispatchEvent("click"); // visually-hidden switch input
  await expect(toggle).toBeChecked();
  await box.getByRole("button", { name: "1 km" }).click();
  await box.getByRole("button", { name: /Bread/ }).click();
  await expect(box.getByRole("button", { name: /Bread/ })).toHaveAttribute("aria-pressed", "true");
  await jonas.reload();
  await expect(jonas.getByRole("region", { name: "Food alerts near home" }).getByRole("button", { name: "1 km" })).toHaveAttribute("aria-pressed", "true");
  const saved = await (await jonas.request.get("/api/alerts")).json();
  expect(saved.alert).toMatchObject({ enabled: true, radiusM: 1000, categories: ["bread"] });
  expect(typeof saved.alert.lat).toBe("number");
});

test("a giver makes a listing recurring, then pauses it", async ({ browser }) => {
  const mehmet = await signIn(browser, "mehmet@demo.freshshare.de");
  const mine = (await (await mehmet.request.get("/api/listings/mine/all")).json()).listings as { id: string; origin: string; title: string; status: string }[];
  const l = mine.find((x) => x.origin !== "homemade")!;
  await mehmet.goto(`/listings/${l.id}`);
  await mehmet.getByRole("link", { name: /Repeat on a schedule/ }).click();
  await expect(mehmet.getByText(`Repeat “${l.title}”`)).toBeVisible();
  await mehmet.getByRole("group", { name: "Days" }).getByRole("button", { name: "Sat" }).click();
  await mehmet.getByLabel("Goes up at").fill("08:30");
  await mehmet.getByRole("button", { name: "Make it recurring" }).click();
  const row = mehmet.getByRole("listitem").filter({ hasText: l.title });
  await expect(row).toContainText("Mon, Tue, Wed, Thu, Fri, Sat at 08:30");
  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row).toContainText("Paused");
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
});
