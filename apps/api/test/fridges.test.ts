import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { seedDb, seedFile } from "./helpers.js";

const app = createApp();
let seed: SeedResult;

beforeAll(async () => {
  seed = await seedDb();
});
afterAll(() => prisma.$disconnect());

describe("GET /api/fridges", () => {
  it("returns the expected fridges within 2 km with their latest check-in", async () => {
    const { lat, lng } = seedFile.mapCentre;
    const res = await request(app).get("/api/fridges").query({ lat, lng, radius: 2000 });
    expect(res.status).toBe(200);
    const keys = res.body.fridges.map((f: { id: string }) => Object.entries(seed.fridges).find(([, v]) => v === f.id)?.[0]);
    expect([...keys].sort()).toEqual([...seedFile.expectedResults.fridgesWithin2km].sort());
    const parish = res.body.fridges.find((f: { id: string }) => f.id === seed.fridges.parish);
    expect(parish.lastCheckIn.state).toBe("stocked");
    expect(parish.photoUrl).toMatch(/fridges\/.+\.webp$/);
  });

  it("returns none far away", async () => {
    const res = await request(app).get("/api/fridges").query({ lat: 52.52, lng: 13.405, radius: 2000 });
    expect(res.body.fridges).toEqual([]);
  });
});
