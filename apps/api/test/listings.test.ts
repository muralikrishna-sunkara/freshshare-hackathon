import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { seedDb, seedFile } from "./helpers.js";

const app = createApp();
const { lat, lng } = seedFile.mapCentre;
const expected = seedFile.expectedResults;
let seed: SeedResult;
const keyOf = (id: string) => Object.entries(seed.listings).find(([, v]) => v === id)?.[0];

beforeAll(async () => {
  seed = await seedDb();
});
afterAll(() => prisma.$disconnect());

describe("GET /api/health", () => {
  it("is ok when the db is reachable", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/listings", () => {
  it("returns exactly the expected listings within 2 km, sorted by distance", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 2000 });
    expect(res.status).toBe(200);
    const keys = res.body.listings.map((l: { id: string }) => keyOf(l.id));
    expect([...keys].sort()).toEqual([...expected.availableWithin2km].sort());
    const d = res.body.listings.map((l: { distanceM: number }) => l.distanceM);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });

  it("returns the expected listings within 10 km", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 10000 });
    const keys = res.body.listings.map((l: { id: string }) => keyOf(l.id));
    expect([...keys].sort()).toEqual([...expected.availableWithin10km].sort());
  });

  it("never returns expired, reserved or collected listings", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 20000 });
    const keys = res.body.listings.map((l: { id: string }) => keyOf(l.id));
    for (const k of expected.neverListed) expect(keys).not.toContain(k);
  });

  it("marks verified and unverified givers", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 10000 });
    const byGiver = new Map<string, boolean>();
    for (const l of res.body.listings) {
      const key = Object.entries(seed.users).find(([, v]) => v === l.giver.id)?.[0];
      if (key) byGiver.set(key, l.giver.verified);
    }
    for (const k of expected.verifiedGivers) expect(byGiver.get(k)).toBe(true);
    for (const k of expected.unverifiedGivers) expect(byGiver.get(k)).toBe(false);
  });

  it("never exposes exact coordinates or the handover spot in list responses", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 10000 });
    for (const l of res.body.listings) {
      expect(l).not.toHaveProperty("lat");
      expect(l).not.toHaveProperty("lng");
      expect(l).not.toHaveProperty("handoverSpot");
      expect(l.publicLat).toEqual(expect.any(Number));
      expect(l.photoUrl).toMatch(/^\/uploads\/(listings|seed)\/.+\.webp$/);
    }
  });

  it("keeps public coordinates 100-200 m from the real location", async () => {
    const rows = await prisma.listing.findMany();
    for (const r of rows) {
      const dLat = (r.publicLat - r.lat) * 111320;
      const dLng = (r.publicLng - r.lng) * 111320 * Math.cos((r.lat * Math.PI) / 180);
      const d = Math.hypot(dLat, dLng);
      expect(d).toBeGreaterThanOrEqual(99);
      expect(d).toBeLessThanOrEqual(201);
    }
  });

  it("filters by category", async () => {
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 2000, category: "fruit_veg" });
    expect(res.body.listings.length).toBeGreaterThan(0);
    for (const l of res.body.listings) expect(l.category).toBe("fruit_veg");
  });

  it("rejects a bad query with a 400 error body", async () => {
    const res = await request(app).get("/api/listings").query({ lat: "abc", lng });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});

describe("GET /api/listings/:id", () => {
  it("hides the exact location from anonymous viewers", async () => {
    const res = await request(app).get(`/api/listings/${seed.listings.lasagne}`);
    expect(res.status).toBe(200);
    expect(res.body.listing.title).toMatch(/lasagne/i);
    expect(res.body.listing).not.toHaveProperty("lat");
    expect(res.body.listing.giver.verified).toBe(true);
    expect(res.body.listing.giver.ratingAvg).toBe(4.9);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).get("/api/listings/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("seed", () => {
  it("recomputes ratings only for users without a rating history", async () => {
    const sara = await prisma.user.findUniqueOrThrow({ where: { id: seed.users.sara } });
    expect(sara.ratingCount).toBe(1);
    expect(sara.ratingAvg).toBe(5);
    const anna = await prisma.user.findUniqueOrThrow({ where: { id: seed.users.anna } });
    expect(anna.ratingAvg).toBe(4.9);
  });
});
