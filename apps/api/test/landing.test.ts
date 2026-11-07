import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { TERMS_VERSION } from "../src/services/rules.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
const base = { name: "New Person", password: "longenough", homeLat: 49.59, homeLng: 11.0 };

beforeAll(async () => {
  seed = await seedDb();
});
afterAll(() => prisma.$disconnect());

describe("sign-up consent", () => {
  it("rejects sign-up without the Terms & Conditions", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...base, email: "noterms@example.test", ageConfirmed: true });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Terms & Conditions/);
  });

  it("rejects sign-up without the 16+ confirmation", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...base, email: "noage@example.test", termsAccepted: true });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/16 or older/);
  });

  it("stores when and which terms version was accepted", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...base, email: "consent@example.test", ageConfirmed: true, termsAccepted: true });
    expect(res.status).toBe(201);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "consent@example.test" } });
    expect(u.termsVersion).toBe(TERMS_VERSION);
    expect(u.termsAcceptedAt).toBeInstanceOf(Date);
  });
});

describe("early access", () => {
  it("saves a sign-up with role, lower-cased email and source", async () => {
    const res = await request(app)
      .post("/api/early-access")
      .send({ email: "Fan@Example.TEST", role: "fridge_host", postcode: "91054", source: "Flyer", consent: true });
    expect(res.status).toBe(201);
    const row = await prisma.earlyAccessSignup.findUniqueOrThrow({ where: { email: "fan@example.test" } });
    expect(row).toMatchObject({ role: "fridge_host", postcode: "91054", source: "flyer" });
  });

  it("upserts on email and keeps the first source", async () => {
    await request(app).post("/api/early-access").send({ email: "fan@example.test", role: "giver", source: "e2e", consent: true }).expect(201);
    const rows = await prisma.earlyAccessSignup.findMany({ where: { email: "fan@example.test" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: "giver", source: "flyer" });
  });

  it("requires consent and a valid role", async () => {
    const noConsent = await request(app).post("/api/early-access").send({ email: "x@example.test", role: "giver" });
    expect(noConsent.status).toBe(400);
    const badRole = await request(app).post("/api/early-access").send({ email: "x@example.test", role: "pirate", consent: true });
    expect(badRole.status).toBe(400);
  });
});

describe("impact totals", () => {
  it("returns all-time numbers and leaves test accounts out of neighbours", async () => {
    const res = await request(app).get("/api/impact/totals");
    expect(res.status).toBe(200);
    const realUsers = await prisma.user.count({ where: { email: { not: { endsWith: "@example.test" } } } });
    expect(res.body.neighbours).toBe(realUsers);
    expect(res.body.meals).toBeGreaterThan(0);
    expect(res.body.co2Kg).toBe(Math.round(res.body.kgSaved * 2.5));
    expect(res.body.fridges).toBe(seedFile.fridges.length); // active only, not the pending suggestion
    expect(res.body.organizations).toBe(1);
  });
});

describe("profiles", () => {
  it("shows a public profile without email or location", async () => {
    const res = await request(app).get(`/api/users/${seed.users.anna}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Anna K.");
    expect(res.body.user).not.toHaveProperty("email");
    expect(res.body.user).not.toHaveProperty("homeLat");
    expect(JSON.stringify(res.body)).not.toMatch(/@demo\.freshshare/);
    expect(res.body.user.reviews.length).toBeGreaterThan(0);
    expect(res.body.user.reviews[0].from.name).toBeTruthy();
  });

  it("returns 404 for an unknown user", async () => {
    expect((await request(app).get("/api/users/nope")).status).toBe(404);
  });

  it("lets a user edit their bio and home pin, and validates it", async () => {
    const agent = await loginAs(app, "sara");
    const res = await agent.patch("/api/me").send({ bio: "Student, love baking", homeLat: 49.6, homeLng: 11.01 });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ bio: "Student, love baking", homeLat: 49.6, homeLng: 11.01 });
    expect((await agent.patch("/api/me").send({ homeLat: 49.6 })).status).toBe(400);
    expect((await request(app).patch("/api/me").send({ bio: "x" })).status).toBe(401);
  });
});
