import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, photoPath, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
let anna: TestAgent;
let sara: TestAgent;
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();
const base = {
  title: "Oat cookies, a dozen",
  category: "other",
  origin: "homemade",
  bestBefore: inDays(1),
  storedCold: "true",
  notPastDate: "true",
  wouldEatIt: "true",
};

function post(agent: TestAgent, fields: Record<string, string>, photos = 1, field = "photos") {
  let r = agent.post("/api/listings");
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  for (let i = 0; i < photos; i++) r = r.attach(field, photoPath);
  return r;
}

beforeAll(async () => {
  seed = await seedDb();
  anna = await loginAs(app, "anna");
  sara = await loginAs(app, "sara");
});
afterAll(() => prisma.$disconnect());

describe("multi-photo listings with dietary tags", () => {
  it("stores up to 4 photos, dietary tags and weight", async () => {
    const res = await post(anna, { ...base, dietaryTags: "vegetarian,nut_free", weightKg: "0.6" }, 3);
    expect(res.status).toBe(201);
    expect(res.body.listing.photos).toHaveLength(3);
    expect(res.body.listing.photoUrl).toBe(res.body.listing.photos[0]);
    expect(res.body.listing.dietaryTags).toEqual(["vegetarian", "nut_free"]);
    expect(res.body.listing.weightKg).toBe(0.6);
  });

  it("rejects a fifth photo and unknown dietary tags", async () => {
    expect((await post(anna, base, 5)).status).toBe(400);
    const bad = await post(anna, { ...base, dietaryTags: "carnivore" });
    expect(bad.status).toBe(400);
  });

  it("filters the map by dietary tag", async () => {
    const { lat, lng } = seedFile.mapCentre;
    const res = await request(app).get("/api/listings").query({ lat, lng, radius: 2000, diet: "nut_free" });
    expect(res.status).toBe(200);
    expect(res.body.listings.length).toBeGreaterThan(0);
    for (const l of res.body.listings) expect(l.dietaryTags).toContain("nut_free");
  });

  it("rejects a banned title with a clear message", async () => {
    const res = await post(anna, { ...base, title: "Raw meat patties" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("raw_meat_fish");
  });
});

describe("post again", () => {
  it("reuses the photos of my own earlier listing", async () => {
    const res = await post(anna, { ...base, fromListingId: seed.listings.lasagne }, 0);
    expect(res.status).toBe(201);
    const src = await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.lasagne } });
    expect(res.body.listing.photoUrl).toBe(src.photoUrl);
    expect(res.body.listing.status).toBe("available");
  });

  it("does not let me reuse someone else's listing", async () => {
    const res = await post(sara, { ...base, fromListingId: seed.listings.lasagne }, 0);
    expect(res.status).toBe(404);
  });

  it("lists my own listings", async () => {
    const res = await anna.get("/api/listings/mine/all");
    expect(res.status).toBe(200);
    expect(res.body.listings.map((l: { id: string }) => l.id)).toContain(seed.listings.lasagne);
  });
});

describe("reports", () => {
  it("accepts a listing report once and puts it in the queue", async () => {
    const r1 = await sara.post("/api/reports").send({ listingId: seed.listings.apples, reason: "unsafe_food", note: "Looked mouldy" });
    expect(r1.status).toBe(201);
    expect(r1.body.message).toMatch(/Thanks/);
    await sara.post("/api/reports").send({ listingId: seed.listings.apples, reason: "unsafe_food" }).expect(201);
    expect(await prisma.report.count({ where: { listingId: seed.listings.apples, status: "open" } })).toBe(1);
  });

  it("accepts a profile report and validates the body", async () => {
    await sara.post("/api/reports").send({ userId: seed.users.anna, reason: "harassment" }).expect(201);
    expect((await sara.post("/api/reports").send({ reason: "spam" })).status).toBe(400);
    expect((await sara.post("/api/reports").send({ listingId: seed.listings.apples, reason: "boring" })).status).toBe(400);
    expect((await request(app).post("/api/reports").send({ listingId: seed.listings.apples, reason: "spam" })).status).toBe(401);
  });
});

describe("decline and the race message", () => {
  it("lets the giver decline a pending claim and frees the listing", async () => {
    const claim = await sara.post(`/api/listings/${seed.listings.sourdough}/claims`);
    expect(claim.status).toBe(201);
    const giverKey = seedFile.listings.find((l: { key: string }) => l.key === "sourdough").giver;
    const giver = await loginAs(app, giverKey);
    expect((await sara.post(`/api/claims/${claim.body.claim.id}/decline`)).status).toBe(403);
    const res = await giver.post(`/api/claims/${claim.body.claim.id}/decline`);
    expect(res.status).toBe(200);
    expect(res.body.claim.status).toBe("declined");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: seed.listings.sourdough } })).status).toBe("available");
  });

  it("tells the slower person that someone else was quicker", async () => {
    await sara.post(`/api/listings/${seed.listings.dal}/claims`).expect(201);
    const lena = await loginAs(app, "lena");
    const res = await lena.post(`/api/listings/${seed.listings.dal}/claims`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Someone else was quicker/);
  });
});

describe("live chat stream", () => {
  it("only lets the two parties open the stream", async () => {
    const claim = await prisma.claim.findFirstOrThrow({ where: { status: "collected" } });
    const res = await request(app).get(`/api/claims/${claim.id}/stream`);
    expect(res.status).toBe(401);
    const tom = await loginAs(app, "tom");
    expect((await tom.get(`/api/claims/${claim.id}/stream`)).status).toBe(403);
  });
});
