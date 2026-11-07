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
  return runSeed(prisma, localStorage(tmp, "/uploads"), { bcryptCost: 4 });
}
