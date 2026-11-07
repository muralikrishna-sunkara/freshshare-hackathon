import { PrismaClient } from "@prisma/client";
import { storage } from "../src/lib/storage.js";
import { runSeed } from "../src/services/seed.js";

const prisma = new PrismaClient();

runSeed(prisma, storage(), { log: (m) => console.log(`[seed] ${m}`) })
  .then((r) => console.log(`[seed] done from ${r.dir}`))
  .catch((e) => {
    console.error("[seed] failed", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
