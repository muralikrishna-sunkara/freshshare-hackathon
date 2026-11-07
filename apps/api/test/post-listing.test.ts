import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { isRawMeatOrFish } from "../src/services/rules.js";
import { loginAs, photoPath, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let anna: TestAgent;
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

const valid = () => ({
  title: "Chickpea curry, 2 portions",
  category: "leftovers",
  origin: "homemade",
  bestBefore: inDays(1),
  portions: "2",
  allergens: "Mustard, celery",
  storedCold: "true",
  notPastDate: "true",
  wouldEatIt: "true",
});

function post(agent: TestAgent, fields: Record<string, string>, withPhoto = true) {
  let r = agent.post("/api/listings");
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  if (withPhoto) r = r.attach("photo", photoPath);
  return r;
}

beforeAll(async () => {
  await seedDb();
  anna = await loginAs(app, "anna");
});
afterAll(() => prisma.$disconnect());

describe("POST /api/listings", () => {
  it("creates a listing at the giver's home that shows up on the map", async () => {
    const res = await post(anna, valid());
    expect(res.status).toBe(201);
    const l = res.body.listing;
    expect(l.photoUrl).toMatch(/^\/uploads\/listings\/.+\.webp$/);
    expect(l.allergens).toEqual(["mustard", "celery"]);
    expect(l.lat).toBe(49.5936); // giver sees exact location
    expect(l.giver.verified).toBe(true);

    const { lat, lng } = seedFile.mapCentre;
    const near = await request(app).get("/api/listings").query({ lat, lng, radius: 2000 });
    expect(near.body.listings.map((x: { id: string }) => x.id)).toContain(l.id);
  });

  it("re-encodes the photo as WebP without EXIF", async () => {
    const input = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#6b9f5e" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret" } })
      .toBuffer();
    const { toWebp } = await import("../src/lib/upload.js");
    const out = await toWebp(input);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1024);
    expect(meta.exif).toBeUndefined();
  });

  it("requires sign-in", async () => {
    const res = await post(request.agent(app), valid());
    expect(res.status).toBe(401);
  });

  it("requires a photo", async () => {
    const res = await post(anna, valid(), false);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("photo_required");
  });

  it("requires a best-before date in the future", async () => {
    const { bestBefore: _b, ...noDate } = valid();
    expect((await post(anna, noDate)).status).toBe(400);
    const past = await post(anna, { ...valid(), bestBefore: inDays(-1) });
    expect(past.body.error.code).toBe("past_best_before");
  });

  it("requires every safety checklist item", async () => {
    const res = await post(anna, { ...valid(), wouldEatIt: "false" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/safety checklist/);
  });

  it("requires a valid origin label", async () => {
    const res = await post(anna, { ...valid(), origin: "unknown" });
    expect(res.status).toBe(400);
  });

  it("rejects raw meat or fish with a friendly message", async () => {
    const res = await post(anna, { ...valid(), title: "Raw chicken breast, 500 g", origin: "packaged" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("raw_meat_fish");
    expect(isRawMeatOrFish("Hackfleisch 500g")).toBe(true);
    expect(isRawMeatOrFish("Vegetable lasagne")).toBe(false);
    expect(isRawMeatOrFish("Cooked chicken curry")).toBe(false);
  });

  it("rejects non-image uploads", async () => {
    let r = anna.post("/api/listings");
    for (const [k, v] of Object.entries(valid())) r = r.field(k, v);
    const res = await r.attach("photo", Buffer.from("hello"), { filename: "x.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("unsupported_type");
  });

  it("rejects photos over 5 MB with 413", async () => {
    let r = anna.post("/api/listings");
    for (const [k, v] of Object.entries(valid())) r = r.field(k, v);
    const res = await r.attach("photo", Buffer.alloc(5 * 1024 * 1024 + 10), { filename: "big.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("photo_too_large");
  });

  it("hides homemade food 48 h after posting even with a later best-before", async () => {
    const res = await post(anna, { ...valid(), bestBefore: inDays(5) });
    expect(res.status).toBe(201);
    await prisma.listing.update({ where: { id: res.body.listing.id }, data: { createdAt: new Date(Date.now() - 49 * 3600_000) } });
    const { lat, lng } = seedFile.mapCentre;
    const near = await request(app).get("/api/listings").query({ lat, lng, radius: 2000 });
    expect(near.body.listings.map((x: { id: string }) => x.id)).not.toContain(res.body.listing.id);
  });
});
