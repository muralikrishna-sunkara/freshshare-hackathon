import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { CO2E_PER_KG, KG_PER_PORTION, monthly, totals, WATER_L_PER_KG } from "../src/services/impact.js";
import { loginAs, seedDb } from "./helpers.js";

const app = createApp();
let users: Record<string, string>;
let orgs: Record<string, string>;
let rosa: TestAgent;
let omar: TestAgent;
let tom: TestAgent;
let sara: TestAgent;
let admin: TestAgent;

beforeAll(async () => {
  const r = await seedDb();
  users = r.users;
  orgs = r.organizations;
  [rosa, omar, tom, sara, admin] = await Promise.all(["rosa", "omar", "tom", "sara", "admin"].map((k) => loginAs(app, k)));
});
afterAll(() => prisma.$disconnect());

const row = (portions: number, weightKg: number | null, createdAt = new Date()) => ({
  createdAt,
  listing: { portions, weightKg, category: "bread", giverId: "g" },
});

/** Read a binary response body as a Buffer. */
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describe("impact maths", () => {
  it("uses the entered weight, else 0.4 kg per portion, and derives CO2e and water from kg", () => {
    const t = totals([row(2, 1.5), row(3, null)]);
    const kg = 1.5 + 3 * KG_PER_PORTION;
    expect(t).toEqual({ meals: 5, kg: 2.7, co2Kg: Math.round(kg * CO2E_PER_KG * 10) / 10, waterL: Math.round(kg * WATER_L_PER_KG), pickups: 2 });
  });

  it("buckets by month including empty months, oldest first", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const m = monthly([row(2, null, new Date("2026-11-01T10:00:00Z")), row(1, 2, new Date("2026-09-10T10:00:00Z"))], 3, now);
    expect(m.map((x) => [x.month, x.meals, x.kg])).toEqual([["2026-09", 1, 2], ["2026-10", 0, 0], ["2026-11", 2, 0.8]]);
  });
});

describe("personal impact", () => {
  it("is public, and counts collected food given and received", async () => {
    const id = users.anna;
    const res = await request(app).get(`/api/impact/users/${id}`).expect(200);
    const given = await prisma.claim.count({ where: { status: "collected", listing: { giverId: id } } });
    const received = await prisma.claim.count({ where: { status: "collected", receiverId: id } });
    expect(res.body).toMatchObject({ user: { id }, estimate: true, factors: { kgPerPortion: 0.4, co2ePerKg: 2.5, waterLitresPerKg: 190 } });
    expect(res.body.given.pickups).toBe(given);
    expect(res.body.received.pickups).toBe(received);
    expect(res.body.total.pickups).toBe(given + received);
    expect(res.body.monthly).toHaveLength(6);
    // aggregates only: no addresses or emails
    expect(JSON.stringify(res.body)).not.toMatch(/email|homeLat|lat"/);
  });

  it("goes up when a pickup is completed", async () => {
    const before = (await request(app).get(`/api/impact/users/${users.tom}`).expect(200)).body.given;
    const l = await prisma.listing.findFirstOrThrow({ where: { giverId: users.tom, status: "available" } });
    const c = (await sara.post(`/api/listings/${l.id}/claims`).expect(201)).body.claim;
    await tom.post(`/api/claims/${c.id}/confirm`).expect(200);
    await tom.post(`/api/claims/${c.id}/collected`).expect(200);
    const after = (await request(app).get(`/api/impact/users/${users.tom}`).expect(200)).body.given;
    expect(after.pickups).toBe(before.pickups + 1);
    expect(after.meals).toBe(before.meals + l.portions);
  });

  it("renders a 1200x630 PNG share card", async () => {
    const res = await request(app).get(`/api/impact/users/${users.anna}/card.png`).buffer(true).parse(binary).expect(200);
    expect(res.headers["content-type"]).toBe("image/png");
    const png = res.body as Buffer;
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("404s for an unknown person", async () => {
    expect((await request(app).get("/api/impact/users/nope")).status).toBe(404);
    expect((await request(app).get("/api/impact/users/nope/card.png")).status).toBe(404);
  });
});

describe("organization impact", () => {
  it("is public for an approved organization", async () => {
    const res = await request(app).get(`/api/impact/organizations/${orgs.foodbank}`).expect(200);
    expect(res.body).toMatchObject({ organization: { id: orgs.foodbank, status: "approved" }, estimate: true });
    expect(res.body.monthly).toHaveLength(12);
    const collected = await prisma.claim.count({ where: { status: "collected", organizationId: orgs.foodbank } });
    expect(res.body.total.pickups).toBe(collected);
    const card = await request(app).get(`/api/impact/organizations/${orgs.foodbank}/card.png`).expect(200);
    expect(card.headers["content-type"]).toBe("image/png");
  });

  it("hides a pending organization from outsiders but shows it to its members and site admins", async () => {
    const id = orgs.pendingngo;
    expect((await request(app).get(`/api/impact/organizations/${id}`)).status).toBe(404);
    expect((await tom.get(`/api/impact/organizations/${id}`)).status).toBe(404);
    expect((await sara.get(`/api/impact/organizations/${id}`)).status).toBe(200);
    expect((await admin.get(`/api/impact/organizations/${id}`)).status).toBe(200);
  });

  it("report PDF: sign-in required, members and site admins only", async () => {
    const url = `/api/impact/organizations/${orgs.foodbank}/report.pdf`;
    expect((await request(app).get(url)).status).toBe(401);
    expect((await tom.get(url)).status).toBe(404);
    for (const agent of [rosa, omar, admin]) {
      const res = await agent.get(url).buffer(true).parse(binary).expect(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toMatch(/attachment; filename="freshshare-impact-demo-food-bank-erlangen\.pdf"/);
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
