import type { AddressInfo } from "node:net";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { outbox } from "../src/lib/email.js";
import { prisma } from "../src/lib/prisma.js";
import { housekeeping } from "../src/services/claims.js";
import { loginAs, photoPath, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let anna: TestAgent;
let sara: TestAgent;
let admin: TestAgent;
let ids: Record<string, string>;
const userId = async (key: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { email: seedFile.users.find((u: { key: string }) => u.key === key).email } })).id;
const notes = async (key: string) => prisma.notification.findMany({ where: { userId: await userId(key) }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  const r = await seedDb();
  ids = r.listings;
  anna = await loginAs(app, "anna");
  sara = await loginAs(app, "sara");
  admin = await loginAs(app, "admin");
});
beforeEach(() => {
  outbox.length = 0;
});
afterAll(() => prisma.$disconnect());

describe("claim and message notifications", () => {
  let claimId: string;

  it("a reservation notifies the giver in the app and by email", async () => {
    const res = await sara.post(`/api/listings/${ids.lasagne}/claims`).expect(201);
    claimId = res.body.claim.id;
    const [n] = (await notes("anna")).filter((x) => x.claimId === claimId);
    expect(n).toMatchObject({ type: "claim_received", link: `/pickups/${claimId}` });
    expect(n.title).toMatch(/^Sara would like your Vegetable lasagne/);
    expect(n.emailedAt).not.toBeNull();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "anna@demo.freshshare.de", subject: n.title });
    expect(outbox[0].html).toContain(`/pickups/${claimId}`);
    expect(outbox[0].text).toMatch(/Turn them off in your profile/);

    const list = await anna.get("/api/notifications").expect(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.notifications[0]).toMatchObject({ type: "claim_received", read: false });
  });

  it("confirming notifies the receiver and emails them", async () => {
    await anna.post(`/api/claims/${claimId}/confirm`).expect(200);
    const n = (await notes("sara")).find((x) => x.type === "claim_confirmed");
    expect(n?.title).toBe("Anna confirmed your pickup");
    expect(outbox.map((m) => m.to)).toEqual(["sara@demo.freshshare.de"]);
  });

  it("messages notify the other person, with at most one email per pickup every 10 minutes", async () => {
    await sara.post(`/api/claims/${claimId}/messages`).send({ body: "On my way!" }).expect(201);
    await sara.post(`/api/claims/${claimId}/messages`).send({ body: "Two minutes" }).expect(201);
    const msgs = (await notes("anna")).filter((x) => x.type === "new_message");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].body).toContain("On my way!");
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe("New message from Sara");
  });

  it("respects the email opt-out but still notifies in the app", async () => {
    await anna.patch("/api/me").send({ emailNotifications: false }).expect(200);
    expect((await anna.get("/api/me")).body.user.emailNotifications).toBe(false);
    await prisma.notification.updateMany({ where: { type: "new_message" }, data: { emailedAt: new Date(Date.now() - 3600_000) } });
    await sara.post(`/api/claims/${claimId}/messages`).send({ body: "Here" }).expect(201);
    expect((await notes("anna")).filter((x) => x.type === "new_message")).toHaveLength(3);
    expect(outbox).toHaveLength(0);
    await anna.patch("/api/me").send({ emailNotifications: true }).expect(200);
  });

  it("cancelling tells the other person (no email for cancellations)", async () => {
    await sara.post(`/api/claims/${claimId}/cancel`).expect(200);
    const n = (await notes("anna")).find((x) => x.type === "claim_cancelled");
    expect(n?.title).toBe("Sara cancelled the pickup");
    expect(outbox).toHaveLength(0);
  });
});

describe("reading notifications", () => {
  it("marks one or all as read, only for their owner", async () => {
    const list = await anna.get("/api/notifications").expect(200);
    expect(list.body.unreadCount).toBeGreaterThan(1);
    const first = list.body.notifications[0];
    expect((await sara.post(`/api/notifications/${first.id}/read`)).status).toBe(404);
    const one = await anna.post(`/api/notifications/${first.id}/read`).expect(200);
    expect(one.body.unreadCount).toBe(list.body.unreadCount - 1);
    await anna.post("/api/notifications/read-all").expect(200);
    expect((await anna.get("/api/notifications?unread=1")).body).toMatchObject({ notifications: [], unreadCount: 0 });
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });

  it("streams the unread count over SSE", async () => {
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sara@demo.freshshare.de", password: seedFile.demoPassword }),
      });
      const cookie = login.headers.get("set-cookie")!.split(";")[0];
      const ctrl = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/notifications/stream`, { headers: { cookie }, signal: ctrl.signal });
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      const chunk = new TextDecoder().decode(value);
      ctrl.abort();
      expect(chunk).toContain("event: unread");
      const data = JSON.parse(chunk.split("data: ")[1].split("\n")[0]);
      expect(data.unreadCount).toBe(await prisma.notification.count({ where: { userId: await userId("sara"), readAt: null } }));
    } finally {
      server.close();
    }
  });
});

describe("other notification types", () => {
  it("approving a suggested fridge notifies whoever suggested it", async () => {
    const pending = await admin.get("/api/admin/pending").expect(200);
    const f = pending.body.fridges[0];
    await admin.post(`/api/admin/fridges/${f.id}/approve`).expect(200);
    const n = await prisma.notification.findFirst({ where: { type: "fridge_approved", userId: f.createdById } });
    expect(n?.link).toBe(`/fridges/${f.id}`);
  });

  it("approving an organization notifies its admins", async () => {
    const pending = await admin.get("/api/admin/pending").expect(200);
    const o = pending.body.organizations[0];
    await admin.post(`/api/admin/organizations/${o.id}/approve`).expect(200);
    expect(await prisma.notification.count({ where: { type: "org_approved", userId: o.createdById } })).toBe(1);
  });

  it("reminds the giver once when the pickup window is about to end", async () => {
    await prisma.listing.update({ where: { id: ids.apples }, data: { pickupUntil: new Date(Date.now() + 30 * 60_000) } });
    await housekeeping();
    await housekeeping();
    const ns = await prisma.notification.findMany({ where: { type: "listing_expiring_soon", listingId: ids.apples } });
    expect(ns).toHaveLength(1);
    expect(ns[0].userId).toBe(await userId("mehmet"));
  });

  it("alerts people whose alert area covers a new listing, at most once per 20 minutes", async () => {
    const post = (title: string) =>
      anna
        .post("/api/listings")
        .field("title", title)
        .field("category", "fruit_veg")
        .field("origin", "fresh_produce")
        .field("bestBefore", new Date(Date.now() + 86400_000).toISOString())
        .field("storedCold", "true")
        .field("notPastDate", "true")
        .field("wouldEatIt", "true")
        .attach("photo", photoPath)
        .expect(201);
    await post("Carrots from the allotment");
    await post("More carrots");
    let n = 0;
    for (let i = 0; i < 20 && n === 0; i++) {
      n = await prisma.notification.count({ where: { type: "new_listing_nearby", userId: await userId("sara") } });
      if (n === 0) await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.notification.count({ where: { type: "new_listing_nearby", userId: await userId("sara") } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: "new_listing_nearby", userId: await userId("anna") } })).toBe(0);
  });
});
