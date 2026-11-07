import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { outbox } from "../src/lib/email.js";
import { prisma } from "../src/lib/prisma.js";
import { seedDb, seedFile } from "./helpers.js";

const app = createApp();
const email = "lena@demo.freshshare.de";
beforeAll(() => seedDb());
afterAll(() => prisma.$disconnect());

const linkFrom = (text: string) => /\/reset-password\?token=([\w-]+)/.exec(text)?.[1];

describe("password reset", () => {
  it("answers the same for unknown emails and sends nothing", async () => {
    outbox.length = 0;
    const r = await request(app).post("/api/auth/forgot").send({ email: "nobody@example.test" }).expect(200);
    expect(r.body.message).toMatch(/If an account exists/);
    expect(outbox).toHaveLength(0);
  });

  it("emails a single-use link that sets a new password and signs you in", async () => {
    outbox.length = 0;
    await request(app).post("/api/auth/forgot").send({ email: email.toUpperCase() }).expect(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(email);
    const token = linkFrom(outbox[0].text)!;
    expect(token.length).toBeGreaterThan(30);
    // only a hash is stored
    expect(await prisma.passwordReset.count({ where: { tokenHash: token } })).toBe(0);

    expect((await request(app).post("/api/auth/reset").send({ token, password: "short" })).status).toBe(400);
    const agent = request.agent(app);
    const ok = await agent.post("/api/auth/reset").send({ token, password: "a-brand-new-pass" }).expect(200);
    expect(ok.body.user.email).toBe(email);
    expect((await agent.get("/api/me")).status).toBe(200);

    const again = await request(app).post("/api/auth/reset").send({ token, password: "another-new-pass" });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("invalid_token");
    expect((await request(app).post("/api/auth/login").send({ email, password: seedFile.demoPassword })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "a-brand-new-pass" })).status).toBe(200);
  });

  it("rejects expired links and keeps only the newest link", async () => {
    outbox.length = 0;
    await request(app).post("/api/auth/forgot").send({ email }).expect(200);
    await request(app).post("/api/auth/forgot").send({ email }).expect(200);
    const [first, second] = outbox.map((m) => linkFrom(m.text)!);
    expect((await request(app).post("/api/auth/reset").send({ token: first, password: "first-link-pass" })).status).toBe(400);
    await prisma.passwordReset.updateMany({ where: { usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post("/api/auth/reset").send({ token: second, password: "second-link-pass" })).status).toBe(400);
  });
});
