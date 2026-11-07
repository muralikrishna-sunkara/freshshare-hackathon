import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { housekeeping } from "../src/services/claims.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, seedDb } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
let sara: TestAgent, anna: TestAgent, mehmet: TestAgent;

beforeAll(async () => {
  seed = await seedDb();
  [sara, anna, mehmet] = await Promise.all([loginAs(app, "sara"), loginAs(app, "anna"), loginAs(app, "mehmet")]);
});
afterAll(() => prisma.$disconnect());

describe("reserve -> confirm -> collect", () => {
  let claimId: string;

  it("reserves with a 30-minute hold and hides the address until confirmed", async () => {
    const res = await sara.post(`/api/listings/${seed.listings.lasagne}/claims`);
    expect(res.status).toBe(201);
    claimId = res.body.claim.id;
    expect(res.body.claim.status).toBe("pending");
    const holdMin = (new Date(res.body.claim.holdUntil).getTime() - Date.now()) / 60000;
    expect(holdMin).toBeGreaterThan(29);
    expect(holdMin).toBeLessThanOrEqual(30);
    expect(res.body.claim.listing).not.toHaveProperty("lat");

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.lasagne } });
    expect(listing.status).toBe("reserved");

    const detail = await sara.get(`/api/listings/${seed.listings.lasagne}`);
    expect(detail.body.listing).not.toHaveProperty("lat");
    expect(detail.body.listing.myClaim).toEqual({ id: claimId, status: "pending" });
  });

  it("removes the reserved listing from the map", async () => {
    const res = await request(app).get("/api/listings").query({ lat: 49.5897, lng: 11.004, radius: 2000 });
    expect(res.body.listings.map((l: { id: string }) => l.id)).not.toContain(seed.listings.lasagne);
  });

  it("rejects a second reservation with 409", async () => {
    const res = await mehmet.post(`/api/listings/${seed.listings.lasagne}/claims`);
    expect(res.status).toBe(409);
  });

  it("only lets the giver confirm", async () => {
    expect((await sara.post(`/api/claims/${claimId}/confirm`)).status).toBe(403);
    expect((await sara.post(`/api/claims/${claimId}/collected`)).status).toBe(409);
  });

  it("keeps the pickup private from third parties", async () => {
    expect((await mehmet.get(`/api/claims/${claimId}`)).status).toBe(403);
  });

  it("reveals the exact location after the giver confirms", async () => {
    const res = await anna.post(`/api/claims/${claimId}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe("confirmed");
    const view = await sara.get(`/api/claims/${claimId}`);
    expect(view.body.claim.listing.lat).toBe(49.5936);
    const detail = await sara.get(`/api/listings/${seed.listings.lasagne}`);
    expect(detail.body.listing.lat).toBe(49.5936);
  });

  it("marks collected", async () => {
    const res = await sara.post(`/api/claims/${claimId}/collected`);
    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe("collected");
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.lasagne } });
    expect(listing.status).toBe("collected");
    const mine = await sara.get("/api/claims");
    expect(mine.body.asReceiver.map((c: { id: string }) => c.id)).toContain(claimId);
    const given = await anna.get("/api/claims");
    expect(given.body.asGiver.map((c: { id: string }) => c.id)).toContain(claimId);
  });
});

describe("rules", () => {
  it("rejects reserving the seeded bread rolls already held by Ben", async () => {
    const res = await sara.post(`/api/listings/${seed.listings.rolls}/claims`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("not_available");
  });

  it("stops a giver reserving their own food", async () => {
    const res = await anna.post(`/api/listings/${seed.listings.veg}/claims`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("own_listing");
  });

  it("requires sign-in", async () => {
    expect((await request(app).post(`/api/listings/${seed.listings.veg}/claims`)).status).toBe(401);
  });

  it("cancel frees the listing", async () => {
    const r = await sara.post(`/api/listings/${seed.listings.apples}/claims`);
    const c = await mehmet.post(`/api/claims/${r.body.claim.id}/cancel`);
    expect(c.body.claim.status).toBe("cancelled");
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.apples } });
    expect(l.status).toBe("available");
  });

  it("lapses expired holds and frees the listing", async () => {
    const r = await sara.post(`/api/listings/${seed.listings.sourdough}/claims`);
    await prisma.claim.update({ where: { id: r.body.claim.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    const confirm = await request(app).post(`/api/claims/${r.body.claim.id}/confirm`);
    expect(confirm.status).toBe(401);
    await housekeeping();
    const c = await prisma.claim.findUniqueOrThrow({ where: { id: r.body.claim.id } });
    expect(c.status).toBe("lapsed");
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.sourdough } });
    expect(l.status).toBe("available");
  });

  it("expires listings past best-before", async () => {
    await prisma.listing.update({ where: { id: seed.listings.bananas }, data: { bestBefore: new Date(Date.now() - 1000) } });
    await housekeeping();
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.bananas } });
    expect(l.status).toBe("expired");
  });
});
