import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { distanceM } from "../src/lib/geo.js";
import { prisma } from "../src/lib/prisma.js";
import { localStorage } from "../src/lib/storage.js";
import { cleanTestUsers } from "../src/services/cleanTest.js";
import { runSeed } from "../src/services/seed.js";
import { loginAs, photoPath, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let admin: TestAgent;
let tom: TestAgent;
let sara: TestAgent;
let keyToId: Record<string, string>;

beforeAll(async () => {
  const r = await seedDb();
  keyToId = r.listings;
  admin = await loginAs(app, "admin");
  tom = await loginAs(app, "tom");
  sara = await loginAs(app, "sara");
});
afterAll(() => prisma.$disconnect());

describe("admin reports queue", () => {
  it("is admin only", async () => {
    expect((await sara.get("/api/admin/reports")).status).toBe(403);
    expect((await request(app).get("/api/admin/reports")).status).toBe(401);
  });

  it("lists an open report with the listing and reporter, and dismissing resolves it", async () => {
    await sara.post("/api/reports").send({ listingId: keyToId.cheese, reason: "spam", note: "Looks like an ad" }).expect(201);
    const q = await admin.get("/api/admin/reports").expect(200);
    const rep = q.body.reports.find((r: { listing?: { id: string } }) => r.listing?.id === keyToId.cheese);
    expect(rep).toMatchObject({ reason: "spam", note: "Looks like an ad", reporter: { name: expect.any(String) } });

    await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({ action: "dismiss" }).expect(200);
    const after = await admin.get("/api/admin/reports").expect(200);
    expect(after.body.reports.map((r: { id: string }) => r.id)).not.toContain(rep.id);
    const resolved = await admin.get("/api/admin/reports?status=resolved").expect(200);
    expect(resolved.body.reports.map((r: { id: string }) => r.id)).toContain(rep.id);
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: keyToId.cheese } });
    expect(listing.status).toBe("available");
    // Resolving twice is a 404
    expect((await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({})).status).toBe(404);
  });

  it("remove_listing takes the food off the map and cancels the active reservation", async () => {
    // rolls: reserved by newbie in the seed
    await sara.post("/api/reports").send({ listingId: keyToId.rolls, reason: "unsafe_food" }).expect(201);
    const q = await admin.get("/api/admin/reports").expect(200);
    const rep = q.body.reports.find((r: { listing?: { id: string } }) => r.listing?.id === keyToId.rolls);
    await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({ action: "remove_listing" }).expect(200);

    const l = await prisma.listing.findUniqueOrThrow({ where: { id: keyToId.rolls } });
    expect(l.status).toBe("removed");
    const active = await prisma.claim.count({ where: { listingId: keyToId.rolls, status: { in: ["pending", "confirmed"] } } });
    expect(active).toBe(0);
    expect((await request(app).get(`/api/listings/${keyToId.rolls}`)).status).toBe(404);
  });

  it("remove_listing on a report about a person is a 400", async () => {
    const jonas = await prisma.user.findUniqueOrThrow({ where: { email: "jonas@demo.freshshare.de" } });
    await tom.post("/api/reports").send({ userId: jonas.id, reason: "no_show" }).expect(201);
    const q = await admin.get("/api/admin/reports").expect(200);
    const rep = q.body.reports.find((r: { reportedUser?: { id: string } }) => r.reportedUser?.id === jonas.id);
    const res = await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({ action: "remove_listing" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("no_listing");
  });
});

describe("admin early access", () => {
  it("counts all sign-ups by role and source and exports CSV safely", async () => {
    const signups = [
      { email: "a@example.test", role: "giver", source: "flyer" },
      { email: "b@example.test", role: "giver", source: "instagram" },
      { email: "c@example.test", role: "receiver", source: "flyer" },
      { email: "d@example.test", role: "organization" },
    ];
    for (const s of signups) await request(app).post("/api/early-access").send({ ...s, consent: true }).expect(201);
    await prisma.earlyAccessSignup.update({ where: { email: "d@example.test" }, data: { postcode: "=HYPERLINK(1)" } });

    expect((await sara.get("/api/admin/early-access")).status).toBe(403);
    const res = await admin.get("/api/admin/early-access").expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.byRole[0]).toEqual({ role: "giver", count: 2 });
    expect(res.body.bySource).toContainEqual({ source: "flyer", count: 2 });
    expect(res.body.bySource).toContainEqual({ source: "unknown", count: 1 });
    expect(res.body.latest).toHaveLength(4);

    expect((await sara.get("/api/admin/early-access.csv")).status).toBe(403);
    const csv = await admin.get("/api/admin/early-access.csv").expect(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(/attachment/);
    const lines = csv.text.trim().split("\n");
    expect(lines[0]).toBe("email,role,postcode,source,language,consentAt,createdAt");
    expect(lines).toHaveLength(5);
    expect(csv.text).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("cleanTestUsers", () => {
  it("removes @example.test accounts and what they created, leaving demo data intact", async () => {
    const t = request.agent(app);
    await t
      .post("/api/auth/register")
      .send({ name: "Test Person", email: "clean-me@example.test", password: "password123", homeLat: seedFile.mapCentre.lat, homeLng: seedFile.mapCentre.lng, ageConfirmed: true, termsAccepted: true })
      .expect(201);
    const created = await t
      .post("/api/listings")
      .field("title", "Test carrots")
      .field("category", "fruit_veg")
      .field("origin", "fresh_produce")
      .field("bestBefore", new Date(Date.now() + 86400_000).toISOString())
      .field("storedCold", "true")
      .field("notPastDate", "true")
      .field("wouldEatIt", "true")
      .attach("photo", photoPath);
    expect(created.status).toBe(201);
    // The test user also reserves a demo listing (apples) and reports one.
    await t.post(`/api/listings/${keyToId.apples}/claims`).expect(201);
    await t.post("/api/reports").send({ listingId: keyToId.sourdough, reason: "other" }).expect(201);
    const demoUsersBefore = await prisma.user.count({ where: { email: { endsWith: "@demo.freshshare.de" } } });

    const r = await cleanTestUsers(prisma);
    expect(r.users).toBe(1);
    expect(r.listings).toBe(1);
    expect(await prisma.user.count({ where: { email: { endsWith: "@example.test" } } })).toBe(0);
    expect(await prisma.listing.count({ where: { id: created.body.listing.id } })).toBe(0);
    expect(await prisma.claim.count({ where: { listingId: keyToId.apples } })).toBe(0);
    expect(await prisma.earlyAccessSignup.count({ where: { email: { endsWith: "@example.test" } } })).toBe(0);
    expect(await prisma.user.count({ where: { email: { endsWith: "@demo.freshshare.de" } } })).toBe(demoUsersBefore);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: keyToId.sourdough } })).status).toBe("available");
    // Idempotent
    expect((await cleanTestUsers(prisma)).users).toBe(0);
  });
});

describe("seed history (CLI / AWS seed)", () => {
  it("adds weeks of history without changing what is available within 2 km", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "fs-uploads-"));
    const r = await runSeed(prisma, localStorage(tmp, "/uploads"), { bcryptCost: 4, history: true });
    const users = await prisma.user.count();
    expect(users).toBeGreaterThan(40);
    expect(await prisma.listing.count({ where: { status: "collected" } })).toBeGreaterThan(70);
    expect(await prisma.fridge.count({ where: { status: "active" } })).toBe(seedFile.fridges.length + 6);
    expect(await prisma.organization.count({ where: { status: "approved" } })).toBe(6); // 3 from seed.json + 3 from history
    expect(await prisma.bulkClaim.count({ where: { status: "completed" } })).toBeGreaterThanOrEqual(8);
    expect(await prisma.earlyAccessSignup.count()).toBe(64);
    expect(await prisma.report.count({ where: { status: "open" } })).toBe(4);
    // Every listing photo was uploaded once and shared.
    const urls = new Set((await prisma.listing.findMany({ select: { photoUrl: true } })).map((l) => l.photoUrl));
    expect(urls.size).toBeLessThanOrEqual(25);

    const { lat, lng } = seedFile.mapCentre;
    const near = await request(app).get("/api/listings").query({ lat, lng, radius: 2000 }).expect(200);
    const ids = near.body.listings.map((x: { id: string }) => x.id).sort();
    expect(ids).toEqual(seedFile.expectedResults.availableWithin2km.map((k: string) => r.listings[k]).sort());
    const generated = await prisma.listing.findMany({ where: { status: "available", id: { notIn: Object.values(r.listings) } } });
    expect(generated.length).toBe(12);
    for (const g of generated) expect(distanceM(lat, lng, g.publicLat, g.publicLng)).toBeGreaterThan(2000);

    const totals = await request(app).get("/api/impact/totals").expect(200);
    expect(totals.body.meals).toBeGreaterThan(100);

    // Deterministic: a second run produces the same counts.
    await runSeed(prisma, localStorage(tmp, "/uploads"), { bcryptCost: 4, history: true });
    expect(await prisma.user.count()).toBe(users);
    await seedDb();
  }, 120_000);
});
