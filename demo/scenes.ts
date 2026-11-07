import path from "node:path";
import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { APP_URL, GIVER_BY_NAME, ROOT } from "./config";
import { api, beat, click, go, moveTo, ready, scroll, timer, type, addressBar, type Stage } from "./lib/stage";

// One scene per chapter. Each scene drives the real app with real clicks and checks a real result.
// Data the later chapters need (the claim from chapter 5) is passed along in `State`.

export interface State {
  stamp: number;
  postedListingId?: string;
  claimId?: string;
  claimGiver?: string;
}

export interface SceneCtx {
  browser: Browser;
  stage: Stage;
  state: State;
  /** Phone chapter: background card the 390 px recording is placed on. */
  phoneBg?: string;
}

export interface Scene {
  id: string;
  /** Short check that the module exists and works for the right role; throws with a reason if not. */
  check?: (c: SceneCtx) => Promise<void>;
  run: (c: SceneCtx) => Promise<void>;
  /** Puts production data back where it was (cancelled claims, unblocked users). Never fails the scene. */
  cleanup?: (c: SceneCtx) => Promise<void>;
  needs?: string; // id of a chapter that must have been recorded first
}

const HOME = { lat: 49.5897, lng: 11.004 }; // Erlangen centre, where the seed lives

interface ApiListing {
  id: string;
  title: string;
  status: string;
  giver: { name: string };
}

async function nearby(request: APIRequestContext, radius = 3000): Promise<ApiListing[]> {
  const res = await request.get(`/api/listings?lat=${HOME.lat}&lng=${HOME.lng}&radius=${radius}`);
  if (!res.ok()) throw new Error(`listings API answered ${res.status()}`);
  return ((await res.json()).listings as ApiListing[]).filter((l) => l.status === "available");
}

async function pageOk(page: Page) {
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
}

const photo = (name: string) => path.join(ROOT, "data", "seed-photos", name);

export const SCENES: Scene[] = [
  // 1 ─────────────────────────────────────────────────────────────
  {
    id: "landing",
    check: async ({ browser }) => {
      const { ctx, request } = await api(browser, "sara");
      const r = await request.get("/?src=demo");
      await ctx.close();
      if (!r.ok()) throw new Error(`landing page answered ${r.status()}`);
    },
    run: async ({ stage, state }) => {
      const v = await stage.open(null, "Visitor");
      await go(v.page, "/?src=demo");
      await expect(v.page.getByRole("heading", { name: "Good food shouldn't end up in the bin" })).toBeVisible();
      await stage.shoot(v, async (p) => {
        await beat(p, 1200);
        await scroll(p, 800, 1400);
        await beat(p, 600);
        await scroll(p, 700, 1200);
        await moveTo(p, p.getByText("Meals shared"));
        await beat(p, 900);
        const form = p.locator("#early-access");
        await type(p, form.getByLabel("Email", { exact: true }), `early-${state.stamp}@demo.freshshare.de`);
        await click(p, form.getByText("I host a community fridge"), 300);
        await click(p, form.getByRole("checkbox"), 300);
        await click(p, form.getByRole("button", { name: "Join early access" }));
        await expect(form.getByText("Thank you, you're on the list!")).toBeVisible();
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 2 ─────────────────────────────────────────────────────────────
  {
    id: "signup",
    run: async ({ stage, state }) => {
      const v = await stage.open(null, "New neighbour");
      await go(v.page, "/signup");
      await pageOk(v.page);
      await stage.shoot(v, async (p) => {
        await type(p, p.getByLabel("Your name"), "Demo Neighbour");
        await type(p, p.getByLabel("Email"), `signup-${state.stamp}@demo.freshshare.de`);
        await type(p, p.getByLabel("Password"), "demo-password-1"); // DEMO throwaway password, shown masked
        await click(p, p.getByLabel("I am 16 or older"), 300);
        await click(p, p.getByRole("button", { name: "Terms & Conditions" }));
        const dialog = p.getByRole("dialog", { name: "Terms & Conditions" });
        await expect(dialog.getByText("Food Donor Guidelines")).toBeVisible();
        await moveTo(p, dialog.getByText("Food Donor Guidelines"));
        await scroll(p, 500, 900);
        await click(p, dialog.getByRole("button", { name: "Decline" }));
        const termsBox = p.getByRole("checkbox", { name: /I accept the/ });
        await expect(termsBox).not.toBeChecked();
        await click(p, p.getByRole("button", { name: "Create account" }));
        await expect(p.getByText("Please read and accept the Terms & Conditions")).toBeVisible();
        await beat(p, 600);
        await click(p, p.getByRole("button", { name: "Terms & Conditions" }));
        await click(p, dialog.getByRole("button", { name: "I Accept Terms & Conditions" }));
        await expect(termsBox).toBeChecked();
        await click(p, p.getByRole("button", { name: "Create account" }));
        await expect(p).toHaveURL(/\/map/);
        await ready(p);
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 2b ────────────────────────────────────────────────────────────
  {
    id: "verify",
    run: async ({ browser, stage, state }) => {
      // A fresh, unverified @demo.freshshare.de account for every recording (the flow can only be shown once per account).
      const reg = await browser.newContext({ baseURL: APP_URL });
      const res = await reg.request.post("/api/auth/register", {
        data: { name: "Lea N.", email: `verify-${state.stamp}-${Math.floor(Math.random() * 1000)}@demo.freshshare.de`, password: "demo-password-1", homeLat: 49.5897, homeLng: 11.004, ageConfirmed: true, termsAccepted: true }, // DEMO throwaway account
      });
      if (res.status() !== 201) throw new Error(`register answered ${res.status()}: ${(await res.text()).slice(0, 200)}`);
      const session = path.join(stage.dir, "fresh-user.json");
      await reg.storageState({ path: session });
      await reg.close();
      const t = await stage.open({ storageState: session }, "Lea · new neighbour");
      await go(t.page, "/profile");
      const badge = t.page.getByRole("heading", { name: "Get your Verified badge" });
      await expect(badge).toBeVisible();
      await stage.shoot(t, async (p) => {
        await moveTo(p, badge);
        await beat(p, 500);
        await click(p, p.getByRole("button", { name: /Confirm email/ }));
        await type(p, p.getByLabel("Phone number"), "+49 170 1234567");
        await type(p, p.getByLabel(/Code from SMS/), "123456"); // DEMO verification code, labelled DEMO in the UI
        await click(p, p.getByRole("button", { name: "Verify phone" }), 0);
        await expect(p.getByRole("heading", { name: "Get your Verified badge" })).toHaveCount(0);
        await p.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })");
        await beat(p, 700);
        const v = p.getByText("Verified").first();
        await expect(v).toBeVisible();
        await moveTo(p, v);
        await beat(p, 900);
        // Food alerts near home
        // Food alerts near home (as in e2e/alerts-recurring.spec.ts on main)
        const box = p.getByRole("region", { name: "Food alerts near home" });
        const toggle = box.getByRole("checkbox", { name: "Food alerts near home" });
        await moveTo(p, box.getByRole("heading", { name: "Food alerts near home" }));
        await beat(p, 300);
        if (!(await toggle.isChecked())) await toggle.dispatchEvent("click"); // visually hidden switch input
        await expect(toggle).toBeChecked();
        await beat(p, 500);
        await click(p, box.getByRole("button", { name: "1 km" }), 300);
        await click(p, box.getByRole("button", { name: /Bread/ }), 0);
        await expect(box.getByRole("button", { name: /Bread/ })).toHaveAttribute("aria-pressed", "true");
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 3 ─────────────────────────────────────────────────────────────
  {
    id: "post",
    run: async ({ stage, state }) => {
      const a = await stage.open("anna", "Anna · giver");
      await go(a.page, "/share");
      await pageOk(a.page);
      await stage.shoot(a, async (p) => {
        // On-screen stopwatch: posting should take under 30 seconds.
        await timer(p, "start");
        await click(p, p.getByRole("button", { name: /Bread/ }).first());
        await moveTo(p, p.getByText(/Add a photo|Photo/).first());
        await p.getByLabel("Photo", { exact: true }).setInputFiles(photo("rolls.jpg"));
        await expect(p.getByRole("img", { name: /photo/i }).first()).toBeVisible();
        await beat(p, 500);
        await type(p, p.getByLabel("What is it?"), "Bread rolls from this morning, 6 pieces");
        await moveTo(p, p.getByLabel("Best before (required)"));
        await beat(p, 400);
        for (const c of ["Stored cold", "Not past its date", "I would eat it myself"]) await click(p, p.getByLabel(new RegExp(c)), 150);
        await click(p, p.getByRole("button", { name: "Post to the map" }), 0);
        await expect(p).toHaveURL(/\/map\?listing=/);
        await timer(p, "stop");
        state.postedListingId = new URL(p.url()).searchParams.get("listing") ?? undefined;
        await ready(p);
        await beat(p, 1200);
      });
      await stage.hold();
    },
  },
  // 4 ─────────────────────────────────────────────────────────────
  {
    id: "browse",
    run: async ({ browser, stage }) => {
      const probe = await api(browser, "sara");
      const pick = (await nearby(probe.request)).find((l) => GIVER_BY_NAME[l.giver.name]);
      await probe.ctx.close();
      const word = (pick?.title.split(/[\s,]+/).find((w) => w.length > 3) ?? "bread").toLowerCase();
      const v = await stage.open(null, "Visitor");
      await go(v.page, "/map");
      await expect(v.page.getByText(/listings? within 2 km/).first()).toBeVisible();
      await expect(v.page.locator(".leaflet-container")).toBeVisible();
      await stage.shoot(v, async (p) => {
        await beat(p, 1000);
        const pins = p.locator(".leaflet-marker-icon");
        const n = await pins.count();
        for (const i of [0, Math.floor(n / 2), n - 1].filter((x, k, a) => x >= 0 && a.indexOf(x) === k)) {
          await moveTo(p, pins.nth(i)).catch(() => {});
          await beat(p, 300);
        }
        // Place search (T2.8): jump the map to a street; tolerant, because it relies on an external geocoder.
        try {
          const search = p.getByPlaceholder(/Search a street or place/).first();
          await type(p, search, "Schlossplatz");
          const opt = p.getByRole("option").first();
          await opt.waitFor({ state: "visible", timeout: 5000 });
          await click(p, opt, 1200);
        } catch {
          await p.keyboard.press("Escape").catch(() => {});
        }
        await click(p, p.getByRole("tab", { name: /List/ }));
        await expect(p.getByRole("heading", { name: "Browse food" })).toBeVisible();
        await beat(p, 600);
        await moveTo(p, p.getByRole("article").first());
        await scroll(p, 400, 900);
        await scroll(p, -400, 600);
        await type(p, p.getByLabel("Search listings"), word);
        await expect(p.getByRole("article").filter({ hasText: new RegExp(word, "i") }).first()).toBeVisible();
        await beat(p, 500);
        await click(p, p.getByRole("article").first().getByRole("button").first());
        const d = p.getByRole("dialog", { name: "Listing details" });
        await expect(d).toBeVisible();
        const approx = d.getByText(/exact address/i).first();
        if (await approx.count()) await moveTo(p, approx);
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 5 ─────────────────────────────────────────────────────────────
  {
    id: "claim",
    check: async ({ browser, state }) => {
      const { ctx, request } = await api(browser, "sara");
      const all = await nearby(request);
      await ctx.close();
      const target = all.find((l) => l.title.startsWith("Vegetable lasagne")) ?? all.find((l) => l.id === state.postedListingId) ?? all.find((l) => l.giver.name === "Anna K.");
      if (!target) throw new Error("no available listing from Anna (run npm run demo:reset to re-seed)");
    },
    run: async ({ browser, stage, state }) => {
      const { ctx, request } = await api(browser, "sara");
      const all = await nearby(request);
      await ctx.close();
      const target = (all.find((l) => l.title.startsWith("Vegetable lasagne")) ?? all.find((l) => l.id === state.postedListingId) ?? all.find((l) => l.giver.name === "Anna K."))!;

      const anna = await stage.open("anna", "Anna · giver", "half");
      const sara = await stage.open("sara", "Sara · receiver", "half");
      await go(anna.page, "/pickups");
      await go(sara.page, `/listings/${target.id}`);
      await expect(sara.page.getByRole("button", { name: "Reserve" })).toBeVisible();
      await stage.split(anna, sara, async (l, r) => {
        await beat(r, 700);
        const verified = r.getByText("Verified").first();
        if (await verified.count()) await moveTo(r, verified);
        await moveTo(r, r.getByText(/exact address once Anna confirms/).first()).catch(() => {});
        await beat(r, 600);
        await click(r, r.getByRole("button", { name: "Reserve" }), 0);
        await expect(r).toHaveURL(/\/pickups\//);
        await expect(r.getByRole("status")).toContainText("Waiting for Anna to confirm");
        await expect(r.getByText("Open in maps")).toHaveCount(0);
        state.claimId = r.url().split("/pickups/")[1].split("?")[0];
        await beat(r);

        await l.goto(`/pickups/${state.claimId}`);
        await ready(l);
        await expect(l.getByRole("status")).toContainText("wants this");
        await beat(l, 600);
        await click(l, l.getByRole("button", { name: "Confirm pickup" }), 0);
        await expect(l.getByRole("status")).toContainText("Confirmed");
        await beat(l, 600);

        const maps = r.getByText("Open in maps");
        if (!(await maps.isVisible().catch(() => false))) {
          await r.waitForTimeout(1500);
          if (!(await maps.isVisible())) {
            await r.reload();
            await ready(r);
          }
        }
        await expect(r.getByRole("status")).toContainText("Confirmed");
        await moveTo(r, maps);
        await beat(r, 1000);
      });
      state.claimGiver = "anna";
      await stage.hold();
    },
  },
  // 6 ─────────────────────────────────────────────────────────────
  {
    id: "chat",
    needs: "claim",
    run: async ({ stage, state }) => {
      const anna = await stage.open("anna", "Anna · giver", "half");
      const sara = await stage.open("sara", "Sara · receiver", "half");
      await go(anna.page, `/pickups/${state.claimId}`);
      await go(sara.page, `/pickups/${state.claimId}`);
      await expect(anna.page.getByLabel("Message")).toBeVisible();
      await stage.split(anna, sara, async (l, r) => {
        await beat(r, 500);
        await type(r, r.getByLabel("Message"), "On my way, see you in ten minutes!");
        await click(r, r.getByRole("button", { name: "Send" }), 0);
        await expect(l.getByLabel("Chat").getByText("On my way, see you in ten minutes!")).toBeVisible({ timeout: 8000 });
        await moveTo(l, l.getByLabel("Chat").getByText("On my way, see you in ten minutes!"));
        await beat(l, 900);
        await type(l, l.getByLabel("Message"), "Great, I'll be at the front door.");
        await click(l, l.getByRole("button", { name: "Send" }), 0);
        await expect(r.getByLabel("Chat").getByText("Great, I'll be at the front door.")).toBeVisible({ timeout: 8000 });
        await moveTo(r, r.getByLabel("Chat").getByText("Great, I'll be at the front door."));
        await beat(r, 1000);
      });
      await stage.hold();
    },
  },
  // 7 ─────────────────────────────────────────────────────────────
  {
    id: "pickup",
    needs: "claim",
    run: async ({ stage, state }) => {
      const anna = await stage.open("anna", "Anna · giver", "half");
      const sara = await stage.open("sara", "Sara · receiver", "half");
      await go(anna.page, `/pickups/${state.claimId}`);
      await go(sara.page, `/pickups/${state.claimId}`);
      const qr = sara.page.getByRole("img", { name: /QR code for pickup code/ });
      await expect(qr).toBeVisible();
      await stage.split(anna, sara, async (l, r) => {
        await moveTo(r, qr);
        await beat(r, 600);
        const code = (await r.getByTestId("pickup-code").textContent())!.trim();
        expect(code).toMatch(/^\d{6}$/);
        await moveTo(r, r.getByTestId("pickup-code"));
        await beat(r, 700);
        await type(l, l.getByLabel("Pickup code"), code);
        await click(l, l.getByRole("button", { name: "Confirm handover" }), 0);
        await expect(l.getByRole("status")).toContainText("Collected");
        await beat(l, 600);
        if (!(await r.getByRole("status").innerText()).includes("Collected")) {
          await r.reload();
          await ready(r);
        }
        await expect(r.getByRole("status")).toContainText("Collected");
        await click(r, r.getByRole("radio", { name: "5 stars" }), 200);
        await click(r, r.getByRole("button", { name: "Send rating" }), 0);
        await expect(r.getByText(/You rated Anna/)).toBeVisible();
        await beat(r, 500);
        await click(l, l.getByRole("radio", { name: "5 stars" }), 200);
        await click(l, l.getByRole("button", { name: "Send rating" }), 0);
        await expect(l.getByText(/You rated Sara/)).toBeVisible();
        await beat(l, 1000);
      });
      await stage.hold();
    },
  },
  // 8 ─────────────────────────────────────────────────────────────
  {
    id: "notifications",
    run: async (c) => {
      const { browser, stage } = c;
      const probe = await api(browser, "ben");
      const all = await nearby(probe.request);
      await probe.ctx.close();
      const target = all.find((l) => GIVER_BY_NAME[l.giver.name] && GIVER_BY_NAME[l.giver.name] !== "jonas" && GIVER_BY_NAME[l.giver.name] !== "anna");
      if (!target) throw new Error("no available listing from a seeded giver");
      const giverRole = GIVER_BY_NAME[target.giver.name];
      const giverApi = await api(browser, giverRole);
      await giverApi.request.post("/api/notifications/read-all");
      await giverApi.ctx.close();
      const jonas = await api(browser, "jonas");

      const g = await stage.open(giverRole, `${target.giver.name.split(" ")[0]} · giver`);
      await go(g.page, "/map");
      const bell = g.page.getByRole("link", { name: /^Notifications/ });
      await expect(bell).toBeVisible();
      const unread = async () => Number(((await g.page.getByTestId("unread-badge").textContent().catch(() => null)) ?? "0").trim() || 0);
      try {
        await stage.shoot(g, async (p) => {
          await beat(p, 800);
          await moveTo(p, bell);
          await beat(p, 900);
          const before = await unread();
          // Jonas reserves the listing from his own browser (not recorded).
          const res = await jonas.request.post(`/api/listings/${target.id}/claims`);
          if (res.status() !== 201) throw new Error(`reserve answered ${res.status()}`);
          await expect(p.getByTestId("unread-badge")).toHaveText(String(before + 1), { timeout: 10_000 });
          await beat(p, 1200);
          await click(p, bell);
          await expect(p).toHaveURL(/\/notifications/);
          const item = p.getByRole("button").filter({ hasText: `Jonas would like your ${target.title}` });
          await expect(item).toBeVisible();
          await moveTo(p, item);
          await beat(p, 1000);
          await click(p, p.getByRole("button", { name: "Mark all as read" }));
          await expect(p.getByText("You're all caught up.")).toBeVisible();
          await beat(p);
        });
        await stage.hold();
      } finally {
        // Give the food back: cancel Jonas's reservation.
        const mine = await (await jonas.request.get("/api/claims")).json().catch(() => null);
        const claim = mine?.asReceiver?.find((x: { listing: { id: string }; status: string }) => x.listing.id === target.id && x.status === "pending");
        if (claim) await jonas.request.post(`/api/claims/${claim.id}/cancel`);
        await jonas.ctx.close();
      }
    },
  },
  // 9 ─────────────────────────────────────────────────────────────
  {
    id: "fridges",
    run: async ({ stage }) => {
      const s = await stage.open("sara", "Sara · neighbour");
      await go(s.page, "/fridges");
      await pageOk(s.page);
      await stage.shoot(s, async (p) => {
        await beat(p, 1000);
        await click(p, p.getByRole("link", { name: /Parish Hall/ }).first());
        await ready(p);
        await beat(p, 600);
        await moveTo(p, p.getByText("Half full").first());
        await p.getByRole("radio", { name: "Half full" }).check({ force: true });
        await beat(p, 300);
        await type(p, p.getByLabel(/What's inside/), "Bread, apples and yoghurt");
        await click(p, p.getByRole("button", { name: "Save check-in" }), 0);
        await expect(p.getByText("Thanks! Neighbours will see this.")).toBeVisible();
        await beat(p, 600);
        const h = p.getByText("Bread, apples and yoghurt").last();
        await moveTo(p, h);
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 10 ────────────────────────────────────────────────────────────
  {
    id: "orgs",
    run: async ({ browser, stage, state }) => {
      const rosa = await stage.open("rosa", "Rosa · org admin");
      await go(rosa.page, "/organizations");
      let dashUrl = "";
      await stage.shoot(rosa, async (p) => {
        await beat(p, 700);
        await click(p, p.getByRole("link", { name: /Demo Food Bank Erlangen/ }).first());
        await ready(p);
        await click(p, p.getByRole("link", { name: /Open team dashboard/ }));
        await ready(p);
        const role = p.getByLabel("Role", { exact: true });
        await expect.poll(async () => (await role.locator("option").allTextContents()).map((o) => o.split(":")[0])).toEqual(["Admin", "Manager", "Volunteer", "Viewer"]);
        await moveTo(p, role);
        await beat(p, 1200);
        dashUrl = p.url();
      });

      const bent = await stage.open("bent", "Ben T. · org manager");
      await go(bent.page, dashUrl);
      let runUrl = "";
      await stage.shoot(bent, async (p) => {
        await click(p, p.getByRole("link", { name: "New pickup run" }));
        await ready(p);
        await type(p, p.getByLabel("Name"), `Saturday food bank run ${state.stamp % 1000}`);
        // Only seeded demo givers' food: never request a real neighbour's listing.
        const seeded = new RegExp(`· (${Object.keys(GIVER_BY_NAME).map((n) => n.replace(".", "\\.")).join("|")}) ·`);
        const rows = p.locator("li label").filter({ hasText: seeded });
        if ((await rows.count()) < 2) throw new Error("fewer than two seeded listings available for a bulk run (re-seed)");
        await click(p, rows.nth(0).getByRole("checkbox"), 250);
        await click(p, rows.nth(1).getByRole("checkbox"), 250);
        await click(p, p.getByRole("button", { name: "Request 2 listings" }), 0);
        await expect(p.getByRole("status")).toHaveText("Waiting for givers");
        await beat(p);
        runUrl = p.url();
      });

      // A giver confirms the first item on their pickups page (not recorded).
      const b = await api(browser, "bent");
      const run = (await (await b.request.get(`/api/bulk-claims/${runUrl.split("/bulk-claims/")[1]}`)).json()).bulkClaim;
      await b.ctx.close();
      const item = run.items[0];
      const giverRole = GIVER_BY_NAME[item.listing.giver.name as string];
      if (!giverRole) throw new Error(`unknown giver ${item.listing.giver.name}`);
      const g = await api(browser, giverRole);
      const conf = await g.request.post(`/api/claims/${item.claimId}/confirm`);
      await g.ctx.close();
      if (!conf.ok()) throw new Error(`giver confirm answered ${conf.status()}`);

      const mia = await stage.open("mia", "Mia · volunteer");
      await go(mia.page, runUrl);
      await expect(mia.page.getByRole("status")).toHaveText("In progress");
      await stage.shoot(mia, async (p) => {
        await beat(p, 700);
        await click(p, p.locator("input[type=checkbox]:not([disabled])").first(), 0);
        await expect(p.getByRole("status")).toHaveText("Partially collected");
        await moveTo(p, p.getByRole("status"));
        await beat(p, 1000);
      });
      await stage.hold();
    },
  },
  // 11 ────────────────────────────────────────────────────────────
  {
    id: "admin",
    run: async ({ browser, stage, state }) => {
      // Off camera, Sara suggests a fridge and registers an organization through the UI (as in e2e/orgs-fridges.spec.ts).
      // On camera the admin approves the organization and rejects the fridge, so no made-up fridge lands on the live map.
      const fridge = `Demo Fridge: Town Hall ${state.stamp % 1000}`;
      const org = `Demo Community Kitchen ${state.stamp % 1000}`;
      const sara = await api(browser, "sara");
      const sp = await sara.ctx.newPage();
      await sp.goto("/fridges/new");
      await sp.getByLabel("Name").fill(fridge);
      await sp.getByLabel("Address").fill("Rathausplatz 1, Erlangen");
      await sp.getByLabel("Opening hours").fill("Daily 8-20");
      await sp.getByRole("button", { name: "Suggest this fridge" }).click();
      await expect(sp.getByText(/We'll check it/)).toBeVisible();
      await sp.goto("/organizations/new");
      await sp.getByLabel("Name").fill(org);
      await sp.getByLabel("Type").selectOption("community_center");
      await sp.getByLabel("Email").fill("kitchen@demo.freshshare.de");
      await sp.getByLabel("Address").fill("Hall 3, Erlangen");
      await sp.getByLabel("City").fill("Erlangen");
      await sp.getByLabel("What do you do?").fill("Demo organization for the product video: we cook free lunches from rescued food.");
      await sp.getByLabel("Contact person").fill("Sara M.");
      await sp.getByLabel(/Verification document/).setInputFiles({ name: "registration.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
      await sp.getByRole("button", { name: "Register organization" }).click();
      await expect(sp.getByText(/We're reviewing your organization/)).toBeVisible();
      await sp.close();

      // Sara also reports a listing, so the queue has a fresh demo report to work on.
      const seededNearby = (await nearby(sara.request)).filter((l) => GIVER_BY_NAME[l.giver.name]); // never report a real neighbour
      const tom = seededNearby.find((l) => l.giver.name.startsWith("Tom")) ?? seededNearby[0];
      const note = `Demo report ${state.stamp % 10000}: looks like a duplicate`;
      if (tom) await sara.request.post("/api/reports", { data: { listingId: tom.id, reason: "spam", note } });
      await sara.ctx.close();

      const a = await stage.open("admin", "Admin");
      await go(a.page, "/admin");
      await expect(a.page.getByRole("button", { name: `Approve ${fridge}` })).toBeVisible();
      await stage.shoot(a, async (p) => {
        await beat(p, 600);
        await click(p, p.getByRole("button", { name: `Reject ${fridge}` }));
        await expect(p.getByRole("button", { name: `Reject ${fridge}` })).toHaveCount(0);
        await click(p, p.getByRole("button", { name: `Approve ${org}` }));
        await expect(p.getByRole("button", { name: `Approve ${org}` })).toHaveCount(0);
        await beat(p, 500);
        const reports = p.locator("section", { has: p.getByRole("heading", { name: /^Reports/ }) });
        const card = reports.getByRole("listitem").filter({ hasText: note });
        if (tom) {
          await moveTo(p, card);
          await beat(p, 700);
          await click(p, card.getByRole("button", { name: "Dismiss" }));
          await expect(card).toHaveCount(0);
        }
        const ea = p.locator("section", { has: p.getByRole("heading", { name: /Early access/ }) });
        await moveTo(p, ea.getByRole("heading", { name: /Early access \(\d+ sign-ups\)/ }));
        await scroll(p, 250, 700);
        await beat(p, 600);
        const csv = ea.getByRole("link", { name: /Download CSV/ });
        await moveTo(p, csv);
        const dl = p.waitForEvent("download", { timeout: 8000 });
        await csv.click();
        const file = await dl;
        if (!(file.suggestedFilename() || "").endsWith(".csv")) throw new Error("CSV export did not download a .csv");
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 12 ────────────────────────────────────────────────────────────
  {
    id: "impact",
    run: async ({ stage }) => {
      const a = await stage.open("anna", "Anna · giver");
      await go(a.page, "/profile");
      const panel = a.page.getByRole("region", { name: "Your impact" });
      await expect(panel).toBeVisible();
      await stage.shoot(a, async (p) => {
        await beat(p, 600);
        await moveTo(p, panel);
        await beat(p, 600);
        await moveTo(p, panel.getByText(/kg CO₂e/).first());
        await beat(p, 900);
        await moveTo(p, panel.getByRole("img", { name: /impact card/ }));
        await beat(p, 900);
        await moveTo(p, panel.getByRole("button", { name: "Share impact card" }));
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 12b ───────────────────────────────────────────────────────────
  {
    id: "recurring",
    run: async ({ browser, stage, state }) => {
      if (!state.postedListingId) {
        const anna = await api(browser, "anna");
        const mine = (await (await anna.request.get("/api/listings/mine/all")).json()).listings as { id: string; origin: string; title: string }[];
        await anna.ctx.close();
        state.postedListingId = mine.find((l) => l.origin !== "homemade")?.id;
        if (!state.postedListingId) throw new Error("Anna has no packaged or fresh listing to repeat");
      }
      const a = await stage.open("anna", "Anna · giver");
      await go(a.page, `/listings/${state.postedListingId}`);
      const repeat = a.page.getByRole("link", { name: /Repeat on a schedule/ });
      const viaLink = await repeat.isVisible().catch(() => false);
      if (!viaLink) await go(a.page, `/me/recurring?from=${state.postedListingId}`);
      try {
        await stage.shoot(a, async (p) => {
          if (viaLink) {
            await moveTo(p, repeat);
            await beat(p, 500);
            await click(p, repeat);
            await ready(p);
          }
          const days = p.getByRole("group", { name: "Days" });
          await expect(days).toBeVisible();
          // The form starts with Mon-Fri; make it Mon, Wed, Fri.
          for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
            const b = days.getByRole("button", { name: d, exact: true });
            const want = ["Mon", "Wed", "Fri"].includes(d);
            if (((await b.getAttribute("aria-pressed")) === "true") !== want) await click(p, b, 200);
          }
          await click(p, p.getByRole("button", { name: "Make it recurring" }), 0);
          const row = p.getByText(/Mon, Wed, Fri/).first();
          await expect(row).toBeVisible();
          await moveTo(p, row);
          await beat(p, 1200);
        });
        await stage.hold();
      } finally {
        // Don't leave a live schedule posting demo food on the real site.
        const anna = await api(browser, "anna");
        const list = await (await anna.request.get("/api/schedules")).json().catch(() => null);
        for (const s of list?.schedules ?? []) {
          if (s.title.startsWith("Bread rolls from this morning")) await anna.request.delete(`/api/schedules/${s.id}`);
        }
        await anna.ctx.close();
      }
    },
  },
  // 13 ────────────────────────────────────────────────────────────
  {
    id: "extras",
    run: async ({ browser, stage }) => {
      // Waitlist: Priya has reserved something (not recorded), Ben finds it taken and joins the waitlist.
      const priya = await api(browser, "priya");
      const all = await nearby(priya.request);
      const target = all.find((l) => !["Priya R."].includes(l.giver.name) && GIVER_BY_NAME[l.giver.name]);
      if (!target) throw new Error("no available listing for the waitlist demo");
      const res = await priya.request.post(`/api/listings/${target.id}/claims`);
      if (res.status() !== 201) throw new Error(`Priya's reserve answered ${res.status()}`);
      const priyaClaim = (await res.json()).claim?.id as string | undefined;
      const ben = await api(browser, "ben");
      const mehmetListing = (await nearby(ben.request)).find((l) => l.giver.name.startsWith("Mehmet"));

      try {
        const b = await stage.open("ben", "Ben · neighbour");
        await go(b.page, `/listings/${target.id}`);
        const box = b.page.getByTestId("waitlist-box");
        await expect(box).toContainText("Reserved by someone else");
        await stage.shoot(b, async (p) => {
          await moveTo(p, box);
          await beat(p, 700);
          await click(p, box.getByRole("button", { name: /Join waitlist/ }), 0);
          await expect(box).toContainText("#1");
          await beat(p, 1200);
        });

        if (mehmetListing) {
          const o = await stage.open("omar", "Omar · neighbour");
          await go(o.page, `/listings/${mehmetListing.id}`);
          await stage.shoot(o, async (p) => {
            await click(p, p.getByRole("link", { name: /Mehmet/ }).first());
            await expect(p).toHaveURL(/\/users\//);
            await ready(p);
            await click(p, p.getByRole("button", { name: /^Block Mehmet/ }));
            await click(p, p.getByRole("group", { name: /Block Mehmet/ }).getByRole("button", { name: "Block" }), 0);
            await expect(p.getByText("You blocked Mehmet.")).toBeVisible();
            await beat(p, 900);
            await p.goto("/map");
            await ready(p);
            await beat(p, 1000);
          });
        }
        await stage.hold();
      } finally {
        // Put things back: Ben leaves the waitlist, Priya cancels, Omar unblocks Mehmet.
        await ben.request.delete(`/api/listings/${target.id}/waitlist`).catch(() => {});
        if (priyaClaim) await priya.request.post(`/api/claims/${priyaClaim}/cancel`).catch(() => {});
        await priya.ctx.close();
        await ben.ctx.close();
        if (mehmetListing) {
          const omar = await api(browser, "omar");
          const l = await (await omar.request.get(`/api/listings/${mehmetListing.id}`)).json().catch(() => null);
          const giverId = l?.listing?.giver?.id;
          if (giverId) await omar.request.delete(`/api/users/${giverId}/block`).catch(() => {});
          await omar.ctx.close();
        }
      }
    },
  },
  // 14 ────────────────────────────────────────────────────────────
  {
    id: "phone",
    run: async ({ stage }) => {
      const v = await stage.open(null, "Phone · 390 px", "phone");
      await go(v.page, "/map");
      await expect(v.page.getByText(/listings? within 2 km/).first()).toBeVisible();
      await stage.shoot(v, async (p) => {
        await beat(p, 1200);
        await click(p, p.getByRole("tab", { name: /list/i }));
        await beat(p, 600);
        await scroll(p, 500, 1000);
        await scroll(p, -500, 700);
        await click(p, p.getByRole("article").first().getByRole("button").first());
        const sheet = p.getByRole("dialog");
        await expect(sheet.getByText(/Best before/).first()).toBeVisible();
        await beat(p, 900);
        await moveTo(p, sheet.getByText(/Best before/).first());
        await beat(p);
      });
      await stage.hold();
    },
  },
  // 15 ────────────────────────────────────────────────────────────
  {
    id: "stack",
    run: async ({ browser, stage }) => {
      const v = await stage.open(null, "");
      // The stack slide
      await v.page.goto("/api/health");
      await v.page.setContent(stackSlide());
      await stage.shoot(v, async (p) => {
        await beat(p, 1500);
        await beat(p, 1500);
        await beat(p, 1500);
        await beat(p, 1000);
      });
      // Live proof 1: the health check
      await go(v.page, "/api/health");
      await addressBar(v.page, v.page.url());
      await expect(v.page.getByText('"db":"ok"')).toBeVisible();
      await stage.shoot(v, async (p) => {
        await beat(p, 1500);
        await beat(p, 1200);
      });
      // Live proof 2: a listing photo served from S3 through CloudFront
      const { ctx, request } = await api(browser, "sara");
      const any = (await nearby(request))[0];
      const l = any ? await (await request.get(`/api/listings/${any.id}`)).json() : null;
      await ctx.close();
      const photoUrl: string | undefined = l?.listing?.photoUrl ?? l?.listing?.photos?.[0];
      if (photoUrl) {
        await go(v.page, photoUrl);
        await addressBar(v.page, v.page.url());
        await stage.shoot(v, async (p) => {
          await beat(p, 1500);
          await beat(p, 1200);
        });
      }
      await stage.hold();
    },
  },
];

function stackSlide() {
  const box = (t: string, items: string[]) =>
    `<div class="b"><h3>${t}</h3>${items.map((i) => `<p>${i}</p>`).join("")}</div>`;
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;height:100vh;font-family:"Segoe UI",system-ui;background:linear-gradient(135deg,#6b9f5e,#3f6b35);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box}
    h1{font-size:54px;margin:0 0 32px} .g{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
    .b{background:rgba(255,255,255,.14);border-radius:20px;padding:22px 26px} h3{margin:0 0 10px;font-size:26px;color:#ffe2c4} p{margin:6px 0;font-size:21px}
    .f{margin-top:28px;font-size:22px;opacity:.9}
  </style><body><h1>Under the hood</h1><div class="g">
    ${box("Web app", ["React 18 + Vite + TypeScript", "Tailwind, react-leaflet + OpenStreetMap", "Desktop first, works at 390 px"])}
    ${box("API", ["Node 20 + Express + TypeScript", "zod on every request, Prisma ORM", "JWT httpOnly cookies, Server-Sent Events"])}
    ${box("Data", ["PostgreSQL 16 on Amazon RDS", "Photos: sharp strips EXIF, S3 + CloudFront", "Exact location hidden until confirmed"])}
    ${box("AWS", ["ECS behind an Application Load Balancer", "Secrets Manager, Amazon SES e-mail", "Caddy web container"])}
    ${box("Delivery", ["Terraform for all infrastructure", "GitHub Actions: test, build, deploy", "Prisma migrations on deploy"])}
    ${box("Quality", ["Vitest API tests", "Playwright end-to-end tests", "This video: Playwright + ffmpeg"])}
  </div><div class="f">Live at freshshare.de</div></body>`;
}
