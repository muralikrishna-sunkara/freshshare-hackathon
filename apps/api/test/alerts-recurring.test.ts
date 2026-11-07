import { generateKeyPairSync } from "node:crypto";
import type TestAgent from "supertest/lib/agent.js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { pushOutbox, vapidKeys } from "../src/lib/push.js";
import { berlinParts, isDue, postDueSchedules } from "../src/services/schedules.js";
import { loginAs, photoPath, seedDb } from "./helpers.js";

const app = createApp();
let users: Record<string, string>;
let listings: Record<string, string>;
let anna: TestAgent;
let tom: TestAgent;
let sara: TestAgent;

beforeAll(async () => {
  const r = await seedDb();
  users = r.users;
  listings = r.listings;
  [anna, tom, sara] = await Promise.all(["anna", "tom", "sara"].map((k) => loginAs(app, k)));
});
afterAll(() => prisma.$disconnect());

const sub = (n: number) => ({ endpoint: `https://push.example.test/send/${n}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } });

describe("T2.2 alert settings", () => {
  it("default to off, then save radius and categories around home", async () => {
    await prisma.alertSubscription.deleteMany({ where: { userId: users.tom } });
    expect((await tom.get("/api/alerts").expect(200)).body.alert).toMatchObject({ enabled: false, radiusM: 2000 });
    const r = await tom.put("/api/alerts").send({ enabled: true, radiusM: 1500, categories: ["bread", "bread", "fruit_veg"] }).expect(200);
    const home = await prisma.user.findUniqueOrThrow({ where: { id: users.tom } });
    expect(r.body.alert).toEqual({ enabled: true, lat: home.homeLat, lng: home.homeLng, radiusM: 1500, categories: ["bread", "fruit_veg"] });
    expect((await tom.put("/api/alerts").send({ enabled: true, radiusM: 50 })).status).toBe(400);
    expect((await tom.put("/api/alerts").send({ enabled: true, categories: ["meat"] })).status).toBe(400);
    expect((await request(app).get("/api/alerts")).status).toBe(401);
  });

  it("a new bread listing nearby reaches Tom in-app and by push on his device; turning alerts off stops it", async () => {
    await tom.post("/api/push/subscriptions").send(sub(1)).expect(201);
    expect((await tom.post("/api/push/subscriptions").send({ ...sub(2), endpoint: "http://insecure.example.test/x" })).status).toBe(400);
    pushOutbox.length = 0;
    await anna
      .post("/api/listings")
      .field("title", "Fresh rye bread")
      .field("category", "bread")
      .field("origin", "packaged")
      .field("bestBefore", new Date(Date.now() + 2 * 86_400_000).toISOString())
      .field("storedCold", "true").field("notPastDate", "true").field("wouldEatIt", "true")
      .attach("photo", photoPath)
      .expect(201);
    await new Promise((r) => setTimeout(r, 300)); // notifyNearby runs after the response
    const n = await prisma.notification.findFirst({ where: { userId: users.tom, type: "new_listing_nearby" }, orderBy: { createdAt: "desc" } });
    expect(n?.title).toBe("New near you: Fresh rye bread");
    expect(pushOutbox.find((p) => p.endpoint === sub(1).endpoint)?.payload).toMatchObject({ title: "New near you: Fresh rye bread", link: n!.link });

    await tom.put("/api/alerts").send({ enabled: false }).expect(200);
    expect(await prisma.alertSubscription.count({ where: { userId: users.tom } })).toBe(0);
  });

  it("claim events are pushed too, and unsubscribing removes the device", async () => {
    pushOutbox.length = 0;
    await sara.post(`/api/listings/${listings.yoghurt}/claims`).expect(201); // Tom's yoghurt
    expect(pushOutbox.some((p) => p.endpoint === sub(1).endpoint && /would like your/.test(p.payload.title))).toBe(true);
    await tom.delete("/api/push/subscriptions").send({ endpoint: sub(1).endpoint }).expect(200);
    expect(await prisma.pushSubscription.count({ where: { userId: users.tom } })).toBe(0);
  });

  it("exposes the VAPID public key derived from the PEM private key", async () => {
    const pem = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const k = vapidKeys(pem)!;
    expect(Buffer.from(k.publicKey, "base64url")).toHaveLength(65);
    expect(Buffer.from(k.privateKey, "base64url")).toHaveLength(32);
    expect(vapidKeys(pem.replace(/\n/g, "\\n"))?.publicKey).toBe(k.publicKey); // escaped newlines from env files
    expect(vapidKeys("not a key")).toBeNull();
    expect((await request(app).get("/api/push/key").expect(200)).body).toMatchObject({ enabled: true });
  });
});

describe("T2.4 recurring listings", () => {
  it("turns one of your listings into a schedule and posts it once on each due day", async () => {
    expect((await anna.post("/api/schedules").send({ fromListingId: listings.lasagne, daysOfWeek: [1], time: "17:00" })).body.error.code).toBe("homemade_not_recurring");
    expect((await sara.post("/api/schedules").send({ fromListingId: listings.veg, daysOfWeek: [1], time: "17:00" })).status).toBe(404);
    expect((await anna.post("/api/schedules").send({ fromListingId: listings.veg, daysOfWeek: [], time: "17:00" })).status).toBe(400);
    expect((await anna.post("/api/schedules").send({ fromListingId: listings.veg, daysOfWeek: [1], time: "25:00" })).status).toBe(400);

    const now = new Date();
    const today = berlinParts(now);
    const r = await anna.post("/api/schedules").send({ fromListingId: listings.veg, daysOfWeek: [today.weekday], time: "00:00", pickupHours: 2 }).expect(201);
    const s = r.body.schedule;
    expect(s).toMatchObject({ title: expect.any(String), active: true, daysOfWeek: [today.weekday], nextRun: `${today.date} 00:00` });

    const before = await prisma.listing.count({ where: { scheduleId: s.id } });
    expect(await postDueSchedules(now)).toBe(1);
    expect(await postDueSchedules(now)).toBe(0); // once per day, even if housekeeping runs again (or on another task)
    const posted = await prisma.listing.findFirstOrThrow({ where: { scheduleId: s.id } });
    expect(before).toBe(0);
    expect(posted).toMatchObject({ giverId: users.anna, status: "available" });
    expect(posted.photos.length).toBeGreaterThan(0);
    expect(posted.pickupUntil.getTime() - posted.pickupFrom.getTime()).toBe(2 * 3600_000);
    expect(posted.publicLat).not.toBe(posted.lat); // jittered like any home listing

    const paused = await anna.patch(`/api/schedules/${s.id}`).send({ active: false }).expect(200);
    expect(paused.body.schedule).toMatchObject({ active: false, nextRun: null });
    expect((await tom.patch(`/api/schedules/${s.id}`).send({ active: true })).status).toBe(404);
    await anna.delete(`/api/schedules/${s.id}`).expect(204);
    expect((await anna.get("/api/schedules")).body.schedules).toEqual([]);
  });

  it("is due only on chosen weekdays after the chosen time", () => {
    const monday1600 = new Date("2026-11-09T15:00:00Z"); // 16:00 in Berlin
    const s = { active: true, daysOfWeek: [1], time: "17:00", lastPostedOn: null };
    expect(isDue(s, monday1600)).toBe(false);
    expect(isDue(s, new Date("2026-11-09T16:05:00Z"))).toBe(true);
    expect(isDue({ ...s, lastPostedOn: "2026-11-09" }, new Date("2026-11-09T16:05:00Z"))).toBe(false);
    expect(isDue(s, new Date("2026-11-10T16:05:00Z"))).toBe(false); // Tuesday
  });
});
