import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { loginAs, photoPath, seedDb } from "./helpers.js";

const app = createApp();
let anna: TestAgent;
let ben: TestAgent;
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

async function postListing() {
  const res = await anna
    .post("/api/listings")
    .field("title", "Tomato soup, 2 jars")
    .field("category", "leftovers")
    .field("origin", "homemade")
    .field("bestBefore", inDays(1))
    .field("allergens", "celery")
    .field("storedCold", "true")
    .field("notPastDate", "true")
    .field("wouldEatIt", "true")
    .attach("photo", photoPath);
  expect(res.status).toBe(201);
  return res.body.listing as { id: string; photoUrl: string };
}

beforeAll(async () => {
  await seedDb();
  anna = await loginAs(app, "anna");
  ben = await loginAs(app, "ben");
});
afterAll(() => prisma.$disconnect());

describe("PATCH /api/listings/:id", () => {
  it("lets the giver change fields and keeps the rest", async () => {
    const l = await postListing();
    const res = await anna
      .patch(`/api/listings/${l.id}`)
      .field("title", "Tomato soup, 3 jars")
      .field("portions", "3")
      .field("allergens", "")
      .field("dietaryTags", "vegan,gluten_free");
    expect(res.status).toBe(200);
    expect(res.body.listing).toMatchObject({ title: "Tomato soup, 3 jars", portions: 3, allergens: [], dietaryTags: ["vegan", "gluten_free"], origin: "homemade" });
    expect(res.body.listing.photoUrl).toBe(l.photoUrl);
  });

  it("replaces the photos when new ones are attached", async () => {
    const l = await postListing();
    const res = await anna.patch(`/api/listings/${l.id}`).attach("photos", photoPath);
    expect(res.status).toBe(200);
    expect(res.body.listing.photoUrl).not.toBe(l.photoUrl);
    expect(res.body.listing.photos).toHaveLength(1);
  });

  it("refuses other people, bad values and raw meat", async () => {
    const l = await postListing();
    expect((await ben.patch(`/api/listings/${l.id}`).field("title", "Mine now")).status).toBe(403);
    expect((await request(app).patch(`/api/listings/${l.id}`).field("title", "Anon")).status).toBe(401);
    expect((await anna.patch(`/api/listings/${l.id}`).field("bestBefore", inDays(-1))).body.error.code).toBe("past_best_before");
    expect((await anna.patch(`/api/listings/${l.id}`).field("title", "Raw chicken breasts")).body.error.code).toBe("raw_meat_fish");
  });

  it("can't change food someone has reserved", async () => {
    const l = await postListing();
    expect((await ben.post(`/api/listings/${l.id}/claims`)).status).toBe(201);
    const res = await anna.patch(`/api/listings/${l.id}`).field("title", "Changed after reserving");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("not_editable");
  });
});

describe("GET /api/listings radius", () => {
  it("accepts up to 50 km for Any distance", async () => {
    const res = await request(app).get("/api/listings").query({ lat: 49.59, lng: 11.0, radius: 50000 });
    expect(res.status).toBe(200);
    expect((await request(app).get("/api/listings").query({ lat: 49.59, lng: 11.0, radius: 60000 })).status).toBe(400);
  });
});
