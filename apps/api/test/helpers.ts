import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { localStorage } from "../src/lib/storage.js";
import { prisma } from "../src/lib/prisma.js";
import { findSeedDir, runSeed, type SeedResult } from "../src/services/seed.js";

export const seedDir = findSeedDir();
export const seedFile = JSON.parse(readFileSync(path.join(seedDir, "seed.json"), "utf8"));

export async function seedDb(): Promise<SeedResult> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "fs-uploads-"));
  return runSeed(prisma, localStorage(tmp, "/uploads"), { bcryptCost: 4, history: false });
}

import request from "supertest";
import type { Express } from "express";

export const photoPath = path.join(seedDir, "seed-photos", "pasta.jpg");

export async function loginAs(app: Express, key: string) {
  const agent = request.agent(app);
  const user = seedFile.users.find((u: { key: string }) => u.key === key);
  const res = await agent.post("/api/auth/login").send({ email: user.email, password: seedFile.demoPassword });
  if (res.status !== 200) throw new Error(`login ${key} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
