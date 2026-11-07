import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
let sara: TestAgent, anna: TestAgent, mehmet: TestAgent;
const { lat, lng } = seedFile.mapCentre;

beforeAll(async () => {
  seed = await seedDb();
  [sara, anna, mehmet] = await Promise.all(["sara", "anna", "mehmet"].map((k) => loginAs(app, k)));
});
afterAll(() => prisma.$disconnect());

describe("pickup chat", () => {
  let claimId: string;
  it("shows the seeded conversation on Sara's collected pears pickup", async () => {
    const claims = await sara.get("/api/claims");
    const pears = claims.body.asReceiver.find((c: { listing: { id: string } }) => c.listing.id === seed.listings.pears);
    const res = await sara.get(`/api/claims/${pears.id}/messages`);
    expect(res.status).toBe(200);
    expect(res.body.messages.map((m: { body: string }) => m.body)).toEqual([
      "Hi Anna, could I pick these up at 6?",
      "Sure! Ring the bell at the side door.",
      "On my way",
    ]);
  });

  it("lets the two parties chat and poll with after=", async () => {
    const r = await sara.post(`/api/listings/${seed.listings.yoghurt}/claims`);
    claimId = r.body.claim.id;
    const m1 = await sara.post(`/api/claims/${claimId}/messages`).send({ body: "On my way" });
    expect(m1.status).toBe(201);
    const m2 = await mehmet.post(`/api/claims/${claimId}/messages`).send({ body: "x" });
    expect(m2.status).toBe(403);
    const tomMsgs = await sara.get(`/api/claims/${claimId}/messages`).query({ after: m1.body.message.createdAt });
    expect(tomMsgs.body.messages).toEqual([]);
  });

  it("rejects empty messages and third-party reads", async () => {
    expect((await sara.post(`/api/claims/${claimId}/messages`).send({ body: "  " })).status).toBe(400);
    expect((await mehmet.get(`/api/claims/${claimId}/messages`)).status).toBe(403);
    expect((await request(app).get(`/api/claims/${claimId}/messages`)).status).toBe(401);
  });
});

describe("fridge check-ins", () => {
  it("records a check-in that becomes the latest state", async () => {
    const res = await sara.post(`/api/fridges/${seed.fridges.student}/checkins`).send({ state: "stocked" });
    expect(res.status).toBe(201);
    const list = await request(app).get("/api/fridges").query({ lat, lng });
    const f = list.body.fridges.find((x: { id: string }) => x.id === seed.fridges.student);
    expect(f.lastCheckIn.state).toBe("stocked");
  });

  it("validates state, auth and fridge id", async () => {
    expect((await sara.post(`/api/fridges/${seed.fridges.student}/checkins`).send({ state: "full" })).status).toBe(400);
    expect((await request(app).post(`/api/fridges/${seed.fridges.student}/checkins`).send({ state: "empty" })).status).toBe(401);
    expect((await sara.post(`/api/fridges/nope/checkins`).send({ state: "empty" })).status).toBe(404);
  });
});

describe("impact", () => {
  it("counts this week's collected portions nearby plus the baseline, and goes up after a pickup", async () => {
    const before = await request(app).get("/api/impact").query({ lat, lng });
    // seeded: baseline 18 + pears 6 collected yesterday
    expect(before.body.week.portions).toBe(seedFile.impactBaseline.portionsThisWeek + 6);
    expect(before.body.week.kg).toBe(9.6);
    expect(before.body.me).toBeNull();

    const r = await sara.post(`/api/listings/${seed.listings.lasagne}/claims`);
    await anna.post(`/api/claims/${r.body.claim.id}/confirm`);
    await sara.post(`/api/claims/${r.body.claim.id}/collected`);

    const after = await sara.get("/api/impact").query({ lat, lng });
    expect(after.body.week.portions).toBe(before.body.week.portions + 3);
    expect(after.body.me.portionsReceived).toBe(9); // pears 6 + lasagne 3
  });

  it("ignores pickups outside the radius", async () => {
    const far = await request(app).get("/api/impact").query({ lat: 52.52, lng: 13.405 });
    expect(far.body.week.portions).toBe(seedFile.impactBaseline.portionsThisWeek);
  });
});
