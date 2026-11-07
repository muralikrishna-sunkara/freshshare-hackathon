import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import type { SeedResult } from "../src/services/seed.js";
import { loginAs, photoPath, seedDb, seedFile } from "./helpers.js";

const app = createApp();
let seed: SeedResult;
let admin: TestAgent;
let sara: TestAgent;
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const tomorrow = () => new Date(Date.now() + 86400_000).toISOString();

beforeAll(async () => {
  seed = await seedDb();
  admin = await loginAs(app, "admin");
  sara = await loginAs(app, "sara");
});
afterAll(() => prisma.$disconnect());

describe("fridge suggestions", () => {
  let fridgeId: string;
  it("saves a suggestion as pending and hides it from visitors", async () => {
    const res = await sara.post("/api/fridges").send({
      name: "Corner shop fridge", kind: "fridge", address: "Somewhere 5, Erlangen", lat: 49.59, lng: 11.0, openingHours: "Daily 8-20",
    });
    expect(res.status).toBe(201);
    fridgeId = res.body.fridge.id;
    expect((await request(app).get(`/api/fridges/${fridgeId}`)).status).toBe(404);
    expect((await sara.get(`/api/fridges/${fridgeId}`)).status).toBe(200); // the person who suggested it
    const list = await request(app).get("/api/fridges").query({ lat: 49.59, lng: 11.0, radius: 5000 });
    expect(list.body.fridges.map((f: { id: string }) => f.id)).not.toContain(fridgeId);
  });

  it("only admins approve, then it is public", async () => {
    expect((await sara.post(`/api/admin/fridges/${fridgeId}/approve`)).status).toBe(403);
    expect((await request(app).get("/api/admin/pending")).status).toBe(401);
    const pending = await admin.get("/api/admin/pending");
    expect(pending.body.fridges.map((f: { id: string }) => f.id)).toContain(fridgeId);
    await admin.post(`/api/admin/fridges/${fridgeId}/approve`).expect(200);
    expect((await request(app).get(`/api/fridges/${fridgeId}`)).status).toBe(200);
  });

  it("records a check-in with fill level and contents and shows it in history", async () => {
    const res = await sara.post(`/api/fridges/${seed.fridges.parish}/checkins`).send({ fillLevel: "half", contents: "Bread and yoghurt" });
    expect(res.status).toBe(201);
    const detail = await request(app).get(`/api/fridges/${seed.fridges.parish}`);
    expect(detail.body.fridge.checkIns[0]).toMatchObject({ fillLevel: "half", contents: "Bread and yoghurt", by: { name: "Sara M." } });
    expect((await sara.post(`/api/fridges/${seed.fridges.parish}/checkins`).send({})).status).toBe(400);
  });

  it("lets a giver drop a listing at an active fridge", async () => {
    let r = sara.post("/api/listings");
    const fields = { title: "Tinned tomatoes x3", category: "packaged", origin: "packaged", bestBefore: new Date(Date.now() + 30 * 86400_000).toISOString(),
      storedCold: "true", notPastDate: "true", wouldEatIt: "true", fridgeId: seed.fridges.parish };
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    const res = await r.attach("photos", photoPath);
    expect(res.status).toBe(201);
    const fridge = seedFile.fridges.find((f: { key: string }) => f.key === "parish");
    expect(res.body.listing.publicLat).toBe(fridge.lat);
    expect(res.body.listing.fridge.name).toBe(fridge.name);
    const detail = await request(app).get(`/api/fridges/${seed.fridges.parish}`);
    expect(detail.body.fridge.listings.map((l: { id: string }) => l.id)).toContain(res.body.listing.id);
  });
});

describe("organizations", () => {
  let orgId: string;
  it("registers an organization with a PDF; it is pending and the creator is its admin", async () => {
    const tom = await loginAs(app, "tom");
    let r = tom.post("/api/organizations");
    const fields = { name: "Demo Community Kitchen", type: "community_center", email: "kitchen@example.test", address: "Hall 3, Erlangen", city: "Erlangen",
      lat: "49.59", lng: "11.01", description: "We cook free lunches from rescued food.", contactName: "Tom B." };
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    const res = await r.attach("document", pdf, { filename: "registration.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    orgId = res.body.organization.id;
    expect((await request(app).get(`/api/organizations/${orgId}`)).status).toBe(404);
    const dash = await tom.get(`/api/organizations/${orgId}/dashboard`);
    expect(dash.body.organization.myRole).toBe("admin");
    const doc = dash.body.documents[0];
    const file = await tom.get(`/api/organizations/${orgId}/documents/${doc.id}`);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect((await sara.get(`/api/organizations/${orgId}/documents/${doc.id}`)).status).toBe(404);
    expect((await admin.get(`/api/organizations/${orgId}/documents/${doc.id}`)).status).toBe(200);
  });

  it("rejects a fake PDF", async () => {
    let r = sara.post("/api/organizations");
    for (const [k, v] of Object.entries({ name: "Fake", type: "ngo", email: "f@example.test", address: "Nowhere 1", city: "X", lat: "1", lng: "1", description: "Fake fake fake", contactName: "Me" }))
      r = r.field(k, v);
    const res = await r.attach("document", Buffer.from("not a pdf at all"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("admin approves it and it appears in the directory", async () => {
    await admin.post(`/api/admin/organizations/${orgId}/approve`).expect(200);
    const dir = await request(app).get("/api/organizations");
    expect(dir.body.organizations.map((o: { id: string }) => o.id)).toContain(orgId);
    expect(dir.body.organizations[0]).not.toHaveProperty("registrationNumber");
  });
});

describe("team roles and bulk claims", () => {
  const org = () => seed.organizations.foodbank;
  it("org admin invites with any of the four roles; the last admin can't be removed or demoted", async () => {
    const rosa = await loginAs(app, "rosa");
    const inv = await rosa.post(`/api/organizations/${org()}/members`).send({ email: "jonas@demo.freshshare.de", role: "viewer" });
    expect(inv.status).toBe(201);
    expect((await rosa.post(`/api/organizations/${org()}/members`).send({ email: "nobody@example.test", role: "viewer" })).status).toBe(404);
    expect((await rosa.patch(`/api/organizations/${org()}/members/${seed.users.rosa}`).send({ role: "manager" })).status).toBe(409);
    expect((await rosa.delete(`/api/organizations/${org()}/members/${seed.users.rosa}`)).status).toBe(409);
    const ben = await loginAs(app, "ben");
    expect((await ben.post(`/api/organizations/${org()}/members`).send({ email: "lena@demo.freshshare.de", role: "admin" })).status).toBe(404);
  });

  it("viewers and outsiders get 404 on bulk-claim endpoints", async () => {
    const omar = await loginAs(app, "omar");
    expect((await omar.get(`/api/organizations/${org()}/candidates`)).status).toBe(404);
    expect((await omar.post(`/api/organizations/${org()}/bulk-claims`).send({})).status).toBe(404);
    expect((await sara.get(`/api/organizations/${org()}/dashboard`)).status).toBe(404);
  });

  it("manager creates a bulk claim; giver confirms; volunteer collects; status moves to partially completed", async () => {
    const ben = await loginAs(app, "ben");
    const cand = await ben.get(`/api/organizations/${org()}/candidates`);
    expect(cand.status).toBe(200);
    const ids = cand.body.listings.slice(0, 2).map((l: { id: string }) => l.id);
    expect(ids).toHaveLength(2);
    const res = await ben.post(`/api/organizations/${org()}/bulk-claims`).send({ name: "Saturday run", scheduledPickupDate: tomorrow(), listingIds: ids });
    expect(res.status).toBe(201);
    const bulkId = res.body.bulkClaim.id;

    const mia = await loginAs(app, "mia");
    let view = await mia.get(`/api/bulk-claims/${bulkId}`);
    expect(view.body.bulkClaim.status).toBe("pending");
    expect(view.body.bulkClaim.items[0].listing.lat).toBeUndefined();

    // The first item's giver confirms it like any claim
    const first = view.body.bulkClaim.items[0];
    const giverKey = Object.entries(seed.users).find(([, v]) => v === first.listing.giver.id)![0];
    const giver = await loginAs(app, giverKey);
    await giver.post(`/api/claims/${first.claimId}/confirm`).expect(200);
    view = await mia.get(`/api/bulk-claims/${bulkId}`);
    expect(view.body.bulkClaim.status).toBe("in_progress");
    expect(view.body.bulkClaim.items[0].listing.lat).toBeTypeOf("number");

    // Volunteer can't collect an unconfirmed item, can collect the confirmed one
    const second = view.body.bulkClaim.items[1];
    expect((await mia.post(`/api/bulk-claims/${bulkId}/items/${second.id}/collect`)).status).toBe(409);
    const done = await mia.post(`/api/bulk-claims/${bulkId}/items/${first.id}/collect`);
    expect(done.status).toBe(200);
    expect(done.body.bulkClaim.status).toBe("partially_completed");
    const omar = await loginAs(app, "omar");
    expect((await omar.post(`/api/bulk-claims/${bulkId}/items/${second.id}/collect`)).status).toBe(404);
    const dash = await mia.get(`/api/organizations/${org()}/dashboard`);
    expect(dash.body.itemsCollected).toBe(1);
  });

  it("pending organizations can't create bulk claims", async () => {
    const res = await sara.post(`/api/organizations/${seed.organizations.pendingngo}/bulk-claims`).send({
      name: "Run", scheduledPickupDate: tomorrow(), listingIds: [seed.listings.apples],
    });
    expect(res.status).toBe(409);
  });
});
