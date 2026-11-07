import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, seedDb } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
let sara: TestAgent, anna: TestAgent, ben: TestAgent, mehmet: TestAgent;
let claimId: string;

beforeAll(async () => {
  seed = await seedDb();
  [sara, anna, ben, mehmet] = await Promise.all(["sara", "anna", "newbie", "mehmet"].map((k) => loginAs(app, k)));
  const r = await sara.post(`/api/listings/${seed.listings.veg}/claims`);
  claimId = r.body.claim.id;
});
afterAll(() => prisma.$disconnect());

describe("ratings", () => {
  it("can't rate before collection", async () => {
    const res = await sara.post(`/api/claims/${claimId}/ratings`).send({ stars: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("not_collected");
  });

  it("both sides rate once after pickup and averages update", async () => {
    await anna.post(`/api/claims/${claimId}/confirm`);
    await sara.post(`/api/claims/${claimId}/collected`);

    const r1 = await sara.post(`/api/claims/${claimId}/ratings`).send({ stars: 5, note: "Lovely veg" });
    expect(r1.status).toBe(201);
    expect(r1.body.claim.myRating).toBe(5);
    const annaRow = await prisma.user.findUniqueOrThrow({ where: { id: seed.users.anna } });
    expect(annaRow.ratingCount).toBe(15); // keeps the seeded history of 14
    expect(annaRow.ratingAvg).toBeCloseTo((4.9 * 14 + 5) / 15, 5);

    const r2 = await anna.post(`/api/claims/${claimId}/ratings`).send({ stars: 4 });
    expect(r2.status).toBe(201);
    const saraRow = await prisma.user.findUniqueOrThrow({ where: { id: seed.users.sara } });
    expect(saraRow.ratingCount).toBe(2);
    expect(saraRow.ratingAvg).toBe(4.5);
  });

  it("rejects a second rating from the same side", async () => {
    const res = await sara.post(`/api/claims/${claimId}/ratings`).send({ stars: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_rated");
  });

  it("validates stars and blocks third parties", async () => {
    expect((await sara.post(`/api/claims/${claimId}/ratings`).send({ stars: 6 })).status).toBe(400);
    expect((await mehmet.post(`/api/claims/${claimId}/ratings`).send({ stars: 3 })).status).toBe(403);
  });
});

describe("DEMO verification", () => {
  it("rejects a wrong phone code", async () => {
    const res = await ben.post("/api/me/verify-phone").send({ phone: "+49 170 0000000", code: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("wrong_code");
  });

  it("verifies Ben's phone with 123456 and email in one tap, which earns the badge", async () => {
    const p = await ben.post("/api/me/verify-phone").send({ phone: "+49 170 0000000", code: "123456" });
    expect(p.status).toBe(200);
    expect(p.body.user.phoneVerified).toBe(true);
    expect(p.body.user.verified).toBe(false);
    const e = await ben.post("/api/me/verify-email");
    expect(e.body.user.verified).toBe(true);
  });

  it("reports pickup stats on /me", async () => {
    const res = await anna.get("/api/me");
    expect(res.body.user.stats.given).toBe(2); // seeded pears + the veg above
  });
});
