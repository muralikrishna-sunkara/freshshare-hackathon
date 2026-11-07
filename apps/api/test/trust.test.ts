import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { housekeeping } from "../src/services/claims.js";
import { loginAs, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let users: Record<string, string>;
let listings: Record<string, string>;
const agents: Record<string, TestAgent> = {};
const as = (k: string) => agents[k];
const centre = () => `lat=${seedFile.mapCentre.lat}&lng=${seedFile.mapCentre.lng}&radius=5000`;

beforeEach(async () => {
  const r = await seedDb();
  users = r.users;
  listings = r.listings;
  for (const k of ["anna", "mehmet", "lena", "tom", "sara", "jonas", "priya", "admin"]) agents[k] = await loginAs(app, k);
});
afterAll(() => prisma.$disconnect());

async function reserve(who: string, key: string) {
  return (await as(who).post(`/api/listings/${listings[key]}/claims`).expect(201)).body.claim as { id: string };
}

describe("T2.6 QR pickup code", () => {
  it("is created on confirm, shown only to the receiver, and completes the pickup when the giver enters it", async () => {
    const c = await reserve("sara", "lasagne");
    expect((await as("sara").get(`/api/claims/${c.id}`)).body.claim.pickupCode).toBeUndefined();
    await as("anna").post(`/api/claims/${c.id}/confirm`).expect(200);
    const mine = (await as("sara").get(`/api/claims/${c.id}`).expect(200)).body.claim;
    expect(mine.pickupCode).toMatch(/^\d{6}$/);
    expect((await as("anna").get(`/api/claims/${c.id}`)).body.claim.pickupCode).toBeUndefined();

    const wrong = mine.pickupCode === "000000" ? "111111" : "000000";
    const bad = await as("anna").post(`/api/claims/${c.id}/verify`).send({ code: wrong });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("wrong_code");
    expect((await as("sara").post(`/api/claims/${c.id}/verify`).send({ code: mine.pickupCode })).status).toBe(403);
    expect((await as("anna").post(`/api/claims/${c.id}/verify`).send({ code: "12ab" })).status).toBe(400);

    const ok = await as("anna").post(`/api/claims/${c.id}/verify`).send({ code: mine.pickupCode }).expect(200);
    expect(ok.body.claim.status).toBe("collected");
    expect((await as("anna").post(`/api/claims/${c.id}/verify`).send({ code: mine.pickupCode })).status).toBe(409);
  });
});

describe("T2.3 waitlist", () => {
  it("can only be joined when the food is taken, and gives the first in line a 30-minute hold on cancel", async () => {
    const still = await as("lena").post(`/api/listings/${listings.apples}/waitlist`);
    expect(still.status).toBe(409);
    expect(still.body.error.code).toBe("still_available");

    const c = await reserve("sara", "apples");
    const j1 = await as("lena").post(`/api/listings/${listings.apples}/waitlist`).expect(201);
    expect(j1.body.waitlist).toEqual({ count: 1, myPosition: 1 });
    await as("tom").post(`/api/listings/${listings.apples}/waitlist`).expect(201);
    await as("tom").post(`/api/listings/${listings.apples}/waitlist`).expect(201); // joining twice keeps your place
    expect((await as("tom").get(`/api/listings/${listings.apples}`)).body.listing.waitlist).toEqual({ count: 2, myPosition: 2 });
    expect((await as("mehmet").post(`/api/listings/${listings.apples}/waitlist`)).status).toBe(400); // own listing
    expect((await as("sara").post(`/api/listings/${listings.apples}/waitlist`)).status).toBe(409); // already has it

    await as("sara").post(`/api/claims/${c.id}/cancel`).expect(200);
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: listings.apples } });
    expect(l.status).toBe("available");
    expect(l.reservedForUserId).toBe(users.lena);
    const mins = (l.reservedUntil!.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(29);
    expect(mins).toBeLessThanOrEqual(30);
    const offer = await prisma.notification.findFirst({ where: { userId: users.lena, type: "waitlist_offer", listingId: listings.apples } });
    expect(offer?.link).toBe(`/listings/${listings.apples}`);

    // Hidden from the map for others, visible to the holder
    const onMap = async (who: string) => (await as(who).get(`/api/listings?${centre()}`)).body.listings.some((x: { id: string }) => x.id === listings.apples);
    expect(await onMap("jonas")).toBe(false);
    expect(await onMap("lena")).toBe(true);
    const detail = (await as("lena").get(`/api/listings/${listings.apples}`)).body.listing;
    expect(detail.heldForMe).toBe(true);

    const blocked = await as("jonas").post(`/api/listings/${listings.apples}/claims`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("held_for_waitlist");
    await reserve("lena", "apples");
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listings.apples } });
    expect(after.reservedForUserId).toBeNull();
    expect(after.status).toBe("reserved");
  });

  it("passes the hold to the next person when it runs out, then reopens the listing", async () => {
    const c = await reserve("sara", "pasta");
    await as("lena").post(`/api/listings/${listings.pasta}/waitlist`).expect(201);
    await as("tom").post(`/api/listings/${listings.pasta}/waitlist`).expect(201);
    await as("mehmet").post(`/api/claims/${c.id}/decline`).expect(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listings.pasta } })).reservedForUserId).toBe(users.lena);

    await housekeeping(new Date(Date.now() + 31 * 60_000));
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listings.pasta } })).reservedForUserId).toBe(users.tom);
    expect(await prisma.notification.count({ where: { userId: users.tom, type: "waitlist_offer" } })).toBe(1);

    await housekeeping(new Date(Date.now() + 62 * 60_000));
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: listings.pasta } });
    expect(l.reservedForUserId).toBeNull();
    expect(l.status).toBe("available");
  });

  it("leaving the waitlist removes you", async () => {
    await reserve("sara", "veg");
    await as("lena").post(`/api/listings/${listings.veg}/waitlist`).expect(201);
    const r = await as("lena").delete(`/api/listings/${listings.veg}/waitlist`).expect(200);
    expect(r.body.waitlist).toEqual({ count: 0, myPosition: null });
  });
});

describe("T2.5 block and suspend", () => {
  it("blocking hides listings both ways, stops reservations and chat, and cancels open pickups", async () => {
    const c = await reserve("sara", "sourdough");
    const r = await as("sara").post(`/api/users/${users.lena}/block`).expect(201);
    expect(r.body.cancelledPickups).toBe(1);
    expect((await prisma.claim.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("cancelled");

    const ids = async (who: string) => (await as(who).get(`/api/listings?${centre()}`)).body.listings.map((x: { giver: { id: string } }) => x.giver.id);
    expect(await ids("sara")).not.toContain(users.lena);
    expect(await ids("lena")).not.toContain(users.sara);
    expect(await ids("tom")).toContain(users.lena);
    expect((await as("sara").get(`/api/listings/${listings.bananas}`)).status).toBe(404);
    expect((await as("sara").post(`/api/listings/${listings.bananas}/claims`)).status).toBe(403);
    expect((await as("sara").get(`/api/claims/${c.id}/messages`)).status).toBe(403);

    expect((await as("sara").get(`/api/users/${users.lena}`)).body.user.blockedByMe).toBe(true);
    expect((await as("sara").get("/api/users/blocks/mine")).body.blocked).toEqual([{ id: users.lena, name: expect.any(String) }]);
    await as("sara").delete(`/api/users/${users.lena}/block`).expect(200);
    expect(await ids("sara")).toContain(users.lena);
    expect((await as("sara").post(`/api/users/${users.sara}/block`)).status).toBe(400);
  });

  it("a suspended person can't sign in or use their session, and their food leaves the map", async () => {
    const c = await reserve("jonas", "dal");
    expect((await as("tom").post(`/api/admin/users/${users.jonas}/suspend`).send({ reason: "Repeated no-shows" })).status).toBe(403);
    await as("admin").post(`/api/admin/users/${users.jonas}/suspend`).send({ reason: "Repeated no-shows" }).expect(200);

    const login = await request(app).post("/api/auth/login").send({ email: "jonas@demo.freshshare.de", password: seedFile.demoPassword });
    expect(login.status).toBe(403);
    expect(login.body.error).toEqual({ code: "suspended", message: expect.stringContaining("Repeated no-shows") });
    expect((await as("jonas").get("/api/claims")).status).toBe(403);
    expect((await prisma.claim.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("cancelled");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listings.dal } })).status).toBe("available");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listings.cheese } })).status).toBe("removed");

    const list = await as("admin").get("/api/admin/users/suspended").expect(200);
    expect(list.body.users.map((u: { id: string }) => u.id)).toEqual([users.jonas]);
    await as("admin").post(`/api/admin/users/${users.jonas}/unsuspend`).expect(200);
    expect((await request(app).post("/api/auth/login").send({ email: "jonas@demo.freshshare.de", password: seedFile.demoPassword })).status).toBe(200);
  });

  it("an admin can suspend from a profile report with a reason", async () => {
    await as("sara").post("/api/reports").send({ userId: users.tom, reason: "harassment", note: "Rude messages" }).expect(201);
    const rep = (await as("admin").get("/api/admin/reports")).body.reports.find((x: { reportedUser?: { id: string } }) => x.reportedUser?.id === users.tom);
    expect((await as("admin").post(`/api/admin/reports/${rep.id}/resolve`).send({ action: "suspend_user" })).status).toBe(400);
    await as("admin").post(`/api/admin/reports/${rep.id}/resolve`).send({ action: "suspend_user", reason: "Harassment of other members" }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users.tom } })).suspendedReason).toBe("Harassment of other members");
    expect((await as("admin").get("/api/admin/reports")).body.reports.some((x: { id: string }) => x.id === rep.id)).toBe(false);
  });
});
