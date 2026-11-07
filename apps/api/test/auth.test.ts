import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { loginAs, seedDb, seedFile } from "./helpers.js";

const app = createApp();

beforeAll(async () => {
  await seedDb();
});
afterAll(() => prisma.$disconnect());

describe("auth", () => {
  it("registers, sets an httpOnly cookie and returns /me", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/register")
      .send({ name: "Test Person", email: "Test@Demo.freshshare.de", password: "longenough", homeLat: 49.59, homeLng: 11.0, ageConfirmed: true, termsAccepted: true });
    expect(res.status).toBe(201);
    expect(res.headers["set-cookie"][0]).toMatch(/fs_token=.+HttpOnly/i);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    const me = await agent.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("test@demo.freshshare.de");
    expect(me.body.user.verified).toBe(false);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Anna", email: "anna@demo.freshshare.de", password: "longenough", homeLat: 49.59, homeLng: 11.0, ageConfirmed: true, termsAccepted: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("email_taken");
  });

  it("validates the register body", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "X", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("logs in a seeded user with the demo password", async () => {
    const agent = await loginAs(app, "sara");
    const me = await agent.get("/api/me");
    expect(me.body.user.name).toBe("Sara M.");
    expect(me.body.user.stats.received).toBe(1);
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "anna@demo.freshshare.de", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_credentials");
  });

  it("logs out", async () => {
    const agent = await loginAs(app, "anna");
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  it("/me without a cookie is 401", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
    expect(seedFile.demoPassword).toBeTruthy();
  });
});
